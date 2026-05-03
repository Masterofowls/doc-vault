import * as SQLite from 'expo-sqlite';

export interface Bookmark {
  id: number;
  url: string;
  title: string;
  sourceId: string;
  favicon?: string;
  createdAt: number;
  cachedPath?: string;
}

export interface HistoryEntry {
  id: number;
  url: string;
  title: string;
  sourceId: string;
  visitedAt: number;
}

export interface CustomSource {
  id: string;
  name: string;
  url: string;
  icon: string;
  color: string;
  category: string;
  description: string;
  createdAt: number;
}

export interface SourcePref {
  sourceId: string;
  pinned: number;
  hidden: number;
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
      cached_path TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      source_id TEXT NOT NULL DEFAULT '',
      visited_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS custom_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '🔗',
      color TEXT NOT NULL DEFAULT '#6366f1',
      category TEXT NOT NULL DEFAULT 'Custom',
      description TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS source_prefs (
      source_id TEXT PRIMARY KEY,
      pinned INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0
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
  cachedPath?: string,
): Promise<void> {
  const database = await initDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO bookmarks (url, title, source_id, favicon, cached_path, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [url, title, sourceId, favicon ?? null, cachedPath ?? null, Date.now()],
  );
}

export async function updateBookmarkCache(url: string, cachedPath: string): Promise<void> {
  const database = await initDatabase();
  await database.runAsync('UPDATE bookmarks SET cached_path = ? WHERE url = ?', [cachedPath, url]);
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
    cached_path: string | null;
    created_at: number;
  }>('SELECT * FROM bookmarks ORDER BY created_at DESC');
  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    title: r.title,
    sourceId: r.source_id,
    favicon: r.favicon ?? undefined,
    cachedPath: r.cached_path ?? undefined,
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

// --- Custom Sources ---

export async function addCustomSource(source: Omit<CustomSource, 'createdAt'>): Promise<void> {
  const database = await initDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO custom_sources (id, name, url, icon, color, category, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [source.id, source.name, source.url, source.icon, source.color, source.category, source.description, Date.now()],
  );
}

export async function getAllCustomSources(): Promise<CustomSource[]> {
  const database = await initDatabase();
  const rows = await database.getAllAsync<{
    id: string; name: string; url: string; icon: string;
    color: string; category: string; description: string; created_at: number;
  }>('SELECT * FROM custom_sources ORDER BY created_at DESC');
  return rows.map((r) => ({ ...r, createdAt: r.created_at }));
}

export async function deleteCustomSource(id: string): Promise<void> {
  const database = await initDatabase();
  await database.runAsync('DELETE FROM custom_sources WHERE id = ?', [id]);
}

// --- Source Prefs (pin / hide) ---

export async function setSourcePref(sourceId: string, pinned: boolean, hidden: boolean): Promise<void> {
  const database = await initDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO source_prefs (source_id, pinned, hidden) VALUES (?, ?, ?)`,
    [sourceId, pinned ? 1 : 0, hidden ? 1 : 0],
  );
}

export async function getAllSourcePrefs(): Promise<Record<string, SourcePref>> {
  const database = await initDatabase();
  const rows = await database.getAllAsync<{ source_id: string; pinned: number; hidden: number }>(
    'SELECT * FROM source_prefs',
  );
  const map: Record<string, SourcePref> = {};
  for (const r of rows) {
    map[r.source_id] = { sourceId: r.source_id, pinned: r.pinned, hidden: r.hidden };
  }
  return map;
}
