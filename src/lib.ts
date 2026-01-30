/**
 * Process MCP - Library exports
 * Use this to integrate process-mcp into your own Node.js applications
 */

// Main server factory
export { createProcessMCP } from "./server.js";
export type { ProcessMcpServer } from "./server.js";

// Configuration
export { loadConfig } from "./config.js";
export type { ProcessMcpConfig, ExecutionMode } from "./config.js";

// Executors (for advanced usage)
export { HostExecutor } from "./executors/host-executor.js";
export { DockerExecutor } from "./executors/docker-executor.js";
export type { ProcessExecutor } from "./executors/interface.js";

// Types
export type {
  Process,
  SpawnOptions,
  ProcessInfo,
  SpawnResult,
} from "./types/process.js";
export {
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  OUTPUT_TRUNCATE,
  TERMINAL_COLS,
  TERMINAL_ROWS,
} from "./types/process.js";

// Error handling
export { ok, err, isOk, isErr } from "./lib/error.js";
export type { Result } from "./lib/error.js";

// Process registry (for advanced usage)
export { ProcessRegistry } from "./registry/process-registry.js";
