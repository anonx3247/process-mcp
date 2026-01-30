/**
 * ProcessExecutor interface - common abstraction for both Host and Docker modes
 */

import { Result } from "../lib/error.js";
import { Process, SpawnOptions, ProcessInfo, SpawnResult } from "../types/process.js";

export interface ProcessExecutor {
  /**
   * Initialize the executor (setup environment, containers, etc.)
   */
  initialize(): Promise<Result<void>>;

  /**
   * Spawn a new process
   */
  spawn(options: SpawnOptions): Promise<Result<SpawnResult>>;

  /**
   * Send input to a process (TTY only)
   */
  stdin(pid: string, input: string): Promise<Result<void>>;

  /**
   * Get a process by PID
   */
  getProcess(pid: string): Result<Process>;

  /**
   * List all processes
   */
  listProcesses(): ProcessInfo[];

  /**
   * Get process output (stdout/stderr or terminal buffer)
   */
  getOutput(pid: string, lines?: number): Result<{ stdout: string; stderr: string }>;

  /**
   * Kill a process with a signal
   */
  kill(pid: string, signal?: string): Promise<Result<void>>;

  /**
   * Cleanup resources
   */
  cleanup(): Promise<void>;
}
