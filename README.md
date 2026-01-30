# Process MCP Server

An MCP (Model Context Protocol) server and library that provides process management capabilities with two execution modes:

1. **Host mode**: Executes processes directly on the host system with sandboxing via `@anthropic-ai/sandbox-runtime`
2. **Docker mode**: Executes processes in an isolated Docker container

**Use as:**
- 🔌 **MCP Server** - Standalone server for Claude Desktop and other MCP clients
- 📦 **Library** - Import into your Node.js applications with `createProcessMCP()`

The server exposes 5 MCP tools for spawning, monitoring, and controlling long-running processes, with support for interactive TTY sessions, stdin/stdout/stderr handling, and background execution.

## Features

- Dual execution modes (host/docker)
- TTY support for interactive applications (vim, python REPL, etc.)
- Background process execution
- Automatic timeout handling
- Stdin interaction with escape sequence parsing
- Output buffering with configurable limits
- Process registry with cleanup
- Security sandboxing (host mode) or container isolation (docker mode)

## Installation

### As a Standalone MCP Server

```bash
git clone <repository-url>
cd process-mcp
npm install
npm run build
```

### As a Library in Your Project

```bash
npm install process-mcp
```

Or if installing from a local directory:
```bash
npm install /path/to/process-mcp
```

### Optional Dependencies

For host mode with sandboxing enabled:
- **ripgrep**: Required for sandbox-runtime file system monitoring
  ```bash
  # macOS
  brew install ripgrep

  # Ubuntu/Debian
  apt install ripgrep

  # Other systems
  # See: https://github.com/BurntSushi/ripgrep#installation
  ```

If ripgrep is not installed, the server will run without sandboxing features but processes will still execute normally.

## Usage

### Library Usage

You can use process-mcp as a library in your own Node.js applications:

```typescript
import { createProcessMCP } from 'process-mcp';

// Create server with host mode
const { server, executor, cleanup } = await createProcessMCP({
  mode: 'host',
  defaults: {
    workdir: '/tmp',
    timeoutMs: 10000,
    maxTimeoutMs: 60000,
  },
});

// Option 1: Use with MCP protocol
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
const transport = new StdioServerTransport();
await server.connect(transport);

// Option 2: Use executor directly (without MCP protocol)
const result = await executor.spawn({
  command: 'echo "Hello World"',
  cwd: '/tmp',
  background: false,
});

if (result.success) {
  console.log(result.value.stdout);
}

// List processes
const processes = executor.listProcesses();

// Get output
const output = executor.getOutput(pid, 100);

// Kill process
await executor.kill(pid, 'SIGTERM');

// Cleanup when done
await cleanup();
```

**Docker Mode Example:**

```typescript
const { server, executor, cleanup } = await createProcessMCP({
  mode: 'docker',
  docker: {
    image: 'python:3.11',
    containerName: 'my-container',
    volumeName: 'my-volume',
    useExisting: false,
  },
  defaults: {
    workdir: '/workspace',
    timeoutMs: 10000,
    maxTimeoutMs: 60000,
  },
});
```

**See `examples/` directory for more usage examples:**
- `examples/simple-example.js` - Basic usage
- `examples/library-usage.ts` - Comprehensive examples including HTTP server integration

### Standalone Server

#### Host Mode (Default)

```bash
PROCESS_MODE=host npm start
```

Host mode uses `@anthropic-ai/sandbox-runtime` for OS-level sandboxing. Configure security restrictions via environment variables:

- `SANDBOX_ALLOWED_DOMAINS`: Comma-separated list of allowed network domains (default: `*` for all)
- `SANDBOX_ALLOW_WRITE`: Additional paths for write access
- `SANDBOX_DENY_READ`: Paths to block reads
- `SANDBOX_DENY_WRITE`: Paths to block writes

Example:
```bash
PROCESS_MODE=host \
SANDBOX_ALLOWED_DOMAINS="github.com,api.openai.com" \
SANDBOX_DENY_READ="/etc/shadow,/root" \
npm start
```

#### Docker Mode

```bash
PROCESS_MODE=docker npm start
```

Docker mode creates a single long-running container and executes all processes via `docker exec`.

**Important**: Docker mode uses **existing Docker images** - no Dockerfile is required by default. The server will pull the specified image from Docker Hub if not available locally.

**Configuration via environment variables:**
- `DOCKER_IMAGE`: Docker image to use (default: `ubuntu:22.04`)
- `DOCKER_VOLUME`: Volume name for persistence (default: `process-mcp-volume`)
- `DOCKER_CONTAINER`: Container name (default: `process-mcp-main`)
- `DOCKER_USE_EXISTING`: Use existing container instead of creating new one (default: `false`)

**Using different images:**
```bash
# Python environment
PROCESS_MODE=docker DOCKER_IMAGE="python:3.11" npm start

# Node.js environment
PROCESS_MODE=docker DOCKER_IMAGE="node:20" npm start

# Alpine Linux (smaller)
PROCESS_MODE=docker DOCKER_IMAGE="alpine:latest" npm start
```

**Custom Image (Optional)**

If you want a pre-configured environment with additional tools, build the included Dockerfile:

```bash
# Build custom image
docker build -t process-mcp:custom .

# Use custom image
PROCESS_MODE=docker DOCKER_IMAGE="process-mcp:custom" npm start
```

The custom image includes:
- Ubuntu 22.04 base
- Python 3, pip, venv
- Node.js 20.x
- Git, vim, curl, wget
- Build tools (gcc, make, etc.)
- Common utilities (htop, jq, tree)

**Using an Existing Container**

If you already have a running container with your desired environment and volumes, you can use it directly:

```bash
# First, ensure your container is running
docker run -d \
  --name my-dev-container \
  -v my-project:/workspace \
  -w /workspace \
  ubuntu:22.04 \
  tail -f /dev/null

# Then point process-mcp to use it
PROCESS_MODE=docker \
DOCKER_USE_EXISTING=true \
DOCKER_CONTAINER=my-dev-container \
npm start
```

**Benefits of using existing containers:**
- Preserve existing environment setup (installed packages, configurations)
- Share volumes with other tools/processes
- Reuse containers from docker-compose or other orchestration
- Maintain state between server restarts

**Note**: When `DOCKER_USE_EXISTING=true`, the server will:
- Use the existing container without modification
- Start it if stopped
- Fail with an error if the container doesn't exist
- Never create, remove, or modify the container (you maintain full control)

**Quick Start**: See `example-custom-container.sh` for a complete example of creating and using a custom container.

### MCP Client Configuration

To use this server with an MCP client (like Claude Desktop), add it to your MCP configuration file:

```json
{
  "mcpServers": {
    "process": {
      "command": "node",
      "args": ["/absolute/path/to/process-mcp/dist/index.js"],
      "env": {
        "PROCESS_MODE": "host"
      }
    }
  }
}
```

See `mcp-config-example.json` for more configuration examples including Docker mode.

**Common MCP client configuration locations:**
- Claude Desktop (macOS): `~/Library/Application Support/Claude/claude_desktop_config.json`
- Claude Desktop (Windows): `%APPDATA%\Claude\claude_desktop_config.json`

## Library API

### Main Export

#### `createProcessMCP(config: ProcessMcpConfig): Promise<ProcessMcpServer>`

Creates and initializes a Process MCP server.

**Returns:**
```typescript
{
  server: Server;        // MCP server instance
  executor: ProcessExecutor; // Process executor
  cleanup: () => Promise<void>; // Cleanup function
}
```

### Configuration Types

```typescript
interface ProcessMcpConfig {
  mode: 'host' | 'docker';

  // Sandbox config (host mode only)
  sandbox?: {
    network: {
      allowedDomains: string[];
      deniedDomains: string[];
    };
    filesystem: {
      allowWrite: string[];
      denyRead: string[];
      denyWrite: string[];
    };
  };

  // Docker config (docker mode only)
  docker?: {
    image: string;
    containerName: string;
    volumeName: string;
    useExisting: boolean;
  };

  // Default settings
  defaults: {
    workdir: string;
    timeoutMs: number;
    maxTimeoutMs: number;
  };
}
```

### Executor Methods

```typescript
interface ProcessExecutor {
  // Spawn a process
  spawn(options: SpawnOptions): Promise<Result<SpawnResult>>;

  // Send input to TTY process
  stdin(pid: string, input: string): Promise<Result<void>>;

  // Get process by PID
  getProcess(pid: string): Result<Process>;

  // List all processes
  listProcesses(): ProcessInfo[];

  // Get process output
  getOutput(pid: string, lines?: number): Result<{ stdout: string; stderr: string }>;

  // Kill process
  kill(pid: string, signal?: string): Promise<Result<void>>;

  // Cleanup
  cleanup(): Promise<void>;
}
```

### Other Exports

```typescript
// Load config from environment
import { loadConfig } from 'process-mcp/config';

// Executor implementations
import { HostExecutor, DockerExecutor } from 'process-mcp';

// Types
import type {
  ProcessMcpConfig,
  ProcessExecutor,
  Process,
  SpawnOptions,
  ProcessInfo,
  SpawnResult,
  Result,
} from 'process-mcp';

// Constants
import {
  DEFAULT_TIMEOUT_MS,  // 10000
  MAX_TIMEOUT_MS,      // 60000
  OUTPUT_TRUNCATE,     // 8196
  TERMINAL_COLS,       // 120
  TERMINAL_ROWS,       // 30
} from 'process-mcp';
```

## MCP Tools

### 1. spawn

Execute a command with optional timeout. Processes exceeding timeout automatically move to background.

**Parameters:**
- `command` (string, required): The command to execute
- `cwd` (string, optional): Working directory (default: `/home/agent`)
- `env` (object, optional): Environment variables
- `tty` (boolean, optional): Enable TTY mode for interactive applications
- `background` (boolean, optional): Run in background (bypass timeout)
- `timeoutMs` (number, optional): Timeout in milliseconds (default: 10000, max: 60000)

**Returns:**
- `pid`: Process ID
- `status`: "running" or "terminated"
- `exitCode`: Exit code (if terminated)
- `stdout`: Stdout output (truncated to 8196 chars)
- `stderr`: Stderr output (truncated to 8196 chars)

**Example:**
```json
{
  "command": "python -c 'print(\"hello\")'",
  "tty": false,
  "timeoutMs": 5000
}
```

### 2. ps

List all running and recently terminated processes.

**Returns:** Array of process info objects with:
- `pid`: Process ID
- `command`: Command that was executed
- `status`: "running" or "terminated"
- `exitCode`: Exit code (if terminated)
- `cwd`: Working directory
- `tty`: Whether TTY mode is enabled
- `createdAt`: Creation timestamp

### 3. stdin

Send input to an interactive process (TTY mode only).

**Parameters:**
- `id` (string, required): Process ID
- `input` (string, required): Input to send

**Escape sequences:**
- `\n`: Newline
- `\r`: Carriage return
- `\t`: Tab
- `\xHH`: Hex byte (e.g., `\x03` for Ctrl-C)
- `\uHHHH`: Unicode character

**Example:**
```json
{
  "id": "host-1",
  "input": "print('test')\\n"
}
```

### 4. stdout

View process output. Returns stdout and stderr (or terminal buffer for TTY processes).

**Parameters:**
- `id` (string, required): Process ID
- `lines` (number, optional): Number of lines to retrieve (default: 100)

**Returns:**
- `stdout`: Stdout output (last N lines)
- `stderr`: Stderr output (last N lines)

### 5. kill

Terminate a process with a signal.

**Parameters:**
- `id` (string, required): Process ID
- `signal` (string, optional): Signal to send (default: `SIGTERM`)

Common signals:
- `SIGTERM`: Graceful termination
- `SIGKILL`: Force kill
- `SIGINT`: Interrupt (Ctrl-C)

## Architecture

```
MCP Server (5 tools: spawn, ps, stdin, stdout, kill)
    ↓
Mode Selection (ENV: PROCESS_MODE=host|docker)
    ↓
ProcessExecutor Interface
    ↓
Host Mode              Docker Mode
(child_process,        (dockerode,
 @anthropic-ai/        single shared
 sandbox-runtime)      container)
```

## Development

```bash
# Build
npm run build

# Type check
npm run typecheck

# Run in development (CLI mode)
npm run dev

# Test library functionality
node examples/test-library.js

# Run simple example
node examples/simple-example.js

# Verify installation
bash verify.sh
```

### Publishing as a Package

To publish this to npm or use it as a local dependency:

```bash
# Build the package
npm run build

# Publish to npm (requires npm account)
npm publish

# Or install locally in another project
cd /path/to/your-project
npm install /path/to/process-mcp
```

Then use in your project:

```typescript
import { createProcessMCP } from 'process-mcp';
```

## Docker Mode Implementation Details

- **No Dockerfile required** - uses existing Docker images (ubuntu:22.04 by default)
- Single long-running container (`tail -f /dev/null`)
- Each process spawned via `docker exec`
- Container configuration:
  - 512MB RAM limit
  - 1 vCPU
  - 4096 PID limit
  - Unprivileged mode
  - Tmpfs for `/tmp` and `/var/tmp` (100MB, noexec)
- Volume persistence for working directory (`process-mcp-volume:/home/agent`)
- Automatic container reuse (existing containers are restarted)
- Automatic cleanup on server shutdown
- PID extraction via command wrapping: `echo "PID:$$" >&2 && command`

## Host Mode Implementation Details

- Uses `@anthropic-ai/sandbox-runtime` for security
- Process spawning via `child_process.spawn()`
- TTY support via pipes and `@xterm/headless` Terminal
- Configurable filesystem and network restrictions
- Automatic sandboxing of all commands

## Security Considerations

### Host Mode
- Commands wrapped with sandbox restrictions
- Filesystem access controlled via allowlists/denylists
- Network access filtered by domain
- Processes run with minimal permissions

### Docker Mode
- Containers run unprivileged
- Resource limits enforced
- No capability additions
- Tmpfs with noexec for temporary directories

## Project Status

The server has been fully implemented according to the plan:

- ✅ Host mode with optional sandboxing
- ✅ Docker mode with container isolation
- ✅ 5 MCP tools (spawn, ps, stdin, stdout, kill)
- ✅ TTY support for interactive applications
- ✅ Background process execution
- ✅ Timeout handling
- ✅ Process registry with cleanup
- ✅ Comprehensive error handling

### Verification

Run the verification script to ensure everything is working:

```bash
bash verify.sh
```

## License

ISC
