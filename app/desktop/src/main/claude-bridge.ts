import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
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
  return path.join(AGENTS_DIR, agent);
}

export class ClaudeBridge extends EventEmitter {
  /**
   * Одиночный запрос к Claude Code.
   * Запускает `claude -p "prompt"` в папке агента.
   */
  async run(options: RunOptions): Promise<string> {
    const cwd = options.cwd ?? agentDir(options.agent);

    return new Promise((resolve, reject) => {
      const proc = spawn('claude', ['-p', options.prompt], {
        cwd,
        env: { ...process.env },
      });

      let output = '';

      proc.stdout.on('data', (data: Buffer) => {
        const chunk = data.toString();
        output += chunk;
        this.emit('stream', {
          agent: options.agent,
          chunk,
        } satisfies StreamEvent);
      });

      proc.stderr.on('data', (data: Buffer) => {
        this.emit('error', {
          agent: options.agent,
          error: data.toString(),
        } satisfies ErrorEvent);
      });

      proc.on('close', (code) => {
        const exitCode = code ?? 1;
        this.emit('complete', {
          agent: options.agent,
          output,
          exitCode,
        } satisfies CompleteEvent);

        if (exitCode === 0) {
          resolve(output);
        } else {
          reject(new Error(`Claude Code exited with code ${exitCode}`));
        }
      });
    });
  }

  /**
   * Интерактивная сессия (для чата).
   * UI пишет в stdin, читает из stdout.
   */
  startSession(agent: AgentName): ChildProcess {
    const cwd = agentDir(agent);

    return spawn('claude', [], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
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
