/**
 * Process Registry - manages process tracking and cleanup
 */

import { Process, ProcessInfo } from "../types/process.js";

export class ProcessRegistry {
  private processes = new Map<string, Process>();
  private readonly maxTerminatedProcesses = 5;

  /**
   * Add a process to the registry
   */
  add(process: Process): void {
    this.processes.set(process.pid, process);
    this.pruneTerminated();
  }

  /**
   * Get a process by PID
   */
  get(pid: string): Process | undefined {
    return this.processes.get(pid);
  }

  /**
   * List all processes
   */
  list(): ProcessInfo[] {
    return Array.from(this.processes.values()).map(p => ({
      pid: p.pid,
      command: p.command,
      status: p.status,
      exitCode: p.exitCode,
      cwd: p.cwd,
      tty: p.tty,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  /**
   * Delete a process from the registry
   */
  delete(pid: string): boolean {
    return this.processes.delete(pid);
  }

  /**
   * Prune terminated processes, keeping only the last N
   */
  private pruneTerminated(): void {
    const terminated = Array.from(this.processes.values())
      .filter(p => p.status === "terminated")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Remove all but the most recent maxTerminatedProcesses
    for (const process of terminated.slice(this.maxTerminatedProcesses)) {
      this.processes.delete(process.pid);
    }
  }

  /**
   * Get count of processes by status
   */
  getStats(): { running: number; terminated: number; total: number } {
    let running = 0;
    let terminated = 0;

    for (const process of this.processes.values()) {
      if (process.status === "running") {
        running++;
      } else {
        terminated++;
      }
    }

    return { running, terminated, total: this.processes.size };
  }

  /**
   * Clear all processes (for cleanup)
   */
  clear(): void {
    this.processes.clear();
  }
}
