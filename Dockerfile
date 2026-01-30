# Optional Dockerfile for Process MCP Server
# This creates a custom image with pre-installed tools
#
# To use this:
# 1. Build: docker build -t process-mcp:latest .
# 2. Run: PROCESS_MODE=docker DOCKER_IMAGE="process-mcp:latest" npm start

FROM ubuntu:22.04

# Avoid interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install common development tools
RUN apt-get update && apt-get install -y \
    # Basic utilities
    curl \
    wget \
    git \
    vim \
    nano \
    htop \
    tree \
    jq \
    # Build essentials
    build-essential \
    # Python
    python3 \
    python3-pip \
    python3-venv \
    # Node.js (via NodeSource)
    ca-certificates \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x
RUN mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Create working directory
RUN mkdir -p /home/agent && chmod 777 /home/agent

# Set working directory
WORKDIR /home/agent

# Set up PATH
ENV PATH="/home/agent/.local/bin:${PATH}"

# Default command (will be overridden by process-mcp)
CMD ["/bin/bash"]
