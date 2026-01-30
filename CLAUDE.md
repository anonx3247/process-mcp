# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server that provides process management capabilities with two execution modes:

1. **Docker mode**: Executes processes in isolated Docker containers (based on msrchd's computer implementation)
2. **Host mode**: Executes processes directly on the host system (based on srchd's process implementation)

The server exposes MCP tools for spawning, monitoring, and controlling long-running processes, with support for interactive TTY sessions, stdin/stdout/stderr handling, and background execution.

## Architecture

### Core Components

**Execution Modes**:
- Docker mode uses `dockerode` to manage containerized process execution
- Host mode uses Node.js `child_process` for direct system execution
- Both modes implement a common interface for process lifecycle management

**Process Management**:
- Process tracking with unique PIDs
- Status monitoring (running/terminated)
- Output buffering (stdout/stderr)
- TTY/interactive terminal support
- Background process execution with timeout handling

**MCP Tools** (5 tools exposed):
1. `spawn` - Execute commands, with automatic backgrounding on timeout
2. `ps` - List all running and recently terminated processes
3. `stdin` - Send input to interactive processes (TTY mode only)
4. `stdout` - View process output tail
5. `kill` - Terminate processes with signal support

### Docker Mode Implementation Details

Based on `~/dev/msrchd/src/computer/index.ts`:
- Uses `dockerode` for container management
- Container naming: `process-mcp-{id}`
- Volume persistence: `process-mcp-volume-{id}`
- Resource limits: 512MB RAM, 1 vCPU, 4096 PID limit
- Security: unprivileged containers, tmpfs for /tmp and /var/tmp
- Default working directory: `/home/agent`
- Uses `docker.createContainer()` with proper HostConfig
- Implements container reuse and cleanup
- File copying via tar streams (putArchive/getArchive)

### Host Mode Implementation Details

Based on `~/dev/srchd/src/tools/process.ts`:
- Direct `child_process.spawn()` usage
- TTY support via `node-pty` for interactive sessions
- Terminal buffer management for TTY processes
- Process registry for tracking active processes
- Timeout handling with automatic backgrounding
- Environment variable and working directory support

### Key Differences from Source Implementations

1. **No Kubernetes**: Replace k8s pod management with Docker containers
2. **Dual-mode support**: Single codebase supporting both Docker and host execution
3. **Mode selection**: Configuration or per-request mode selection
4. **Simplified**: Remove experiment/agent resource abstractions from srchd

## Common Development Commands

Since this is a new project, initial setup commands will include:

```bash
# Initialize Node.js project
npm init -y

# Install core dependencies
npm install @modelcontextprotocol/sdk dockerode zod node-pty tar-stream

# Install dev dependencies
npm install -D typescript @types/node @types/dockerode tsx

# Build
npm run build

# Run in development
npm run dev

# Type checking
npm run typecheck
```

## Implementation Guidelines

### Process Interface

Both Docker and host modes should implement a common `ProcessHandle` interface:

```typescript
interface ProcessHandle {
  pid: string;
  status: 'running' | 'terminated';
  exitCode?: number;
  stdout: string;
  stderr: string;
  command: string;
  cwd: string;
  env: Record<string, string>;
  tty: boolean;
  createdAt: Date;
  terminal?: any; // For TTY processes
  getTerminalBuffer(): string;
}
```

### Error Handling

Use Result types (ok/err pattern) from the source implementations:
- `err(code, message, cause?)` for errors
- `ok(value)` for success
- `Result<T>` return types for all fallible operations

### TTY Support

- TTY mode required for interactive applications (vim, htop, python REPL)
- Only TTY processes can receive stdin input
- Terminal buffer rendering without ANSI escape codes
- Control sequences (Ctrl-C, ESC, arrows) only work in TTY mode

### Timeout Behavior

- Default timeout: 10 seconds
- Max timeout: 60 seconds
- Processes exceeding timeout automatically move to background
- `background: true` bypasses timeout entirely

### Output Truncation

- Stdout/stderr truncated to 8196 characters in spawn responses
- Full output available via `stdout` tool
- `stdout` tool supports configurable line limits (default: 100 lines)

### Docker Container Lifecycle

- Containers created on-demand per process
- Resource limits enforced via HostConfig
- Containers removed after process termination
- Volumes persist between container recreations
- Container names must be unique and predictable

### Security Considerations

- Docker containers run unprivileged
- Proper user namespace remapping (1000:100000:65536)
- No capability additions
- tmpfs with noexec for temporary directories
- Host mode should validate command injection risks

## Reference Files

Source implementations to reference during development:
- Process MCP server: `~/dev/srchd/src/tools/process.ts`
- Docker computer: `~/dev/msrchd/src/computer/index.ts`
- Image building: `~/dev/msrchd/src/computer/image.ts`
