import { spawn, ChildProcess } from "child_process";
import { PassThrough } from "stream";
import xterm from "@xterm/headless";
const { Terminal } = xterm;
type Terminal = InstanceType<typeof Terminal>;
import { SandboxManager } from "@anthropic-ai/sandbox-runtime";
import {
  parseEscapeSequences,
  ProcessExecutor,
  renderTerminalBuffer,
  truncateOutput
} from "./interface.js";
import { Process, SpawnOptions, ProcessInfo, SpawnResult, TERMINAL_COLS, TERMINAL_ROWS, OUTPUT_TRUNCATE, DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS } from "../types/process.js";
import { Result, ok, err } from "../lib/error.js";
import { ProcessRegistry } from "../registry/process-registry.js";
import { ProcessMcpConfig } from "../config.js";

export class HostExecutor implements ProcessExecutor {
  private registry = new ProcessRegistry();
  private pidCounter = 1;
  private childProcesses = new Map<string, ChildProcess>();
  private initialized = false;

  constructor(private config: ProcessMcpConfig) { }

  async initialize(): Promise<Result<void>> {
    if (this.initialized) {
      return ok(undefined);
    }

    try {
      // Initialize sandbox with configuration (optional)
      if (this.config.sandbox) {
        try {
          await SandboxManager.initialize(this.config.sandbox);
          console.error("[HostExecutor] Sandbox initialized successfully");
        } catch (sandboxError) {
          const message = sandboxError instanceof Error ? sandboxError.message : String(sandboxError);
          console.error("[HostExecutor] Sandbox initialization failed (continuing without sandbox):", message);
          console.error("[HostExecutor] To use sandbox features, install ripgrep: brew install ripgrep");
          // Continue without sandbox
        }
      }
      this.initialized = true;
      return ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[HostExecutor] Initialization error:", message);
      return err("initialization_failed", `Failed to initialize host executor: ${message}`, error);
    }
  }

  async spawn(options: SpawnOptions): Promise<Result<SpawnResult>> {
    if (!this.initialized) {
      const initResult = await this.initialize();
      if (!initResult.success) {
        return initResult as Result<SpawnResult>;
      }
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
    const pid = `host-${this.pidCounter++}`;

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
      // Wrap command with sandbox if available
      let sandboxedCmd = command;
      if (this.config.sandbox) {
        try {
          sandboxedCmd = await SandboxManager.wrapWithSandbox(command, "/bin/bash");
        } catch (error) {
          // If sandbox wrapping fails, continue with unwrapped command
          console.error("[HostExecutor] Sandbox wrapping failed, using unwrapped command");
        }
      }

      // Spawn process
      const mergedEnv = { ...globalThis.process.env, ...env };
      const childProcess = spawn(sandboxedCmd, {
        shell: globalThis.process.env.SHELL || true,
        cwd,
        env: mergedEnv,
        stdio: ["pipe", "pipe", "pipe"],
      });

      this.childProcesses.set(pid, childProcess);

      // Setup streams
      if (childProcess.stdin) {
        stdinStream.pipe(childProcess.stdin);
      }

      if (childProcess.stdout) {
        childProcess.stdout.on("data", (data: Buffer) => {
          const text = data.toString();
          process.stdout += text;
          stdoutStream.write(data);

          if (terminal) {
            terminal.write(text);
          }
        });
      }

      if (childProcess.stderr) {
        childProcess.stderr.on("data", (data: Buffer) => {
          const text = data.toString();
          process.stderr += text;
          stderrStream.write(data);

          if (terminal) {
            terminal.write(text);
          }
        });
      }

      // Create completion promise
      const completionPromise = new Promise<void>((resolve) => {
        childProcess.on("exit", (code) => {
          process.status = "terminated";
          process.exitCode = code ?? undefined;
          this.childProcesses.delete(pid);

          stdinStream.end();
          stdoutStream.end();
          stderrStream.end();

          resolve();
        });

        childProcess.on("error", (error) => {
          process.status = "terminated";
          process.exitCode = 1;
          process.stderr += `\nProcess error: ${error.message}`;
          this.childProcesses.delete(pid);

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
      return err("spawn_failed", "Failed to spawn process", error);
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

    const childProcess = this.childProcesses.get(pid);
    if (!childProcess) {
      return err("process_not_found", "Child process not found");
    }

    try {
      childProcess.kill(signal as NodeJS.Signals);
      return ok(undefined);
    } catch (error) {
      return err("kill_failed", "Failed to kill process", error);
    }
  }

  async cleanup(): Promise<void> {
    // Kill all running processes
    for (const [pid, childProcess] of this.childProcesses.entries()) {
      try {
        childProcess.kill("SIGTERM");
      } catch (error) {
        // Ignore errors during cleanup
      }
    }

    this.childProcesses.clear();
    this.registry.clear();

    // Reset sandbox
    if (this.config.sandbox) {
      try {
        await SandboxManager.reset();
      } catch (error) {
        // Ignore errors during cleanup
      }
    }

    this.initialized = false;
  }
}
