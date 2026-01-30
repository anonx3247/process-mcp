/**
 * Configuration and mode selection
 */

import { SandboxRuntimeConfig } from "@anthropic-ai/sandbox-runtime";
import { DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS } from "./types/process.js";

export type ExecutionMode = "host" | "docker";

export interface ProcessMcpConfig {
  /** Execution mode */
  mode: ExecutionMode;

  /** Sandbox configuration (for host mode) */
  sandbox?: SandboxRuntimeConfig;

  /** Docker configuration (for docker mode) */
  docker?: {
    image: string;
    volumeName: string;
    containerName: string;
    useExisting: boolean;
  };

  /** Default settings */
  defaults: {
    workdir: string;
    timeoutMs: number;
    maxTimeoutMs: number;
  };
}

/**
 * Parse allowed domains from environment variable
 */
function parseAllowedDomains(env?: string): string[] {
  if (!env) return ["*"];
  return env.split(",").map(h => h.trim()).filter(h => h.length > 0);
}

/**
 * Parse file paths from environment variable
 */
function parsePaths(env?: string): string[] {
  if (!env) return [];
  return env.split(",").map(p => p.trim()).filter(p => p.length > 0);
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): ProcessMcpConfig {
  const mode = (process.env.PROCESS_MODE || "host") as ExecutionMode;

  // Default sandbox config for host mode
  const defaultSandboxConfig: SandboxRuntimeConfig = {
    network: {
      allowedDomains: parseAllowedDomains(process.env.SANDBOX_ALLOWED_DOMAINS),
      deniedDomains: [],
    },
    filesystem: {
      allowWrite: [
        "/tmp",
        "/home/agent",
        process.cwd(),
        ...parsePaths(process.env.SANDBOX_ALLOW_WRITE),
      ],
      denyRead: parsePaths(process.env.SANDBOX_DENY_READ),
      denyWrite: parsePaths(process.env.SANDBOX_DENY_WRITE),
    },
  };

  // Default Docker config
  const defaultDockerConfig = {
    image: process.env.DOCKER_IMAGE || "ubuntu:22.04",
    volumeName: process.env.DOCKER_VOLUME || "process-mcp-volume",
    containerName: process.env.DOCKER_CONTAINER || "process-mcp-main",
    useExisting: process.env.DOCKER_USE_EXISTING === "true",
  };

  return {
    mode,
    sandbox: mode === "host" ? defaultSandboxConfig : undefined,
    docker: mode === "docker" ? defaultDockerConfig : undefined,
    defaults: {
      workdir: process.env.DEFAULT_WORKDIR || "/home/agent",
      timeoutMs: DEFAULT_TIMEOUT_MS,
      maxTimeoutMs: MAX_TIMEOUT_MS,
    },
  };
}
