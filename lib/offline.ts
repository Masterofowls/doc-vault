/**
 * Offline caching layer for DocVault.
 * Stores full page HTML + metadata in expo-file-system.
 * Supports cache index, freshness checks, and background pre-cache.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { updateBookmarkCache } from './database';

const CACHE_DIR = `${FileSystem.documentDirectory}offline/`;
const META_DIR = `${FileSystem.documentDirectory}offline_meta/`;
const CACHE_INDEX_PATH = `${FileSystem.documentDirectory}offline_index.json`;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CacheEntry {
  url: string;
  title: string;
  path: string;
  metaPath: string;
  cachedAt: number;
  sizeBytes: number;
  isStale: boolean; // older than STALE_HOURS
  sourceId?: string;
}

const STALE_HOURS = 48; // entries older than this show stale badge

// ─── Directory helpers ────────────────────────────────────────────────────────

async function ensureDirs(): Promise<void> {
  for (const dir of [CACHE_DIR, META_DIR]) {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  }
}

function urlToKey(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 180);
}

export function getCachedPath(url: string): string {
  return CACHE_DIR + urlToKey(url) + '.html';
}

function getMetaPath(url: string): string {
  return META_DIR + urlToKey(url) + '.json';
}

// ─── Index management ─────────────────────────────────────────────────────────

async function loadIndex(): Promise<CacheEntry[]> {
  try {
    const info = await FileSystem.getInfoAsync(CACHE_INDEX_PATH);
    if (!info.exists) return [];
    const raw = await FileSystem.readAsStringAsync(CACHE_INDEX_PATH);
    return JSON.parse(raw) as CacheEntry[];
  } catch {
    return [];
  }
}

async function saveIndex(entries: CacheEntry[]): Promise<void> {
  await FileSystem.writeAsStringAsync(CACHE_INDEX_PATH, JSON.stringify(entries), {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

async function upsertIndex(entry: Omit<CacheEntry, 'isStale'>): Promise<void> {
  const entries = await loadIndex();
  const idx = entries.findIndex(e => e.url === entry.url);
  const now = Date.now();
  const full: CacheEntry = {
    ...entry,
    isStale: now - entry.cachedAt > STALE_HOURS * 3600 * 1000,
  };
  if (idx >= 0) {
    entries[idx] = full;
  } else {
    entries.unshift(full); // newest first
  }
  await saveIndex(entries);
}

async function removeFromIndex(url: string): Promise<void> {
  const entries = await loadIndex();
  await saveIndex(entries.filter(e => e.url !== url));
}

// ─── Core cache operations ────────────────────────────────────────────────────

/**
 * Save HTML for a page. Returns the file path.
 */
export async function cachePageHtml(
  url: string,
  html: string,
  title = '',
  sourceId = '',
): Promise<string> {
  await ensureDirs();
  const path = getCachedPath(url);
  const metaPath = getMetaPath(url);

  await FileSystem.writeAsStringAsync(path, html, { encoding: FileSystem.EncodingType.UTF8 });

  const sizeBytes = new TextEncoder().encode(html).length;

  const meta = { url, title, sourceId, cachedAt: Date.now(), sizeBytes };
  await FileSystem.writeAsStringAsync(metaPath, JSON.stringify(meta), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  await upsertIndex({ url, title, path, metaPath, cachedAt: meta.cachedAt, sizeBytes, sourceId });
  await updateBookmarkCache(url, path).catch(() => {});
  return path;
}

/**
 * Load cached HTML. Returns null if not found.
 */
export async function loadCachedPage(pathOrUrl: string): Promise<string | null> {
  try {
    // Resolve whether it's a file path or URL
    const filePath = pathOrUrl.startsWith('file://') || pathOrUrl.includes('/offline/')
      ? pathOrUrl
      : getCachedPath(pathOrUrl);
    const info = await FileSystem.getInfoAsync(filePath);
    if (!info.exists) return null;
    return await FileSystem.readAsStringAsync(filePath, { encoding: FileSystem.EncodingType.UTF8 });
  } catch {
    return null;
  }
}

/**
 * Check whether a URL has a valid (non-stale) cache entry.
 */
export async function getCacheStatus(url: string): Promise<'fresh' | 'stale' | 'none'> {
  try {
    const info = await FileSystem.getInfoAsync(getCachedPath(url));
    if (!info.exists) return 'none';
    const metaPath = getMetaPath(url);
    const metaInfo = await FileSystem.getInfoAsync(metaPath);
    if (!metaInfo.exists) return 'stale';
    const meta = JSON.parse(
      await FileSystem.readAsStringAsync(metaPath, { encoding: FileSystem.EncodingType.UTF8 }),
    ) as { cachedAt: number };
    const ageMs = Date.now() - meta.cachedAt;
    return ageMs > STALE_HOURS * 3600 * 1000 ? 'stale' : 'fresh';
  } catch {
    return 'none';
  }
}

/**
 * Delete a cached page and remove from index.
 */
export async function deleteCachedPage(urlOrPath: string): Promise<void> {
  try {
    const url = urlOrPath.includes('/offline/')
      ? '' // can't reverse-engineer URL from path easily
      : urlOrPath;

    const filePath = url ? getCachedPath(url) : urlOrPath;
    const info = await FileSystem.getInfoAsync(filePath);
    if (info.exists) await FileSystem.deleteAsync(filePath, { idempotent: true });

    if (url) {
      const metaPath = getMetaPath(url);
      const metaInfo = await FileSystem.getInfoAsync(metaPath);
      if (metaInfo.exists) await FileSystem.deleteAsync(metaPath, { idempotent: true });
      await removeFromIndex(url);
    }
  } catch {}
}

/**
 * Return all cached entries from the index (newest first).
 */
export async function getAllCachedPages(): Promise<CacheEntry[]> {
  const entries = await loadIndex();
  const now = Date.now();
  return entries.map(e => ({
    ...e,
    isStale: now - e.cachedAt > STALE_HOURS * 3600 * 1000,
  }));
}

/**
 * Returns cache stats: count, total size in MB.
 */
export async function getCacheStats(): Promise<{ count: number; sizeMb: number }> {
  try {
    await ensureDirs();
    const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
    const htmlFiles = files.filter(f => f.endsWith('.html'));
    let totalBytes = 0;
    for (const file of htmlFiles) {
      const info = await FileSystem.getInfoAsync(CACHE_DIR + file);
      if (info.exists && 'size' in info && info.size) totalBytes += info.size;
    }
    return {
      count: htmlFiles.length,
      sizeMb: Math.round((totalBytes / 1024 / 1024) * 100) / 100,
    };
  } catch {
    return { count: 0, sizeMb: 0 };
  }
}

/**
 * Delete ALL cached pages + metadata + index.
 */
export async function clearAllCache(): Promise<void> {
  try {
    for (const dir of [CACHE_DIR, META_DIR]) {
      const info = await FileSystem.getInfoAsync(dir);
      if (info.exists) await FileSystem.deleteAsync(dir, { idempotent: true });
    }
    const idxInfo = await FileSystem.getInfoAsync(CACHE_INDEX_PATH);
    if (idxInfo.exists) await FileSystem.deleteAsync(CACHE_INDEX_PATH, { idempotent: true });
  } catch {}
}

// ─── WebView injection helpers ───────────────────────────────────────────────

/** Inject into WebView to capture full page HTML and send via postMessage */
export const CAPTURE_HTML_JS = `
(function() {
  try {
    const html = document.documentElement.outerHTML;
    const title = document.title || '';
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'captureHtml', html, title,
    }));
  } catch(e) {}
})();
`;

/** Inject to measure page scroll progress and send updates */
export const SCROLL_PROGRESS_JS = `
(function() {
  let last = 0;
  window.addEventListener('scroll', function() {
    const el = document.documentElement;
    const pct = Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight || 1)) * 100);
    if (Math.abs(pct - last) >= 5) {
      last = pct;
      try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'scrollProgress', pct })); } catch {}
    }
  }, { passive: true });
})();
`;

/** Inject to extract page metadata (title, description, og:image) */
export const EXTRACT_META_JS = `
(function() {
  try {
    const getMeta = name => {
      const el = document.querySelector('meta[name="' + name + '"], meta[property="og:' + name + '"], meta[property="' + name + '"]');
      return el ? el.getAttribute('content') || '' : '';
    };
    const data = {
      type: 'pageMeta',
      title: document.title,
      description: getMeta('description'),
      image: getMeta('image'),
      author: getMeta('author'),
    };
    window.ReactNativeWebView.postMessage(JSON.stringify(data));
  } catch {}
})();
`;
