import { SandboxRuntimeConfig } from "@anthropic-ai/sandbox-runtime";
import { DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS } from "./types/process.js";

export type ExecutionMode = "host" | "docker";

export interface ProcessMcpConfig {
  mode: ExecutionMode;
  sandbox?: SandboxRuntimeConfig;
  docker?: {
    image: string;
    volumeName: string;
    containerName: string;
    useExisting: boolean;
  };
  defaults: {
    workdir: string;
    timeoutMs: number;
    maxTimeoutMs: number;
  };
}

function parseAllowedDomains(env?: string): string[] {
  if (!env) return ["*"];
  return env.split(",").map(h => h.trim()).filter(h => h.length > 0);
}

function parsePaths(env?: string): string[] {
  if (!env) return [];
  return env.split(",").map(p => p.trim()).filter(p => p.length > 0);
}

export function loadConfig(): ProcessMcpConfig {
  const mode = (process.env.PROCESS_MODE || "host") as ExecutionMode;

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
