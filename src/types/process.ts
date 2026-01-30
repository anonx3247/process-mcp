/**
 * Process type definitions
 */

import { PassThrough } from "stream";
import xterm from "@xterm/headless";
const { Terminal } = xterm;
type Terminal = InstanceType<typeof Terminal>;

export interface Process {
  /** Process ID (string for compatibility) */
  pid: string;

  /** Current process status */
  status: "running" | "terminated";

  /** Command that was executed */
  command: string;

  /** Working directory */
  cwd: string;

  /** Environment variables */
  env: Record<string, string>;

  /** Whether this is a TTY process */
  tty: boolean;

  /** Creation timestamp */
  createdAt: Date;

  /** Exit code (only set when terminated) */
  exitCode?: number;

  /** Stdin stream (for writing input) */
  stdinStream: PassThrough;

  /** Stdout stream (for reading output) */
  stdoutStream: PassThrough;

  /** Stderr stream (for reading errors) */
  stderrStream: PassThrough;

  /** Accumulated stdout output */
  stdout: string;

  /** Accumulated stderr output */
  stderr: string;

  /** Terminal instance (for TTY processes) */
  terminal?: Terminal;

  /** Promise that resolves when process completes (for background processes) */
  promise?: Promise<void>;

  /** Get terminal buffer content */
  getTerminalBuffer(): string;
}

export interface SpawnOptions {
  /** Command to execute */
  command: string;

  /** Working directory (default: /home/agent) */
  cwd?: string;

  /** Environment variables */
  env?: Record<string, string>;

  /** Enable TTY mode for interactive applications */
  tty?: boolean;

  /** Run in background (bypass timeout) */
  background?: boolean;

  /** Timeout in milliseconds (default: 10000, max: 60000) */
  timeoutMs?: number;
}

export interface ProcessInfo {
  pid: string;
  command: string;
  status: "running" | "terminated";
  exitCode?: number;
  cwd: string;
  tty: boolean;
  createdAt: string;
}

export interface SpawnResult {
  pid: string;
  status: "running" | "terminated";
  exitCode?: number;
  stdout: string;
  stderr: string;
}

/** Constants */
export const DEFAULT_TIMEOUT_MS = 10000; // 10 seconds
export const MAX_TIMEOUT_MS = 60000; // 60 seconds
export const OUTPUT_TRUNCATE = 8196; // characters
export const TERMINAL_COLS = 120;
export const TERMINAL_ROWS = 30;
