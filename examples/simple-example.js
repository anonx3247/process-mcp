/**
 * Simple example of using process-mcp as a library
 * Run with: node examples/simple-example.js
 */

import { createProcessMCP } from '../dist/lib.js';

async function main() {
  console.log('Creating Process MCP server...');

  // Create server in host mode
  const { executor, cleanup } = await createProcessMCP({
    mode: 'host',
    defaults: {
      workdir: '/tmp',
      timeoutMs: 5000,
      maxTimeoutMs: 60000,
    },
  });

  console.log('Server created! Running example commands...\n');

  // Example 1: Run a simple command
  console.log('1. Running: echo "Hello World"');
  const result1 = await executor.spawn({
    command: 'echo "Hello World"',
  });
  if (result1.success) {
    console.log('   Output:', result1.value.stdout.trim());
    console.log('   Status:', result1.value.status);
  }

  // Example 2: Run a command with working directory
  console.log('\n2. Running: pwd');
  const result2 = await executor.spawn({
    command: 'pwd',
    cwd: '/tmp',
  });
  if (result2.success) {
    console.log('   Output:', result2.value.stdout.trim());
  }

  // Example 3: Run a background process
  console.log('\n3. Running background process: sleep 10');
  const result3 = await executor.spawn({
    command: 'sleep 10',
    background: true,
  });
  if (result3.success) {
    console.log('   PID:', result3.value.pid);
    console.log('   Status:', result3.value.status);
  }

  // Example 4: List all processes
  console.log('\n4. Listing all processes:');
  const processes = executor.listProcesses();
  processes.forEach(proc => {
    console.log(`   - ${proc.pid}: ${proc.command} [${proc.status}]`);
  });

  // Example 5: Kill the background process
  if (result3.success) {
    console.log(`\n5. Killing process ${result3.value.pid}`);
    const killResult = await executor.kill(result3.value.pid);
    if (killResult.success) {
      console.log('   Process terminated successfully');
    }
  }

  // Cleanup
  console.log('\nCleaning up...');
  await cleanup();
  console.log('Done!');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
