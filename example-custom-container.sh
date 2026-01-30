#!/bin/bash

# Example script showing how to create and use a custom container
# with process-mcp

set -e

echo "=== Creating Custom Container for Process MCP ==="
echo ""

# Container configuration
CONTAINER_NAME="my-process-mcp-container"
VOLUME_NAME="my-process-mcp-volume"
IMAGE="ubuntu:22.04"

# Check if container already exists
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Container '$CONTAINER_NAME' already exists."
  read -p "Remove and recreate? (y/N): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Stopping and removing existing container..."
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
  else
    echo "Using existing container."
    exit 0
  fi
fi

echo ""
echo "Step 1: Creating Docker volume '$VOLUME_NAME'..."
docker volume create "$VOLUME_NAME"

echo ""
echo "Step 2: Creating container '$CONTAINER_NAME'..."
docker run -d \
  --name "$CONTAINER_NAME" \
  -v "${VOLUME_NAME}:/workspace" \
  -w /workspace \
  "$IMAGE" \
  tail -f /dev/null

echo ""
echo "Step 3: Installing additional tools in container..."
docker exec "$CONTAINER_NAME" bash -c "
  apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    git \
    curl \
    vim \
    && rm -rf /var/lib/apt/lists/*
"

echo ""
echo "Step 4: Creating test file in volume..."
docker exec "$CONTAINER_NAME" bash -c "
  echo 'Hello from custom container!' > /workspace/test.txt
  echo 'Container is ready for process-mcp' >> /workspace/test.txt
"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Container Details:"
echo "  Name:   $CONTAINER_NAME"
echo "  Volume: $VOLUME_NAME"
echo "  Image:  $IMAGE"
echo ""
echo "To use with process-mcp:"
echo ""
echo "  PROCESS_MODE=docker \\"
echo "  DOCKER_USE_EXISTING=true \\"
echo "  DOCKER_CONTAINER=$CONTAINER_NAME \\"
echo "  npm start"
echo ""
echo "To test the container:"
echo "  docker exec -it $CONTAINER_NAME bash"
echo ""
echo "To stop and remove (when done):"
echo "  docker stop $CONTAINER_NAME"
echo "  docker rm $CONTAINER_NAME"
echo "  docker volume rm $VOLUME_NAME"
