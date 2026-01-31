import { PassThrough } from "stream";
import xterm from "@xterm/headless";
const { Terminal } = xterm;
type Terminal = InstanceType<typeof Terminal>;

export interface Process {
  pid: string;
  status: "running" | "terminated";
  command: string;
  cwd: string;
  env: Record<string, string>;
  tty: boolean;
  createdAt: Date;
  exitCode?: number;
  stdinStream: PassThrough;
  stdoutStream: PassThrough;
  stderrStream: PassThrough;
  stdout: string;
  stderr: string;
  terminal?: Terminal;
  promise?: Promise<void>;
  getTerminalBuffer(): string;
}

export interface SpawnOptions {
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  tty?: boolean;
  background?: boolean;
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

export const DEFAULT_TIMEOUT_MS = 10_000;
export const MAX_TIMEOUT_MS = 60_000;
export const OUTPUT_TRUNCATE = 8196;
export const TERMINAL_COLS = 120;
export const TERMINAL_ROWS = 30;
