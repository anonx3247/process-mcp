#!/bin/bash

# Verification script for Process MCP server
# Tests basic functionality in both modes

set -e +m  # Exit on error, disable job control messages

echo "=== Process MCP Server Verification ==="
echo ""

# Test 1: Check if build artifacts exist
echo "Test 1: Checking build artifacts..."
if [ -f "dist/index.js" ]; then
  echo "✓ Build artifacts found"
else
  echo "✗ Build artifacts not found. Run 'npm run build' first."
  exit 1
fi

# Test 2: Check if server can start in host mode
echo ""
echo "Test 2: Starting server in host mode..."
rm -f /tmp/process-mcp-test.log

# Start server with stdin kept open via sleep process
(PROCESS_MODE=host node dist/index.js 2>&1 | tee /tmp/process-mcp-test.log) < <(sleep 3) &
SERVER_PID=$!

# Wait for initialization message
for i in {1..15}; do
  sleep 0.3
  if [ -f /tmp/process-mcp-test.log ] && grep -q "Server running on stdio" /tmp/process-mcp-test.log; then
    echo "✓ Server started and initialized successfully in host mode"
    # Kill the server
    kill -TERM $SERVER_PID 2>/dev/null || true
    sleep 0.5
    kill -9 $SERVER_PID 2>/dev/null || true
    wait $SERVER_PID 2>/dev/null || true
    # Found success, break out
    break
  fi
done

# Check if we found the success message
if ! grep -q "Server running on stdio" /tmp/process-mcp-test.log 2>/dev/null; then
  echo "✗ Server failed to initialize properly"
  cat /tmp/process-mcp-test.log 2>/dev/null || echo "No log file found"
  exit 1
fi

# Test 3: Check dependencies
echo ""
echo "Test 3: Checking optional dependencies..."
if command -v rg &> /dev/null; then
  echo "✓ ripgrep (rg) found - sandbox features available"
else
  echo "⚠ ripgrep (rg) not found - running without sandbox features"
  echo "  Install with: brew install ripgrep (macOS) or apt install ripgrep (Ubuntu)"
fi

DOCKER_AVAILABLE=false
if command -v docker &> /dev/null; then
  echo "✓ docker found - docker mode available"
  DOCKER_AVAILABLE=true
else
  echo "⚠ docker not found - docker mode unavailable"
fi

# Test 4: Test Docker mode if available
if [ "$DOCKER_AVAILABLE" = true ]; then
  echo ""
  echo "Test 4: Starting server in docker mode..."
  rm -f /tmp/process-mcp-docker-test.log

  # Check if we have a compatible image
  DOCKER_IMAGE="ubuntu:22.04"
  if ! docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "^ubuntu:22.04$"; then
    # Try ubuntu:24.04
    if docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "^ubuntu:24.04$"; then
      DOCKER_IMAGE="ubuntu:24.04"
      echo "Using ubuntu:24.04 (22.04 not found locally)"
    else
      echo "⚠ No Ubuntu image found locally. First run will pull ubuntu:22.04 from Docker Hub."
      echo "  This may take a few moments..."
    fi
  fi

  # Start server with stdin kept open
  (PROCESS_MODE=docker DOCKER_IMAGE="$DOCKER_IMAGE" node dist/index.js 2>&1 | tee /tmp/process-mcp-docker-test.log) < <(sleep 3) &
  DOCKER_SERVER_PID=$!

  # Wait for initialization message
  for i in {1..15}; do
    sleep 0.3
    if [ -f /tmp/process-mcp-docker-test.log ] && grep -q "Server running on stdio" /tmp/process-mcp-docker-test.log; then
      echo "✓ Server started and initialized successfully in docker mode"

      # Check if container was created
      if docker ps | grep -q "process-mcp-main"; then
        echo "✓ Docker container created and running"
      fi

      # Kill the server
      kill -TERM $DOCKER_SERVER_PID 2>/dev/null || true
      sleep 0.5
      kill -9 $DOCKER_SERVER_PID 2>/dev/null || true
      wait $DOCKER_SERVER_PID 2>/dev/null || true

      # Cleanup container
      docker stop process-mcp-main >/dev/null 2>&1 || true
      docker rm process-mcp-main >/dev/null 2>&1 || true

      break
    fi
  done

  # Check if we found the success message
  if ! grep -q "Server running on stdio" /tmp/process-mcp-docker-test.log 2>/dev/null; then
    echo "✗ Docker mode failed to initialize properly"
    cat /tmp/process-mcp-docker-test.log 2>/dev/null || echo "No log file found"
  fi
fi

echo ""
echo "=== Verification Complete ==="
echo ""
echo "Server is ready to use!"
echo ""
echo "To start the server:"
echo "  Host mode:   PROCESS_MODE=host npm start"
echo "  Docker mode: PROCESS_MODE=docker npm start"
echo ""
echo "Available tools:"
echo "  - spawn:  Execute commands"
echo "  - ps:     List processes"
echo "  - stdin:  Send input to TTY processes"
echo "  - stdout: Get process output"
echo "  - kill:   Terminate processes"
