import { contextBridge, ipcRenderer } from 'electron';

export interface ClaudeAPI {
  run: (agent: string, prompt: string) => Promise<string>;
  startSession: (agent: string) => Promise<string>;
  sendMessage: (sessionId: string, message: string) => Promise<void>;
  stopSession: (sessionId: string) => Promise<void>;
  onStream: (callback: (sessionId: string, chunk: string) => void) => () => void;
  onSessionError: (callback: (sessionId: string, error: string) => void) => () => void;
  onSessionEnd: (callback: (sessionId: string) => void) => () => void;
}

const claudeApi: ClaudeAPI = {
  run: (agent, prompt) =>
    ipcRenderer.invoke('claude:run', agent, prompt),

  startSession: (agent) =>
    ipcRenderer.invoke('claude:start-session', agent),

  sendMessage: (sessionId, message) =>
    ipcRenderer.invoke('claude:send-message', sessionId, message),

  stopSession: (sessionId) =>
    ipcRenderer.invoke('claude:stop-session', sessionId),

  onStream: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, sessionId: string, chunk: string) => {
      callback(sessionId, chunk);
    };
    ipcRenderer.on('claude:stream', handler);
    return () => { ipcRenderer.removeListener('claude:stream', handler); };
  },

  onSessionError: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, sessionId: string, error: string) => {
      callback(sessionId, error);
    };
    ipcRenderer.on('claude:session-error', handler);
    return () => { ipcRenderer.removeListener('claude:session-error', handler); };
  },

  onSessionEnd: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, sessionId: string) => {
      callback(sessionId);
    };
    ipcRenderer.on('claude:session-end', handler);
    return () => { ipcRenderer.removeListener('claude:session-end', handler); };
  },
};

contextBridge.exposeInMainWorld('claude', claudeApi);
