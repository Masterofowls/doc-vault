import * as SQLite from 'expo-sqlite';

export interface Bookmark {
  id: number;
  url: string;
  title: string;
  sourceId: string;
  favicon?: string;
  createdAt: number;
}

export interface HistoryEntry {
  id: number;
  url: string;
  title: string;
  sourceId: string;
  visitedAt: number;
}

let db: SQLite.SQLiteDatabase | null = null;

export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('docvault.db');
  await db.execAsync(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;

    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      source_id TEXT NOT NULL DEFAULT '',
      favicon TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      source_id TEXT NOT NULL DEFAULT '',
      visited_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url);
    CREATE INDEX IF NOT EXISTS idx_history_visited ON history(visited_at DESC);
  `);
  return db;
}

// --- Bookmarks ---

export async function addBookmark(
  url: string,
  title: string,
  sourceId: string,
  favicon?: string,
): Promise<void> {
  const database = await initDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO bookmarks (url, title, source_id, favicon, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [url, title, sourceId, favicon ?? null, Date.now()],
  );
}

export async function removeBookmark(url: string): Promise<void> {
  const database = await initDatabase();
  await database.runAsync('DELETE FROM bookmarks WHERE url = ?', [url]);
}

export async function isBookmarked(url: string): Promise<boolean> {
  const database = await initDatabase();
  const row = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM bookmarks WHERE url = ?',
    [url],
  );
  return (row?.count ?? 0) > 0;
}

export async function getAllBookmarks(): Promise<Bookmark[]> {
  const database = await initDatabase();
  const rows = await database.getAllAsync<{
    id: number;
    url: string;
    title: string;
    source_id: string;
    favicon: string | null;
    created_at: number;
  }>('SELECT * FROM bookmarks ORDER BY created_at DESC');
  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    title: r.title,
    sourceId: r.source_id,
    favicon: r.favicon ?? undefined,
    createdAt: r.created_at,
  }));
}

export async function clearAllBookmarks(): Promise<void> {
  const database = await initDatabase();
  await database.runAsync('DELETE FROM bookmarks');
}

// --- History ---

export async function addHistory(url: string, title: string, sourceId: string): Promise<void> {
  const database = await initDatabase();
  await database.runAsync(
    'INSERT INTO history (url, title, source_id, visited_at) VALUES (?, ?, ?, ?)',
    [url, title, sourceId, Date.now()],
  );
}

export async function getAllHistory(): Promise<HistoryEntry[]> {
  const database = await initDatabase();
  const rows = await database.getAllAsync<{
    id: number;
    url: string;
    title: string;
    source_id: string;
    visited_at: number;
  }>('SELECT * FROM history ORDER BY visited_at DESC LIMIT 500');
  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    title: r.title,
    sourceId: r.source_id,
    visitedAt: r.visited_at,
  }));
}

export async function clearHistory(): Promise<void> {
  const database = await initDatabase();
  await database.runAsync('DELETE FROM history');
}

export async function deleteHistoryEntry(id: number): Promise<void> {
  const database = await initDatabase();
  await database.runAsync('DELETE FROM history WHERE id = ?', [id]);
}
