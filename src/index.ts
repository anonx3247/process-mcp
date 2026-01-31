#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createProcessMCP } from "./server.js";

async function main() {
  // Load configuration from environment
  const config = loadConfig();

  console.error(`[Process MCP] Starting in ${config.mode} mode`);

  // Create server
  const { server, cleanup } = await createProcessMCP(config);

  console.error("[Process MCP] Executor initialized successfully");

  // Setup cleanup handlers
  const handleShutdown = async () => {
    console.error("[Process MCP] Cleaning up...");
    await cleanup();
    process.exit(0);
  };

  process.on("SIGINT", handleShutdown);
  process.on("SIGTERM", handleShutdown);

  // Connect transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[Process MCP] Server running on stdio");
}

main().catch((error) => {
  console.error("[Process MCP] Fatal error:", error);
  process.exit(1);
});
