import { Process, ProcessInfo } from "../types/process.js";

export class ProcessRegistry {
  private processes = new Map<string, Process>();
  private readonly maxTerminatedProcesses = 5;

  add(process: Process): void {
    this.processes.set(process.pid, process);
    this.pruneTerminated();
  }

  get(pid: string): Process | undefined {
    return this.processes.get(pid);
  }

  list(): Process[] {
    return Array.from(this.processes.values());
  }

  info(pid: string): ProcessInfo | undefined {
    const process = this.processes.get(pid);
    if (!process) {
      return undefined;
    }
    return {
      pid: process.pid,
      command: process.command,
      status: process.status,
      exitCode: process.exitCode,
      cwd: process.cwd,
      tty: process.tty,
      createdAt: process.createdAt.toISOString(),
    };
  }

  delete(pid: string): boolean {
    return this.processes.delete(pid);
  }

  private pruneTerminated(): void {
    const terminated = Array.from(this.processes.values())
      .filter(p => p.status === "terminated")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Remove all but the most recent maxTerminatedProcesses
    for (const process of terminated.slice(this.maxTerminatedProcesses)) {
      this.processes.delete(process.pid);
    }
  }

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

  clear(): void {
    this.processes.clear();
  }
}
