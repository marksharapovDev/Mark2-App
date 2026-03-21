import { ipcMain, BrowserWindow, shell } from 'electron';
import { ChildProcess } from 'child_process';
import crypto from 'crypto';
import { claude, AgentName } from './claude-bridge';
import {
  sendMessage,
  handleCreateSession,
  handleGetSessions,
  handleDeleteSession,
  handleSwitchSession,
  handleGetSessionMessages,
  handleAgentSwitch,
  handleBackfillSummaries,
} from './hybrid-engine';

const VALID_AGENTS = new Set<string>(['dev', 'teaching', 'study', 'health', 'finance', 'general']);

const cliSessions = new Map<string, ChildProcess>();

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
  // === Chat sessions ===

  ipcMain.handle('chat:create-session', async (_event, agent: string, fromSessionId?: string) => {
    if (!isValidAgent(agent)) throw new Error(`Invalid agent: ${agent}`);
    return handleCreateSession(agent, fromSessionId);
  });

  ipcMain.handle('chat:get-sessions', async (_event, agent: string) => {
    if (!isValidAgent(agent)) throw new Error(`Invalid agent: ${agent}`);
    return handleGetSessions(agent);
  });

  ipcMain.handle('chat:delete-session', async (_event, sessionId: string) => {
    await handleDeleteSession(sessionId);
  });

  ipcMain.handle('chat:switch-session', async (_event, fromSessionId: string | null, toSessionId: string) => {
    return handleSwitchSession(fromSessionId, toSessionId);
  });

  ipcMain.handle('chat:get-session-messages', async (_event, sessionId: string) => {
    return handleGetSessionMessages(sessionId);
  });

  ipcMain.handle('chat:agent-switch', async (_event, fromAgent: string) => {
    if (!isValidAgent(fromAgent)) throw new Error(`Invalid agent: ${fromAgent}`);
    await handleAgentSwitch(fromAgent);
  });

  ipcMain.handle('chat:backfill-summaries', async () => {
    return handleBackfillSummaries();
  });

  // === Hybrid chat (send message within a session) ===

  ipcMain.handle('chat:send', async (_event, agent: string, sessionId: string, message: string) => {
    if (!isValidAgent(agent)) throw new Error(`Invalid agent: ${agent}`);
    return sendMessage(agent, sessionId, message);
  });

  // === Claude Code direct ===

  ipcMain.handle('claude:run', async (_event, agent: string, prompt: string) => {
    if (!isValidAgent(agent)) throw new Error(`Invalid agent: ${agent}`);
    return claude.run({ agent, prompt });
  });

  ipcMain.handle('claude:start-session', (_event, agent: string) => {
    if (!isValidAgent(agent)) throw new Error(`Invalid agent: ${agent}`);

    const sessionId = crypto.randomUUID();
    const proc = claude.startSession(agent);
    cliSessions.set(sessionId, proc);

    proc.stdout?.on('data', (data: Buffer) => {
      sendToRenderer('claude:stream', sessionId, data.toString());
    });

    proc.stderr?.on('data', (data: Buffer) => {
      sendToRenderer('claude:session-error', sessionId, data.toString());
    });

    proc.on('close', () => {
      cliSessions.delete(sessionId);
      sendToRenderer('claude:session-end', sessionId);
    });

    return sessionId;
  });

  ipcMain.handle('claude:send-message', (_event, sessionId: string, message: string) => {
    const proc = cliSessions.get(sessionId);
    if (!proc) throw new Error(`Session ${sessionId} not found`);
    if (!proc.stdin || !proc.stdin.writable) throw new Error(`Session ${sessionId} stdin not writable`);
    proc.stdin.write(message + '\n');
  });

  // === File operations ===

  ipcMain.handle('file:open', async (_event, filePath: string) => {
    return shell.openPath(filePath);
  });

  ipcMain.handle('claude:stop-session', (_event, sessionId: string) => {
    const proc = cliSessions.get(sessionId);
    if (proc) {
      proc.kill();
      cliSessions.delete(sessionId);
    }
  });
}

export function cleanupSessions(): void {
  for (const [id, proc] of cliSessions) {
    proc.kill();
    cliSessions.delete(id);
  }
}
