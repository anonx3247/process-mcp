/**
 * Simple test client for the Process MCP server
 */

import { spawn } from "child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  console.log("Starting Process MCP server...");

  // Spawn the server
  const serverProcess = spawn("node", ["dist/index.js"], {
    env: { ...process.env, PROCESS_MODE: "host" },
  });

  // Create client transport
  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/index.js"],
    env: { ...process.env, PROCESS_MODE: "host" },
  });

  // Create client
  const client = new Client(
    {
      name: "test-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  // Connect to server
  await client.connect(transport);
  console.log("Connected to server");

  // List tools
  const toolsResult = await client.listTools();
  console.log("\nAvailable tools:");
  toolsResult.tools.forEach((tool) => {
    console.log(`  - ${tool.name}: ${tool.description}`);
  });

  // Test spawn tool
  console.log("\nTest 1: Spawning 'echo hello world'");
  const spawnResult = await client.callTool({
    name: "spawn",
    arguments: {
      command: "echo 'hello world'",
    },
  });
  console.log("Result:", JSON.stringify(spawnResult, null, 2));

  // Test ps tool
  console.log("\nTest 2: Listing processes");
  const psResult = await client.callTool({
    name: "ps",
    arguments: {},
  });
  console.log("Result:", JSON.stringify(psResult, null, 2));

  // Test spawn with background
  console.log("\nTest 3: Spawning background process 'sleep 5'");
  const bgResult = await client.callTool({
    name: "spawn",
    arguments: {
      command: "sleep 5",
      background: true,
    },
  });
  console.log("Result:", JSON.stringify(bgResult, null, 2));

  // Extract PID from result
  const bgContent = bgResult.content[0];
  if (bgContent.type === "text") {
    const bgData = JSON.parse(bgContent.text);
    const bgPid = bgData.pid;
    console.log(`Background process PID: ${bgPid}`);

    // Test stdout tool
    console.log("\nTest 4: Getting stdout for background process");
    const stdoutResult = await client.callTool({
      name: "stdout",
      arguments: {
        id: bgPid,
      },
    });
    console.log("Result:", JSON.stringify(stdoutResult, null, 2));

    // Test kill tool
    console.log("\nTest 5: Killing background process");
    const killResult = await client.callTool({
      name: "kill",
      arguments: {
        id: bgPid,
        signal: "SIGTERM",
      },
    });
    console.log("Result:", JSON.stringify(killResult, null, 2));
  }

  // Close client
  await client.close();
  console.log("\nTests completed!");
  process.exit(0);
}

main().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
