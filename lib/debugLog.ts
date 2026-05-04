/**
 * In-memory + native-file debug logger.
 * Call debugLog.info / warn / error from anywhere; view in the Debug tab.
 */

import { NativeDocVault } from './nativeModule';

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  ts: number;
  level: LogLevel;
  tag: string;
  msg: string;
}

const MAX_ENTRIES = 500;
const entries: LogEntry[] = [];
const listeners: Array<(entries: LogEntry[]) => void> = [];

function notify() {
  const snap = [...entries];
  listeners.forEach((fn) => fn(snap));
}

function record(level: LogLevel, tag: string, msg: string) {
  const entry: LogEntry = { ts: Date.now(), level, tag, msg };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();
  const line = `[${new Date(entry.ts).toISOString()}] [${level.toUpperCase()}] [${tag}] ${msg}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
  // best-effort write to native file (non-blocking)
  NativeDocVault.appendDebugLog(line).catch(() => {});
  notify();
}

export const debugLog = {
  info: (tag: string, msg: string) => record('info', tag, msg),
  warn: (tag: string, msg: string) => record('warn', tag, msg),
  error: (tag: string, msg: string) => record('error', tag, msg),

  /** Subscribe to log updates. Returns unsubscribe function. */
  subscribe: (fn: (entries: LogEntry[]) => void) => {
    listeners.push(fn);
    fn([...entries]);
    return () => {
      const idx = listeners.indexOf(fn);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  },

  getEntries: () => [...entries],

  clearMemory: () => {
    entries.length = 0;
    notify();
  },

  clearAll: async () => {
    entries.length = 0;
    notify();
    await NativeDocVault.clearDebugLog();
  },

  /** Load persisted logs from native file into memory. */
  loadFromNative: async () => {
    try {
      const raw = await NativeDocVault.readDebugLog();
      if (!raw) return;
      const lines = raw.trim().split('\n').slice(-MAX_ENTRIES);
      for (const line of lines) {
        const m = line.match(/^\[(.+?)\] \[(INFO|WARN|ERROR)\] \[(.+?)\] (.+)$/);
        if (m) {
          entries.push({
            ts: new Date(m[1]).getTime(),
            level: m[2].toLowerCase() as LogLevel,
            tag: m[3],
            msg: m[4],
          });
        }
      }
      notify();
    } catch {
      // ignore load errors
    }
  },
};
