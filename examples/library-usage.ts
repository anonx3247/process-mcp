/**
 * Examples of using process-mcp as a library in your own Node.js applications
 */

import { createProcessMCP } from "../dist/lib.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// ============================================================================
// Example 1: Basic Host Mode Setup
// ============================================================================

export async function example1_basicHostMode() {
  console.log("Example 1: Basic Host Mode");

  // Create server with host mode (runs processes directly on host)
  const { server, executor, cleanup } = await createProcessMCP({
    mode: "host",
    defaults: {
      workdir: "/tmp",
      timeoutMs: 10000,
      maxTimeoutMs: 60000,
    },
  });

  // Connect to stdio transport (for MCP clients)
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.log("Server started in host mode");

  // Cleanup when done
  process.on("SIGINT", async () => {
    await cleanup();
    process.exit(0);
  });
}

// ============================================================================
// Example 2: Docker Mode with Custom Image
// ============================================================================

export async function example2_dockerMode() {
  console.log("Example 2: Docker Mode with Custom Image");

  const { server, executor, cleanup } = await createProcessMCP({
    mode: "docker",
    docker: {
      image: "python:3.11",
      containerName: "my-python-env",
      volumeName: "my-python-volume",
      useExisting: false,
    },
    defaults: {
      workdir: "/workspace",
      timeoutMs: 10000,
      maxTimeoutMs: 60000,
    },
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.log("Server started in docker mode with Python 3.11");

  process.on("SIGINT", async () => {
    await cleanup();
    process.exit(0);
  });
}

// ============================================================================
// Example 3: Using Existing Docker Container
// ============================================================================

export async function example3_existingContainer() {
  console.log("Example 3: Using Existing Docker Container");

  // First, ensure your container exists and is running:
  // docker run -d --name my-dev-env -v my-volume:/workspace ubuntu:22.04 tail -f /dev/null

  const { server, executor, cleanup } = await createProcessMCP({
    mode: "docker",
    docker: {
      image: "ubuntu:22.04", // Only used if container doesn't exist
      containerName: "my-dev-env",
      volumeName: "my-volume",
      useExisting: true, // Use existing container
    },
    defaults: {
      workdir: "/workspace",
      timeoutMs: 10000,
      maxTimeoutMs: 60000,
    },
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.log("Server using existing container: my-dev-env");

  process.on("SIGINT", async () => {
    await cleanup();
    process.exit(0);
  });
}

// ============================================================================
// Example 4: Direct Executor Usage (without MCP server)
// ============================================================================

export async function example4_directExecutorUsage() {
  console.log("Example 4: Direct Executor Usage");

  // Create server to get executor
  const { executor, cleanup } = await createProcessMCP({
    mode: "host",
    defaults: {
      workdir: "/tmp",
      timeoutMs: 5000,
      maxTimeoutMs: 60000,
    },
  });

  // Use executor directly without MCP protocol
  console.log("Spawning a process...");
  const spawnResult = await executor.spawn({
    command: "echo 'Hello from direct executor!'",
  });

  if (spawnResult.success) {
    console.log("Process output:", spawnResult.value.stdout);
  } else {
    console.error("Error:", spawnResult.message);
  }

  // List all processes
  const processes = executor.listProcesses();
  console.log("Active processes:", processes);

  // Cleanup
  await cleanup();
}

// ============================================================================
// Example 5: Custom HTTP Server with Process MCP
// ============================================================================

export async function example5_customHttpServer() {
  console.log("Example 5: Custom HTTP Server Integration");

  // Note: This is a conceptual example
  // You would integrate with your own HTTP framework

  const { executor, cleanup } = await createProcessMCP({
    mode: "host",
    defaults: {
      workdir: "/tmp",
      timeoutMs: 10000,
      maxTimeoutMs: 60000,
    },
  });

  // Example REST API endpoint handlers
  const handlers = {
    spawn: async (req: any) => {
      const result = await executor.spawn({
        command: req.body.command,
        cwd: req.body.cwd,
        tty: req.body.tty,
        background: req.body.background,
      });
      return result;
    },

    listProcesses: async () => {
      return executor.listProcesses();
    },

    getOutput: async (req: any) => {
      return executor.getOutput(req.params.pid, req.query.lines);
    },

    kill: async (req: any) => {
      return executor.kill(req.params.pid, req.body.signal);
    },
  };

  console.log("HTTP handlers created - integrate with your framework");

  // Cleanup
  process.on("SIGINT", async () => {
    await cleanup();
    process.exit(0);
  });

  return handlers;
}

// ============================================================================
// Example 6: With Sandbox Configuration
// ============================================================================

export async function example6_sandboxConfig() {
  console.log("Example 6: Host Mode with Sandbox Configuration");

  const { server, executor, cleanup } = await createProcessMCP({
    mode: "host",
    sandbox: {
      network: {
        allowedDomains: ["github.com", "api.github.com"],
        deniedDomains: [],
      },
      filesystem: {
        allowWrite: ["/tmp", "/workspace"],
        denyRead: ["/etc/shadow", "/root"],
        denyWrite: ["/etc", "/usr", "/bin"],
      },
    },
    defaults: {
      workdir: "/tmp",
      timeoutMs: 10000,
      maxTimeoutMs: 60000,
    },
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.log("Server started with sandbox restrictions");

  process.on("SIGINT", async () => {
    await cleanup();
    process.exit(0);
  });
}

// ============================================================================
// Run Examples
// ============================================================================

// Uncomment to run specific examples:

// example1_basicHostMode();
// example2_dockerMode();
// example3_existingContainer();
// example4_directExecutorUsage();
// example5_customHttpServer();
// example6_sandboxConfig();
