#!/bin/bash

# Manual test script for Process MCP server
# This script sends JSON-RPC requests to the server via stdio

set -e

echo "Starting Process MCP server in host mode..."

# Start server in background
PROCESS_MODE=host node dist/index.js &
SERVER_PID=$!

# Give server time to start
sleep 2

# Function to send JSON-RPC request
send_request() {
  local method=$1
  local params=$2
  local id=$3

  echo '{"jsonrpc":"2.0","method":"'$method'","params":'$params',"id":'$id'}' | nc localhost 3000 || echo "Request sent to stdin"
}

# Cleanup function
cleanup() {
  echo "Cleaning up..."
  kill $SERVER_PID 2>/dev/null || true
  exit 0
}

trap cleanup EXIT INT TERM

# Keep server running
wait $SERVER_PID
