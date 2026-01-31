/**
 * ProcessExecutor interface - common abstraction for both Host and Docker modes
 */

import { Result } from "../lib/error.js";
import {
  OUTPUT_TRUNCATE,
  Process, SpawnOptions, ProcessInfo, SpawnResult
} from "../types/process.js";
import { Terminal } from "@xterm/headless";

export interface ProcessExecutor {
  initialize(): Promise<Result<void>>;
  spawn(options: SpawnOptions): Promise<Result<SpawnResult>>;
  stdin(pid: string, input: string): Promise<Result<void>>;
  ps(): ProcessInfo[];
  stdout(pid: string, lines?: number): Result<{ stdout: string; stderr: string }>;
  kill(pid: string, signal?: string): Promise<Result<void>>;
  cleanup(): Promise<void>;
}

export function parseEscapeSequences(input: string): string {
  return input
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export function renderTerminalBuffer(terminal: Terminal): string {
  const lines: string[] = [];
  const buffer = terminal.buffer.active;

  for (let i = 0; i < buffer.length; i++) {
    const line = buffer.getLine(i);
    if (line) {
      lines.push(line.translateToString(true));
    }
  }

  return lines.join("\n");
}

export function truncateOutput(output: string): string {
  if (output.length <= OUTPUT_TRUNCATE) {
    return output;
  }
  return output.slice(-OUTPUT_TRUNCATE) + "\n... (truncated)";
}
