# Process MCP Library Examples

This directory contains examples of using `process-mcp` as a library in your own Node.js applications.

## Quick Start

### Simple Example (JavaScript)

The simplest way to get started:

```bash
node examples/simple-example.js
```

This example shows:
- Creating a process executor
- Running commands
- Listing processes
- Managing background processes
- Killing processes
- Cleanup

### Comprehensive Examples (TypeScript)

See `library-usage.ts` for detailed examples including:

1. **Basic Host Mode** - Run processes directly on the host
2. **Docker Mode** - Run processes in Docker containers
3. **Existing Containers** - Use pre-configured Docker containers
4. **Direct Executor Usage** - Use the executor without MCP protocol
5. **HTTP Server Integration** - Integrate with custom HTTP servers
6. **Sandbox Configuration** - Configure filesystem and network restrictions

## Running TypeScript Examples

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run with tsx
npx tsx examples/library-usage.ts
```

## Integration Patterns

### Pattern 1: MCP Server

Use as a standard MCP server with stdio transport:

```typescript
import { createProcessMCP } from 'process-mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const { server, cleanup } = await createProcessMCP({ mode: 'host' });
const transport = new StdioServerTransport();
await server.connect(transport);
```

### Pattern 2: Direct Executor

Use the executor directly without MCP protocol:

```typescript
import { createProcessMCP } from 'process-mcp';

const { executor, cleanup } = await createProcessMCP({ mode: 'host' });

// Use executor methods directly
const result = await executor.spawn({ command: 'ls -la' });
const processes = executor.listProcesses();
```

### Pattern 3: Custom Transport

Use with a custom transport (HTTP, WebSocket, etc.):

```typescript
import { createProcessMCP } from 'process-mcp';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

const { server, cleanup } = await createProcessMCP({ mode: 'docker' });
const transport = new SSEServerTransport('/message', response);
await server.connect(transport);
```

## Configuration Examples

### Host Mode with Sandbox

```typescript
const { server, executor, cleanup } = await createProcessMCP({
  mode: 'host',
  sandbox: {
    network: {
      allowedDomains: ['github.com', '*.npmjs.org'],
      deniedDomains: [],
    },
    filesystem: {
      allowWrite: ['/tmp', '/workspace'],
      denyRead: ['/etc/shadow'],
      denyWrite: ['/etc', '/usr'],
    },
  },
  defaults: {
    workdir: '/workspace',
    timeoutMs: 10000,
    maxTimeoutMs: 60000,
  },
});
```

### Docker Mode with Custom Image

```typescript
const { server, executor, cleanup } = await createProcessMCP({
  mode: 'docker',
  docker: {
    image: 'node:20',
    containerName: 'my-node-env',
    volumeName: 'my-node-volume',
    useExisting: false,
  },
  defaults: {
    workdir: '/app',
    timeoutMs: 10000,
    maxTimeoutMs: 60000,
  },
});
```

### Using Existing Container

```typescript
// First create your container with specific configuration
// docker run -d --name dev-env -v my-vol:/workspace ubuntu:22.04 tail -f /dev/null

const { server, executor, cleanup } = await createProcessMCP({
  mode: 'docker',
  docker: {
    image: 'ubuntu:22.04', // Not used when useExisting=true
    containerName: 'dev-env',
    volumeName: 'my-vol',
    useExisting: true, // Use existing container
  },
  defaults: {
    workdir: '/workspace',
    timeoutMs: 10000,
    maxTimeoutMs: 60000,
  },
});
```

## Tips

1. **Always call cleanup()** - Ensures proper resource cleanup and container management
2. **Use background: true** - For long-running processes that shouldn't block
3. **TTY mode** - Required for interactive applications (vim, python REPL, etc.)
4. **Error handling** - Check `result.success` before accessing `result.value`
5. **Environment variables** - Can be loaded via `loadConfig()` or passed directly

## Need Help?

- Check the main [README.md](../README.md) for full API documentation
- See [library-usage.ts](./library-usage.ts) for comprehensive examples
- Run [simple-example.js](./simple-example.js) for a quick demo
