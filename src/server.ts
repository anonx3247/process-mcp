import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ProcessMcpConfig } from "./config.js";
import { HostExecutor } from "./executors/host-executor.js";
import { DockerExecutor } from "./executors/docker-executor.js";
import { ProcessExecutor } from "./executors/interface.js";
import {
  toolDefinitions,
  handleSpawn,
  handlePs,
  handleStdin,
  handleStdout,
  handleKill,
  spawnSchema,
  psSchema,
  stdinSchema,
  stdoutSchema,
  killSchema,
} from "./tools/definitions.js";
import { errorToCallToolResult } from "./lib/mcp.js";

export interface ProcessMcpServer {
  server: Server;
  executor: ProcessExecutor;
  cleanup: () => Promise<void>;
}

/**
 * Create and initialize a Process MCP server
 *
 * @param config - Server configuration
 * @returns Initialized server with executor and cleanup function
 *
 * @example
 * ```typescript
 * import { createProcessMCP } from 'process-mcp';
 *
 * // Host mode
 * const { server, executor, cleanup } = await createProcessMCP({
 *   mode: 'host',
 *   defaults: { workdir: '/tmp' }
 * });
 *
 * // Docker mode
 * const { server, executor, cleanup } = await createProcessMCP({
 *   mode: 'docker',
 *   docker: {
 *     image: 'ubuntu:22.04',
 *     containerName: 'my-container',
 *     volumeName: 'my-volume',
 *     useExisting: false
 *   }
 * });
 *
 * // Connect to transport
 * await server.connect(transport);
 *
 * // When done
 * await cleanup();
 * ```
 */
export async function createProcessMCP(config: ProcessMcpConfig): Promise<ProcessMcpServer> {
  // Create executor based on mode
  let executor: ProcessExecutor;
  if (config.mode === "docker") {
    executor = new DockerExecutor(config);
  } else {
    executor = new HostExecutor(config);
  }

  // Initialize executor
  const initResult = await executor.initialize();
  if (!initResult.success) {
    throw new Error(`Executor initialization failed: ${initResult.message}`);
  }

  // Create MCP server
  const server = new Server(
    {
      name: "process-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: z.toJSONSchema(tool.inputSchema),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "spawn": {
          const parsed = spawnSchema.parse(args);
          return await handleSpawn(executor, parsed);
        }
        case "ps": {
          const parsed = psSchema.parse(args);
          return await handlePs(executor, parsed);
        }
        case "stdin": {
          const parsed = stdinSchema.parse(args);
          return await handleStdin(executor, parsed);
        }
        case "stdout": {
          const parsed = stdoutSchema.parse(args);
          return await handleStdout(executor, parsed);
        }
        case "kill": {
          const parsed = killSchema.parse(args);
          return await handleKill(executor, parsed);
        }
        default:
          return errorToCallToolResult(
            "unknown_tool",
            `Unknown tool: ${name}`
          );
      }
    } catch (error) {
      if (error instanceof Error) {
        return errorToCallToolResult(
          "tool_error",
          `Tool execution failed: ${error.message}`,
          error
        );
      }
      return errorToCallToolResult(
        "tool_error",
        "Tool execution failed with unknown error"
      );
    }
  });

  // Cleanup function
  const cleanup = async () => {
    await executor.cleanup();
  };

  return {
    server,
    executor,
    cleanup,
  };
}
