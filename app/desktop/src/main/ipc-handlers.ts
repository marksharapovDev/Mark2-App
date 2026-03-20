import { ipcMain, BrowserWindow } from 'electron';
import { ChildProcess } from 'child_process';
import crypto from 'crypto';
import { claude, AgentName } from './claude-bridge';

const VALID_AGENTS = new Set<string>(['dev', 'teaching', 'study', 'health', 'finance', 'general']);

const sessions = new Map<string, ChildProcess>();

function isValidAgent(agent: string): agent is AgentName {
  return VALID_AGENTS.has(agent);
}

function getWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows();
  return windows[0] ?? null;
}

function sendToRenderer(channel: string, ...args: unknown[]): void {
  const win = getWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, ...args);
  }
}

export function registerIpcHandlers(): void {
  // One-shot request: claude -p "prompt"
  ipcMain.handle('claude:run', async (_event, agent: string, prompt: string) => {
    if (!isValidAgent(agent)) {
      throw new Error(`Invalid agent: ${agent}`);
    }
    return claude.run({ agent, prompt });
  });

  // Start interactive session
  ipcMain.handle('claude:start-session', (_event, agent: string) => {
    if (!isValidAgent(agent)) {
      throw new Error(`Invalid agent: ${agent}`);
    }

    const sessionId = crypto.randomUUID();
    const proc = claude.startSession(agent);
    sessions.set(sessionId, proc);

    proc.stdout?.on('data', (data: Buffer) => {
      sendToRenderer('claude:stream', sessionId, data.toString());
    });

    proc.stderr?.on('data', (data: Buffer) => {
      sendToRenderer('claude:session-error', sessionId, data.toString());
    });

    proc.on('close', () => {
      sessions.delete(sessionId);
      sendToRenderer('claude:session-end', sessionId);
    });

    return sessionId;
  });

  // Send message to interactive session
  ipcMain.handle('claude:send-message', (_event, sessionId: string, message: string) => {
    const proc = sessions.get(sessionId);
    if (!proc) {
      throw new Error(`Session ${sessionId} not found`);
    }
    if (!proc.stdin || !proc.stdin.writable) {
      throw new Error(`Session ${sessionId} stdin not writable`);
    }
    proc.stdin.write(message + '\n');
  });

  // Stop session
  ipcMain.handle('claude:stop-session', (_event, sessionId: string) => {
    const proc = sessions.get(sessionId);
    if (proc) {
      proc.kill();
      sessions.delete(sessionId);
    }
  });
}

export function cleanupSessions(): void {
  for (const [id, proc] of sessions) {
    proc.kill();
    sessions.delete(id);
  }
}
