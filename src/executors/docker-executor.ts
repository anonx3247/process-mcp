import Docker from "dockerode";
import { PassThrough } from "stream";
import xterm from "@xterm/headless";
const { Terminal } = xterm;
type Terminal = InstanceType<typeof Terminal>;
import {
  parseEscapeSequences,
  ProcessExecutor,
  renderTerminalBuffer,
  truncateOutput
} from "./interface.js";
import { Process, SpawnOptions, ProcessInfo, SpawnResult, TERMINAL_COLS, TERMINAL_ROWS, MAX_TIMEOUT_MS } from "../types/process.js";
import { Result, ok, err } from "../lib/error.js";
import { ProcessRegistry } from "../registry/process-registry.js";
import { ProcessMcpConfig } from "../config.js";

export class DockerExecutor implements ProcessExecutor {
  private docker: Docker;
  private registry = new ProcessRegistry();
  private pidCounter = 1;
  private container?: Docker.Container;
  private initialized = false;
  private execStreams = new Map<string, NodeJS.ReadWriteStream>();

  constructor(private config: ProcessMcpConfig) {
    this.docker = new Docker();
  }

  async initialize(): Promise<Result<void>> {
    if (this.initialized) {
      return ok(undefined);
    }

    if (!this.config.docker) {
      return err("config_missing", "Docker configuration is missing");
    }

    try {
      const { containerName, volumeName, image, useExisting } = this.config.docker;

      // Check if container already exists
      const containers = await this.docker.listContainers({ all: true });
      const existing = containers.find(c => c.Names.includes(`/${containerName}`));

      if (existing) {
        this.container = this.docker.getContainer(existing.Id);

        // Start if not running
        if (existing.State !== "running") {
          await this.container.start();
        }

        if (useExisting) {
          console.error(`[DockerExecutor] Using existing container: ${containerName}`);
        }
      } else if (useExisting) {
        // User requested existing container but it doesn't exist
        return err(
          "container_not_found",
          `DOCKER_USE_EXISTING=true but container '${containerName}' not found. ` +
          `Create it first or set DOCKER_USE_EXISTING=false to auto-create.`
        );
      } else {
        // Create volume if it doesn't exist
        try {
          await this.docker.createVolume({ Name: volumeName });
        } catch (error) {
          // Volume might already exist, ignore error
        }

        // Create container
        this.container = await this.docker.createContainer({
          name: containerName,
          Image: image,
          WorkingDir: this.config.defaults.workdir,
          Tty: true,
          User: "root", // Run as root to allow user creation
          HostConfig: {
            Binds: [`${volumeName}:${this.config.defaults.workdir}:rw`],
            Memory: 512 * 1024 * 1024, // 512MB
            NanoCpus: 1e9, // 1 vCPU
            PidsLimit: 4096,
            Privileged: false,
            Tmpfs: {
              "/tmp": "rw,noexec,nosuid,size=100m",
              "/var/tmp": "rw,noexec,nosuid,size=100m",
            },
          },
          Cmd: ["/bin/bash", "-c", "tail -f /dev/null"],
        });

        await this.container.start();
      }

      this.initialized = true;
      return ok(undefined);
    } catch (error) {
      return err("initialization_failed", "Failed to initialize Docker executor", error);
    }
  }

  async spawn(options: SpawnOptions): Promise<Result<SpawnResult>> {
    if (!this.initialized) {
      const initResult = await this.initialize();
      if (!initResult.success) {
        return initResult as Result<SpawnResult>;
      }
    }

    if (!this.container) {
      return err("container_not_found", "Container not initialized");
    }

    const {
      command,
      cwd = this.config.defaults.workdir,
      env = {},
      tty = false,
      background = false,
      timeoutMs = this.config.defaults.timeoutMs,
    } = options;

    // Validate timeout
    const actualTimeout = Math.min(timeoutMs, MAX_TIMEOUT_MS);

    // Generate PID
    const pid = `docker-${this.pidCounter++}`;

    // Create streams
    const stdinStream = new PassThrough();
    const stdoutStream = new PassThrough();
    const stderrStream = new PassThrough();

    // Create terminal for TTY mode
    let terminal: Terminal | undefined;
    if (tty) {
      terminal = new Terminal({ cols: TERMINAL_COLS, rows: TERMINAL_ROWS });
    }

    // Create process object
    const process: Process = {
      pid,
      command,
      cwd,
      env,
      tty,
      status: "running",
      createdAt: new Date(),
      stdinStream,
      stdoutStream,
      stderrStream,
      stdout: "",
      stderr: "",
      terminal,
      getTerminalBuffer: () => {
        if (!terminal) return "";
        return terminal.buffer.active.getLine(0) ? renderTerminalBuffer(terminal) : "";
      },
    };

    // Register process
    this.registry.add(process);

    try {
      // Build environment array
      const envArray = Object.entries({ ...process.env, ...env }).map(
        ([key, value]) => `${key}=${value}`
      );

      // Wrap command to extract PID and change directory
      const wrappedCommand = `cd "${cwd}" && echo "PID:$$" >&2 && ${command}`;

      // Create exec instance
      const exec = await this.container.exec({
        Cmd: ["/bin/bash", "-c", wrappedCommand],
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: tty,
        Env: envArray.length > 0 ? envArray : undefined,
      });

      // Start exec and get stream
      const stream = await exec.start({
        Tty: tty,
        stdin: true,
      });

      this.execStreams.set(pid, stream);

      // Setup stream handling
      if (tty) {
        // TTY mode: stream is not multiplexed
        stream.on("data", (data: Buffer) => {
          const text = data.toString();
          process.stdout += text;
          stdoutStream.write(data);

          if (terminal) {
            terminal.write(text);
          }
        });

        // Pipe stdin to stream
        stdinStream.pipe(stream);
      } else {
        // Non-TTY mode: demux stdout and stderr
        const stdout = new PassThrough();
        const stderr = new PassThrough();

        this.container.modem.demuxStream(stream, stdout, stderr);

        // Extract PID from stderr
        let pidExtracted = false;
        stderr.on("data", (data: Buffer) => {
          const text = data.toString();

          // Try to extract PID from first line
          if (!pidExtracted) {
            const match = text.match(/PID:(\d+)/);
            if (match) {
              pidExtracted = true;
              // Remove PID line from stderr
              const cleanedText = text.replace(/PID:\d+\n?/, "");
              if (cleanedText) {
                process.stderr += cleanedText;
                stderrStream.write(cleanedText);
              }
              return;
            }
          }

          process.stderr += text;
          stderrStream.write(data);
        });

        stdout.on("data", (data: Buffer) => {
          const text = data.toString();
          process.stdout += text;
          stdoutStream.write(data);
        });

        // Pipe stdin to stream
        stdinStream.pipe(stream);
      }

      // Create completion promise
      const completionPromise = new Promise<void>((resolve) => {
        stream.on("end", async () => {
          try {
            const inspectResult = await exec.inspect();
            process.status = "terminated";
            process.exitCode = inspectResult.ExitCode ?? undefined;
          } catch (error) {
            process.status = "terminated";
            process.exitCode = 1;
          }

          this.execStreams.delete(pid);
          stdinStream.end();
          stdoutStream.end();
          stderrStream.end();

          resolve();
        });

        stream.on("error", (error) => {
          process.status = "terminated";
          process.exitCode = 1;
          process.stderr += `\nStream error: ${error.message}`;

          this.execStreams.delete(pid);
          stdinStream.end();
          stdoutStream.end();
          stderrStream.end();

          resolve();
        });
      });

      // Handle background vs foreground execution
      if (background) {
        process.promise = completionPromise;
        return ok({
          pid,
          status: "running",
          stdout: truncateOutput(process.stdout),
          stderr: truncateOutput(process.stderr),
        });
      }

      // Wait for completion or timeout
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => resolve(), actualTimeout);
      });

      await Promise.race([completionPromise, timeoutPromise]);

      // Return result
      return ok({
        pid,
        status: process.status,
        exitCode: process.exitCode,
        stdout: truncateOutput(tty ? process.getTerminalBuffer() : process.stdout),
        stderr: truncateOutput(process.stderr),
      });
    } catch (error) {
      process.status = "terminated";
      process.exitCode = 1;
      return err("spawn_failed", "Failed to spawn process in container", error);
    }
  }

  async stdin(pid: string, input: string): Promise<Result<void>> {
    const process = this.registry.get(pid);
    if (!process) {
      return err("process_not_found", `Process ${pid} not found`);
    }

    if (!process.tty) {
      return err("not_tty", "Process is not in TTY mode. Only TTY processes can receive stdin.");
    }

    if (process.status !== "running") {
      return err("process_terminated", "Process has already terminated");
    }

    try {
      // Parse escape sequences
      const parsedInput = parseEscapeSequences(input);
      process.stdinStream.write(parsedInput);
      return ok(undefined);
    } catch (error) {
      return err("stdin_failed", "Failed to write to stdin", error);
    }
  }

  ps(): ProcessInfo[] {
    return this.registry.list().map(p => this.registry.info(p.pid)!);
  }

  stdout(pid: string, lines: number = 100): Result<{ stdout: string; stderr: string }> {
    const process = this.registry.get(pid);
    if (!process) {
      return err("process_not_found", `Process ${pid} not found`);
    }

    let stdout: string;
    if (process.tty && process.terminal) {
      stdout = process.getTerminalBuffer();
    } else {
      stdout = process.stdout;
    }

    // Limit to last N lines
    const stdoutLines = stdout.split("\n");
    const stderrLines = process.stderr.split("\n");

    const limitedStdout = stdoutLines.slice(-lines).join("\n");
    const limitedStderr = stderrLines.slice(-lines).join("\n");

    return ok({
      stdout: limitedStdout,
      stderr: limitedStderr,
    });
  }

  async kill(pid: string, signal: string = "SIGTERM"): Promise<Result<void>> {
    const process = this.registry.get(pid);
    if (!process) {
      return err("process_not_found", `Process ${pid} not found`);
    }

    if (process.status !== "running") {
      return err("process_terminated", "Process has already terminated");
    }

    const stream = this.execStreams.get(pid);
    if (!stream) {
      return err("stream_not_found", "Exec stream not found");
    }

    try {
      // Destroy the stream to kill the process
      if ("destroy" in stream && typeof stream.destroy === "function") {
        stream.destroy();
      } else {
        stream.end();
      }

      // Mark as terminated
      process.status = "terminated";
      process.exitCode = 143; // 128 + 15 (SIGTERM)

      return ok(undefined);
    } catch (error) {
      return err("kill_failed", "Failed to kill process", error);
    }
  }

  async cleanup(): Promise<void> {
    // Close all active streams
    for (const [pid, stream] of this.execStreams.entries()) {
      try {
        if ("destroy" in stream && typeof stream.destroy === "function") {
          stream.destroy();
        } else {
          stream.end();
        }
      } catch (error) {
        // Ignore errors during cleanup
      }
    }

    this.execStreams.clear();
    this.registry.clear();

    // Stop and remove container
    if (this.container) {
      try {
        await this.container.stop();
        await this.container.remove();
      } catch (error) {
        // Ignore errors during cleanup
      }
      this.container = undefined;
    }

    this.initialized = false;
  }
}
