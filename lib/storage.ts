/**
 * Persistent app settings via AsyncStorage.
 * Manages reading mode prefs, font size, per-site overrides, cache settings.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Keys ─────────────────────────────────────────────────────────────────────

const KEYS = {
  READING_FONT_SIZE: '@dv/reading_font_size',
  DARK_MODE_OVERRIDE: '@dv/dark_mode_override',
  AUTO_CACHE_BOOKMARKS: '@dv/auto_cache_bookmarks',
  AUTO_CACHE_ON_SCROLL: '@dv/auto_cache_on_scroll',
  CACHE_MAX_MB: '@dv/cache_max_mb',
  CACHE_STALE_HOURS: '@dv/cache_stale_hours',
  ADBLOCK_ENABLED: '@dv/adblock_enabled',
  READING_MODE_DEFAULT: '@dv/reading_mode_default',
  HIDDEN_SOURCES: '@dv/hidden_sources',
  PINNED_SOURCES: '@dv/pinned_sources',
  LAST_VISITED: '@dv/last_visited',
  SEARCH_HISTORY: '@dv/search_history',
  BROWSER_ZOOM: '@dv/browser_zoom',
} as const;

// ─── Defaults ─────────────────────────────────────────────────────────────────

export interface AppSettings {
  readingFontSize: number;        // 14-24
  darkModeOverride: boolean;      // force dark mode via CSS filter
  autoCacheBookmarks: boolean;    // auto-cache when bookmarking
  autoCacheOnScroll: boolean;     // auto-cache when page fully scrolled
  cacheMaxMb: number;             // max cache size in MB
  cacheStaleHours: number;        // hours before cache is stale
  adblockEnabled: boolean;
  readingModeDefault: boolean;    // open all pages in reading mode
  browserZoom: number;            // 0.8 - 1.5
}

const DEFAULTS: AppSettings = {
  readingFontSize: 17,
  darkModeOverride: false,
  autoCacheBookmarks: true,
  autoCacheOnScroll: false,
  cacheMaxMb: 200,
  cacheStaleHours: 48,
  adblockEnabled: true,
  readingModeDefault: false,
  browserZoom: 1.0,
};

// ─── Generic helpers ──────────────────────────────────────────────────────────

async function get<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

async function set<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// ─── App settings ─────────────────────────────────────────────────────────────

export async function getSettings(): Promise<AppSettings> {
  const keys = Object.values(KEYS);
  const pairs = await AsyncStorage.multiGet(keys);
  const map: Record<string, string | null> = {};
  pairs.forEach(([k, v]) => { map[k] = v; });

  return {
    readingFontSize: map[KEYS.READING_FONT_SIZE] ? JSON.parse(map[KEYS.READING_FONT_SIZE]!) : DEFAULTS.readingFontSize,
    darkModeOverride: map[KEYS.DARK_MODE_OVERRIDE] ? JSON.parse(map[KEYS.DARK_MODE_OVERRIDE]!) : DEFAULTS.darkModeOverride,
    autoCacheBookmarks: map[KEYS.AUTO_CACHE_BOOKMARKS] ? JSON.parse(map[KEYS.AUTO_CACHE_BOOKMARKS]!) : DEFAULTS.autoCacheBookmarks,
    autoCacheOnScroll: map[KEYS.AUTO_CACHE_ON_SCROLL] ? JSON.parse(map[KEYS.AUTO_CACHE_ON_SCROLL]!) : DEFAULTS.autoCacheOnScroll,
    cacheMaxMb: map[KEYS.CACHE_MAX_MB] ? JSON.parse(map[KEYS.CACHE_MAX_MB]!) : DEFAULTS.cacheMaxMb,
    cacheStaleHours: map[KEYS.CACHE_STALE_HOURS] ? JSON.parse(map[KEYS.CACHE_STALE_HOURS]!) : DEFAULTS.cacheStaleHours,
    adblockEnabled: map[KEYS.ADBLOCK_ENABLED] !== null ? JSON.parse(map[KEYS.ADBLOCK_ENABLED]!) : DEFAULTS.adblockEnabled,
    readingModeDefault: map[KEYS.READING_MODE_DEFAULT] ? JSON.parse(map[KEYS.READING_MODE_DEFAULT]!) : DEFAULTS.readingModeDefault,
    browserZoom: map[KEYS.BROWSER_ZOOM] ? JSON.parse(map[KEYS.BROWSER_ZOOM]!) : DEFAULTS.browserZoom,
  };
}

export async function setSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
): Promise<void> {
  const storageKey = {
    readingFontSize: KEYS.READING_FONT_SIZE,
    darkModeOverride: KEYS.DARK_MODE_OVERRIDE,
    autoCacheBookmarks: KEYS.AUTO_CACHE_BOOKMARKS,
    autoCacheOnScroll: KEYS.AUTO_CACHE_ON_SCROLL,
    cacheMaxMb: KEYS.CACHE_MAX_MB,
    cacheStaleHours: KEYS.CACHE_STALE_HOURS,
    adblockEnabled: KEYS.ADBLOCK_ENABLED,
    readingModeDefault: KEYS.READING_MODE_DEFAULT,
    browserZoom: KEYS.BROWSER_ZOOM,
  }[key];
  await set(storageKey, value);
}

// ─── Per-site settings ────────────────────────────────────────────────────────

export async function getSiteSetting(
  domain: string,
  key: string,
  defaultValue: boolean,
): Promise<boolean> {
  return get<boolean>(`@dv/site/${domain}/${key}`, defaultValue);
}

export async function setSiteSetting(
  domain: string,
  key: string,
  value: boolean,
): Promise<void> {
  await set(`@dv/site/${domain}/${key}`, value);
}

// ─── Search history ───────────────────────────────────────────────────────────

export async function getSearchHistory(): Promise<string[]> {
  return get<string[]>(KEYS.SEARCH_HISTORY, []);
}

export async function addSearchHistory(query: string): Promise<void> {
  const history = await getSearchHistory();
  const updated = [query, ...history.filter(h => h !== query)].slice(0, 20);
  await set(KEYS.SEARCH_HISTORY, updated);
}

export async function clearSearchHistory(): Promise<void> {
  await set(KEYS.SEARCH_HISTORY, []);
}

// ─── Last visited (restore on open) ──────────────────────────────────────────

export async function setLastVisited(sourceId: string, url: string): Promise<void> {
  await set(KEYS.LAST_VISITED, { sourceId, url, at: Date.now() });
}

export async function getLastVisited(): Promise<{ sourceId: string; url: string; at: number } | null> {
  return get<{ sourceId: string; url: string; at: number } | null>(KEYS.LAST_VISITED, null);
}

// ─── Hidden / Pinned sources (in addition to SQLite for runtime use) ──────────

export async function getHiddenSources(): Promise<string[]> {
  return get<string[]>(KEYS.HIDDEN_SOURCES, []);
}

export async function setHiddenSources(ids: string[]): Promise<void> {
  await set(KEYS.HIDDEN_SOURCES, ids);
}

export async function getPinnedSources(): Promise<string[]> {
  return get<string[]>(KEYS.PINNED_SOURCES, []);
}

export async function setPinnedSources(ids: string[]): Promise<void> {
  await set(KEYS.PINNED_SOURCES, ids);
}
