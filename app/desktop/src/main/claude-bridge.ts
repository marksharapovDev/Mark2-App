import { exec, spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';

export type AgentName = 'dev' | 'teaching' | 'study' | 'health' | 'finance' | 'general';

export interface RunOptions {
  agent: AgentName;
  prompt: string;
  cwd?: string;
}

export interface StreamEvent {
  agent: AgentName;
  chunk: string;
}

export interface ErrorEvent {
  agent: AgentName;
  error: string;
}

export interface CompleteEvent {
  agent: AgentName;
  output: string;
  exitCode: number;
}

const HOME = os.homedir();
const AGENTS_DIR = path.join(HOME, 'mark2', 'agents');

function agentDir(agent: AgentName): string {
  const dir = path.join(AGENTS_DIR, agent);
  // Ensure directory exists — missing cwd causes ENOENT
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export class ClaudeBridge extends EventEmitter {
  /**
   * Одиночный запрос к Claude Code.
   * Использует spawn() чтобы не блокировать main process event loop.
   */
  async run(options: RunOptions): Promise<string> {
    const cwd = options.cwd ?? agentDir(options.agent);
    const args = ['-p', options.prompt];

    return new Promise((resolve, reject) => {
      const proc = spawn('claude', args, {
        cwd,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let output = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        this.emit('complete', {
          agent: options.agent,
          output,
          exitCode: code ?? 0,
        } satisfies CompleteEvent);

        if (code !== 0 && code !== null) {
          if (stderr) {
            this.emit('error', { agent: options.agent, error: stderr } satisfies ErrorEvent);
          }
          reject(new Error(stderr || `Claude Code exited with code ${code}`));
        } else {
          resolve(output);
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Стриминг запрос к Claude Code.
   * Использует spawn() для потоковой передачи stdout.
   */
  async runStream(options: RunOptions, onChunk: (accumulated: string) => void, signal?: AbortSignal): Promise<string> {
    const cwd = options.cwd ?? agentDir(options.agent);
    const args = ['-p', options.prompt];

    return new Promise((resolve, reject) => {
      const proc = spawn('claude', args, {
        cwd,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let output = '';
      let stderr = '';

      if (signal) {
        const onAbort = () => {
          proc.kill();
          resolve(output + '\n\n(прервано)');
        };
        if (signal.aborted) { proc.kill(); resolve('(прервано)'); return; }
        signal.addEventListener('abort', onAbort, { once: true });
        proc.on('close', () => signal.removeEventListener('abort', onAbort));
      }

      proc.stdout.on('data', (data: Buffer) => {
        output += data.toString();
        onChunk(output);
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        this.emit('complete', {
          agent: options.agent,
          output,
          exitCode: code ?? 0,
        } satisfies CompleteEvent);

        if (code !== 0 && code !== null) {
          if (stderr) {
            this.emit('error', { agent: options.agent, error: stderr } satisfies ErrorEvent);
          }
          // If aborted, resolve with partial output instead of rejecting
          if (signal?.aborted) {
            resolve(output + '\n\n(прервано)');
          } else {
            reject(new Error(stderr || `Claude Code exited with code ${code}`));
          }
        } else {
          resolve(output);
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Интерактивная сессия (для чата).
   * exec() — async, возвращает ChildProcess с stdin/stdout.
   */
  startSession(agent: AgentName): ChildProcess {
    const cwd = agentDir(agent);

    return exec('claude', {
      cwd,
      env: process.env,
    });
  }

  /**
   * Запустить несколько агентов параллельно.
   */
  async runParallel(tasks: RunOptions[]): Promise<Map<AgentName, string>> {
    const results = new Map<AgentName, string>();

    await Promise.all(
      tasks.map(async (task) => {
        const result = await this.run(task);
        results.set(task.agent, result);
      }),
    );

    return results;
  }
}

export const claude = new ClaudeBridge();
