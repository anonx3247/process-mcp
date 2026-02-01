import { describe, it, after, before } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

function parseResult(result: Awaited<ReturnType<Client["callTool"]>>): any {
  const content = result.content[0];
  if (content.type !== "text") throw new Error("Expected text content");
  return JSON.parse((content as any).text);
}

function textResult(result: Awaited<ReturnType<Client["callTool"]>>): string {
  const content = result.content[0];
  if (content.type !== "text") throw new Error("Expected text content");
  return (content as any).text;
}

describe("process-mcp host mode", () => {
  let client: Client;

  before(async () => {
    const transport = new StdioClientTransport({
      command: "node",
      args: ["dist/index.js"],
      env: {
        ...globalThis.process.env,
        PROCESS_MODE: "host",
      },
    });

    client = new Client(
      { name: "test-client", version: "1.0.0" },
      { capabilities: {} }
    );

    await client.connect(transport);
  });

  after(async () => {
    await client.close();
  });

  it("should list all 5 tools", async () => {
    const result = await client.listTools();
    const names = result.tools.map((t) => t.name).sort();
    assert.deepEqual(names, ["kill", "ps", "spawn", "stdin", "stdout"]);
  });

  it("should spawn a simple command and return output", async () => {
    const result = await client.callTool({
      name: "spawn",
      arguments: { command: "echo hello world" },
    });
    const data = parseResult(result);
    assert.equal(data.status, "terminated");
    assert.equal(data.exitCode, 0);
    assert.match(data.stdout, /hello world/);
  });

  it("should capture stderr", async () => {
    const result = await client.callTool({
      name: "spawn",
      arguments: { command: "echo error >&2" },
    });
    const data = parseResult(result);
    assert.equal(data.exitCode, 0);
    assert.match(data.stderr, /error/);
  });

  it("should report non-zero exit code", async () => {
    const result = await client.callTool({
      name: "spawn",
      arguments: { command: "exit 42" },
    });
    const data = parseResult(result);
    assert.equal(data.status, "terminated");
    assert.equal(data.exitCode, 42);
  });

  it("should spawn a background process and list it with ps", async () => {
    const spawnResult = await client.callTool({
      name: "spawn",
      arguments: { command: "sleep 30", background: true },
    });
    const data = parseResult(spawnResult);
    assert.equal(data.status, "running");
    const pid = data.pid;

    const psResult = await client.callTool({
      name: "ps",
      arguments: {},
    });
    const psList = parseResult(psResult);
    const found = psList.find((p: any) => p.pid === pid);
    assert.ok(found, "Background process should appear in ps");
    assert.equal(found.status, "running");

    // Cleanup
    await client.callTool({
      name: "kill",
      arguments: { id: pid },
    });
  });

  it("should retrieve stdout for a background process", async () => {
    const spawnResult = await client.callTool({
      name: "spawn",
      arguments: { command: "echo line1; echo line2; sleep 30", background: true },
    });
    const pid = parseResult(spawnResult).pid;

    // Give it a moment to produce output
    await new Promise((r) => setTimeout(r, 500));

    const stdoutResult = await client.callTool({
      name: "stdout",
      arguments: { id: pid, lines: 10 },
    });
    const stdoutData = parseResult(stdoutResult);
    assert.match(stdoutData.stdout, /line1/);
    assert.match(stdoutData.stdout, /line2/);

    await client.callTool({
      name: "kill",
      arguments: { id: pid },
    });
  });

  it("should kill a running process", async () => {
    const spawnResult = await client.callTool({
      name: "spawn",
      arguments: { command: "sleep 60", background: true },
    });
    const pid = parseResult(spawnResult).pid;

    const killResult = await client.callTool({
      name: "kill",
      arguments: { id: pid, signal: "SIGTERM" },
    });
    const killText = textResult(killResult);
    assert.match(killText, /killed successfully/);

    // Verify it's terminated
    await new Promise((r) => setTimeout(r, 300));
    const psResult = await client.callTool({
      name: "ps",
      arguments: {},
    });
    const psList = parseResult(psResult);
    const proc = psList.find((p: any) => p.pid === pid);
    if (proc) {
      assert.equal(proc.status, "terminated");
    }
  });

  it("should handle environment variables", async () => {
    const result = await client.callTool({
      name: "spawn",
      arguments: {
        command: "echo $MY_TEST_VAR",
        env: { MY_TEST_VAR: "test_value_123" },
      },
    });
    const data = parseResult(result);
    assert.match(data.stdout, /test_value_123/);
  });

  it("should handle working directory", async () => {
    const result = await client.callTool({
      name: "spawn",
      arguments: { command: "pwd", cwd: "/tmp" },
    });
    const data = parseResult(result);
    assert.match(data.stdout, /\/tmp/);
  });

  it("should timeout long commands and background them", async () => {
    const result = await client.callTool({
      name: "spawn",
      arguments: { command: "sleep 60", timeoutMs: 1000 },
    });
    const data = parseResult(result);
    // Should be backgrounded due to timeout
    assert.equal(data.status, "running");
    assert.ok(data.pid);

    await client.callTool({
      name: "kill",
      arguments: { id: data.pid },
    });
  });

  it("should spawn a TTY process and send stdin", async () => {
    const spawnResult = await client.callTool({
      name: "spawn",
      arguments: { command: "cat", tty: true, background: true },
    });
    const pid = parseResult(spawnResult).pid;

    // Send input
    await client.callTool({
      name: "stdin",
      arguments: { id: pid, input: "hello from stdin\n" },
    });

    await new Promise((r) => setTimeout(r, 500));

    const stdoutResult = await client.callTool({
      name: "stdout",
      arguments: { id: pid },
    });
    const stdoutData = parseResult(stdoutResult);
    assert.match(stdoutData.stdout, /hello from stdin/);

    await client.callTool({
      name: "kill",
      arguments: { id: pid },
    });
  });

  it("should reject stdin for non-TTY process", async () => {
    const spawnResult = await client.callTool({
      name: "spawn",
      arguments: { command: "sleep 30", background: true },
    });
    const pid = parseResult(spawnResult).pid;

    const stdinResult = await client.callTool({
      name: "stdin",
      arguments: { id: pid, input: "test\n" },
    });
    const data = parseResult(stdinResult);
    assert.equal(data.error, "not_tty");

    await client.callTool({
      name: "kill",
      arguments: { id: pid },
    });
  });
});
