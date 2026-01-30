/**
 * MCP Tool definitions and handlers
 */

import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ProcessExecutor } from "../executors/interface.js";
import { resultToCallToolResult, errorToCallToolResult } from "../lib/mcp.js";
import { isErr } from "../lib/error.js";

// Tool schemas
export const spawnSchema = z.object({
  command: z.string().describe("The command to execute"),
  cwd: z.string().optional().describe("Working directory (default: /home/agent)"),
  env: z.record(z.string(), z.string()).optional().describe("Environment variables"),
  tty: z.boolean().optional().describe("Enable TTY mode for interactive applications"),
  background: z.boolean().optional().describe("Run in background (bypass timeout)"),
  timeoutMs: z.number().optional().describe("Timeout in milliseconds (default: 10000, max: 60000)"),
});

export const psSchema = z.object({});

export const stdinSchema = z.object({
  id: z.string().describe("Process ID"),
  input: z.string().describe("Input to send (supports escape sequences like \\n, \\r, \\xHH)"),
});

export const stdoutSchema = z.object({
  id: z.string().describe("Process ID"),
  lines: z.number().optional().describe("Number of lines to retrieve (default: 100)"),
});

export const killSchema = z.object({
  id: z.string().describe("Process ID"),
  signal: z.string().optional().describe("Signal to send (default: SIGTERM)"),
});

// Tool handlers
export async function handleSpawn(
  executor: ProcessExecutor,
  args: z.infer<typeof spawnSchema>
): Promise<CallToolResult> {
  const result = await executor.spawn(args);
  return resultToCallToolResult(result);
}

export async function handlePs(
  executor: ProcessExecutor,
  args: z.infer<typeof psSchema>
): Promise<CallToolResult> {
  const processes = executor.listProcesses();
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(processes, null, 2),
      },
    ],
  };
}

export async function handleStdin(
  executor: ProcessExecutor,
  args: z.infer<typeof stdinSchema>
): Promise<CallToolResult> {
  const result = await executor.stdin(args.id, args.input);
  if (isErr(result)) {
    return resultToCallToolResult(result);
  }
  return {
    content: [
      {
        type: "text",
        text: "Input sent successfully",
      },
    ],
  };
}

export async function handleStdout(
  executor: ProcessExecutor,
  args: z.infer<typeof stdoutSchema>
): Promise<CallToolResult> {
  const result = executor.getOutput(args.id, args.lines);
  return resultToCallToolResult(result);
}

export async function handleKill(
  executor: ProcessExecutor,
  args: z.infer<typeof killSchema>
): Promise<CallToolResult> {
  const result = await executor.kill(args.id, args.signal);
  if (isErr(result)) {
    return resultToCallToolResult(result);
  }
  return {
    content: [
      {
        type: "text",
        text: `Process ${args.id} killed successfully`,
      },
    ],
  };
}

// Tool definitions for MCP server
export const toolDefinitions = [
  {
    name: "spawn",
    description: "Execute a command with optional timeout. Processes exceeding timeout automatically move to background. Use background=true to bypass timeout entirely.",
    inputSchema: spawnSchema,
  },
  {
    name: "ps",
    description: "List all running and recently terminated processes",
    inputSchema: psSchema,
  },
  {
    name: "stdin",
    description: "Send input to an interactive process (TTY mode only). Supports escape sequences: \\n (newline), \\r (carriage return), \\t (tab), \\xHH (hex byte), \\uHHHH (unicode). Control sequences only work in TTY mode.",
    inputSchema: stdinSchema,
  },
  {
    name: "stdout",
    description: "View process output. Returns stdout and stderr (or terminal buffer for TTY processes). Use lines parameter to limit output.",
    inputSchema: stdoutSchema,
  },
  {
    name: "kill",
    description: "Terminate a process with a signal (default: SIGTERM). Common signals: SIGTERM (graceful), SIGKILL (force), SIGINT (Ctrl-C).",
    inputSchema: killSchema,
  },
];
