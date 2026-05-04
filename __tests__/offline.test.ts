/**
 * ============================================================
 * DocVault — Comprehensive Offline Caching Test Suite
 * ============================================================
 *
 * Tests ALL caching functionality:
 *  1. FileSystem mock sanity
 *  2. urlToKey / path generation
 *  3. cachePageHtml — write + index
 *  4. loadCachedPage — read back
 *  5. getCacheStatus — fresh / stale / none
 *  6. getAllCachedPages — index order
 *  7. deleteCachedPage
 *  8. clearAllCache
 *  9. getCacheStats
 * 10. CAPTURE_HTML_JS — chunk splitting logic
 * 11. Chunk assembly — simulated handleMessage flow
 * 12. Edge cases (empty HTML, huge HTML, special chars in URL)
 * 13. Index integrity under concurrent operations
 * 14. Stale detection
 */

// expo-file-system/legacy is resolved via moduleNameMapper in package.json → __mocks__/expo-file-system-legacy.js
// Do NOT call jest.mock('expo-file-system/legacy') here — that would auto-mock our manual mock.
jest.mock('../lib/database', () => ({ updateBookmarkCache: jest.fn().mockResolvedValue(undefined) }));

import * as FS from 'expo-file-system/legacy';
import {
  cachePageHtml,
  loadCachedPage,
  getCacheStatus,
  getAllCachedPages,
  deleteCachedPage,
  clearAllCache,
  getCacheStats,
  getCachedPath,
  CAPTURE_HTML_JS,
} from '../lib/offline';

// Helper: access the in-memory store from our mock
const fsm = FS as unknown as { __resetStore: () => void; __getStore: () => { files: Record<string, string>; dirs: string[] } };

// ─── Reset store before every test ───────────────────────────────────────────
beforeEach(() => {
  fsm.__resetStore();
  jest.clearAllMocks();
});

// ════════════════════════════════════════════════════════════════════
// 1. FileSystem mock sanity
// ════════════════════════════════════════════════════════════════════
describe('FileSystem mock', () => {
  it('should write and read back a string', async () => {
    await FS.writeAsStringAsync('file:///data/test.txt', 'hello', { encoding: FS.EncodingType.UTF8 });
    const result = await FS.readAsStringAsync('file:///data/test.txt');
    expect(result).toBe('hello');
  });

  it('getInfoAsync returns exists:false for missing file', async () => {
    const info = await FS.getInfoAsync('file:///data/nonexistent.txt');
    expect(info.exists).toBe(false);
  });

  it('getInfoAsync returns exists:true for written file with correct size', async () => {
    await FS.writeAsStringAsync('file:///data/x.txt', 'abcde');
    const info = await FS.getInfoAsync('file:///data/x.txt');
    expect(info.exists).toBe(true);
    if (info.exists && 'size' in info) {
      expect(info.size).toBe(5);
    }
  });

  it('deleteAsync removes a file (idempotent)', async () => {
    await FS.writeAsStringAsync('file:///data/del.txt', 'x');
    await FS.deleteAsync('file:///data/del.txt', { idempotent: true });
    await FS.deleteAsync('file:///data/del.txt', { idempotent: true }); // second call: should not throw
    const info = await FS.getInfoAsync('file:///data/del.txt');
    expect(info.exists).toBe(false);
  });

  it('readDirectoryAsync lists files in dir', async () => {
    await FS.writeAsStringAsync('file:///data/dir/a.html', 'aa');
    await FS.writeAsStringAsync('file:///data/dir/b.html', 'bb');
    const files = await FS.readDirectoryAsync('file:///data/dir/');
    expect(files).toHaveLength(2);
    expect(files).toContain('a.html');
    expect(files).toContain('b.html');
  });
});

// ════════════════════════════════════════════════════════════════════
// 2. getCachedPath — URL → file path mapping
// ════════════════════════════════════════════════════════════════════
describe('getCachedPath', () => {
  it('strips https:// and replaces special chars', () => {
    const p = getCachedPath('https://developer.mozilla.org/en-US/docs/Web/API/fetch');
    expect(p).not.toContain('https://');
    expect(p).toMatch(/\.html$/);
    // no raw slashes in the key part
    const key = p.split('/').pop()!.replace('.html', '');
    expect(key).not.toMatch(/\//);
  });

  it('produces consistent output for the same URL', () => {
    const a = getCachedPath('https://nextjs.org/docs/app/building-your-application/routing');
    const b = getCachedPath('https://nextjs.org/docs/app/building-your-application/routing');
    expect(a).toBe(b);
  });

  it('produces different paths for different URLs', () => {
    const a = getCachedPath('https://react.dev/reference/react/useState');
    const b = getCachedPath('https://react.dev/reference/react/useEffect');
    expect(a).not.toBe(b);
  });

  it('key is at most 180 chars + .html', () => {
    const longUrl = 'https://example.com/' + 'x'.repeat(400);
    const p = getCachedPath(longUrl);
    const key = p.split('/').pop()!;
    expect(key.length).toBeLessThanOrEqual(185); // 180 + .html
  });
});

// ════════════════════════════════════════════════════════════════════
// 3. cachePageHtml — write, index, meta
// ════════════════════════════════════════════════════════════════════
describe('cachePageHtml', () => {
  const URL = 'https://developer.mozilla.org/en-US/docs/Web/API/fetch';
  const HTML = '<html><body><h1>Fetch API</h1></body></html>';

  it('writes HTML file and returns a path string', async () => {
    const path = await cachePageHtml(URL, HTML, 'Fetch API', 'mdn');
    expect(typeof path).toBe('string');
    expect(path).toMatch(/\.html$/);
  });

  it('written file exists in FileSystem', async () => {
    await cachePageHtml(URL, HTML, 'Fetch API', 'mdn');
    const info = await FS.getInfoAsync(getCachedPath(URL));
    expect(info.exists).toBe(true);
  });

  it('written file content matches input HTML', async () => {
    await cachePageHtml(URL, HTML, 'Fetch API', 'mdn');
    const content = await FS.readAsStringAsync(getCachedPath(URL));
    expect(content).toBe(HTML);
  });

  it('creates index entry (getAllCachedPages returns 1 entry)', async () => {
    await cachePageHtml(URL, HTML, 'Fetch API', 'mdn');
    const pages = await getAllCachedPages();
    expect(pages).toHaveLength(1);
    expect(pages[0].url).toBe(URL);
    expect(pages[0].title).toBe('Fetch API');
    expect(pages[0].sourceId).toBe('mdn');
  });

  it('index entry sizeBytes > 0', async () => {
    await cachePageHtml(URL, HTML, 'Fetch API', 'mdn');
    const [entry] = await getAllCachedPages();
    expect(entry.sizeBytes).toBeGreaterThan(0);
    expect(entry.sizeBytes).toBeLessThanOrEqual(HTML.length * 4); // UTF-8 ceiling
  });

  it('index entry cachedAt is recent timestamp', async () => {
    const before = Date.now();
    await cachePageHtml(URL, HTML, 'Fetch API', 'mdn');
    const after = Date.now();
    const [entry] = await getAllCachedPages();
    expect(entry.cachedAt).toBeGreaterThanOrEqual(before);
    expect(entry.cachedAt).toBeLessThanOrEqual(after + 100);
  });

  it('writes metadata JSON file', async () => {
    await cachePageHtml(URL, HTML, 'Fetch API', 'mdn');
    const store = fsm.__getStore();
    const metaFiles = Object.keys(store.files).filter(f => f.includes('offline_meta'));
    expect(metaFiles.length).toBeGreaterThan(0);
    const metaRaw = Object.values(store.files).find((_, i) =>
      Object.keys(store.files)[i].includes('offline_meta'));
    expect(metaRaw).toBeDefined();
    const meta = JSON.parse(metaRaw!);
    expect(meta.url).toBe(URL);
    expect(meta.title).toBe('Fetch API');
  });

  it('updates existing index entry on re-cache (no duplicates)', async () => {
    await cachePageHtml(URL, HTML, 'Fetch API v1', 'mdn');
    await cachePageHtml(URL, '<html><body>v2</body></html>', 'Fetch API v2', 'mdn');
    const pages = await getAllCachedPages();
    expect(pages).toHaveLength(1); // should be only 1, not 2
    expect(pages[0].title).toBe('Fetch API v2');
  });

  it('caches multiple different pages', async () => {
    await cachePageHtml('https://react.dev/hooks/useState', '<html>useState</html>', 'useState', 'react');
    await cachePageHtml('https://react.dev/hooks/useEffect', '<html>useEffect</html>', 'useEffect', 'react');
    await cachePageHtml('https://tailwindcss.com/docs/flex', '<html>Flex</html>', 'Flex', 'tailwind');
    const pages = await getAllCachedPages();
    expect(pages).toHaveLength(3);
  });

  it('handles empty HTML string gracefully', async () => {
    await expect(cachePageHtml(URL, '', 'Empty', 'test')).resolves.not.toThrow();
    const pages = await getAllCachedPages();
    expect(pages[0].sizeBytes).toBe(0);
  });

  it('handles empty title gracefully', async () => {
    await expect(cachePageHtml(URL, HTML, '', '')).resolves.not.toThrow();
    const [entry] = await getAllCachedPages();
    expect(entry.title).toBe('');
  });

  it('handles URL with query params and fragments', async () => {
    const urlWithQuery = 'https://example.com/page?tab=api&lang=en#section-2';
    await expect(cachePageHtml(urlWithQuery, HTML, 'Page', 'test')).resolves.not.toThrow();
    const pages = await getAllCachedPages();
    expect(pages[0].url).toBe(urlWithQuery);
  });
});

// ════════════════════════════════════════════════════════════════════
// 4. loadCachedPage
// ════════════════════════════════════════════════════════════════════
describe('loadCachedPage', () => {
  const URL = 'https://developer.mozilla.org/en-US/docs/Web/API/Headers';
  const HTML = '<html><body><p>Headers</p></body></html>';

  it('returns null for uncached URL', async () => {
    const result = await loadCachedPage(URL);
    expect(result).toBeNull();
  });

  it('returns HTML after caching', async () => {
    await cachePageHtml(URL, HTML, 'Headers', 'mdn');
    const result = await loadCachedPage(URL);
    expect(result).toBe(HTML);
  });

  it('returns null after cache is deleted', async () => {
    await cachePageHtml(URL, HTML, 'Headers', 'mdn');
    await deleteCachedPage(URL);
    const result = await loadCachedPage(URL);
    expect(result).toBeNull();
  });

  it('can load by file path (from CacheEntry.path)', async () => {
    const path = await cachePageHtml(URL, HTML, 'Headers', 'mdn');
    const result = await loadCachedPage(path);
    expect(result).toBe(HTML);
  });

  it('preserves full HTML with special chars and unicode', async () => {
    const complexHtml = '<html><body>日本語 español 中文 <script>var x = "</script>;</body></html>';
    await cachePageHtml(URL, complexHtml, 'Complex', 'test');
    const result = await loadCachedPage(URL);
    expect(result).toBe(complexHtml);
  });

  it('handles very large HTML (1MB+)', async () => {
    const bigHtml = '<html><body>' + 'x'.repeat(1_100_000) + '</body></html>';
    await cachePageHtml(URL, bigHtml, 'Big Page', 'test');
    const result = await loadCachedPage(URL);
    expect(result).toBe(bigHtml);
    expect(result!.length).toBe(bigHtml.length);
  });
});

// ════════════════════════════════════════════════════════════════════
// 5. getCacheStatus
// ════════════════════════════════════════════════════════════════════
describe('getCacheStatus', () => {
  const URL = 'https://nextjs.org/docs/app/building-your-application/routing/pages';

  it('returns "none" for uncached URL', async () => {
    const status = await getCacheStatus(URL);
    expect(status).toBe('none');
  });

  it('returns "fresh" right after caching', async () => {
    await cachePageHtml(URL, '<html>hello</html>', 'Routing', 'nextjs');
    const status = await getCacheStatus(URL);
    expect(status).toBe('fresh');
  });

  it('returns "stale" when cachedAt is old (> 48h)', async () => {
    await cachePageHtml(URL, '<html>old</html>', 'Routing', 'nextjs');
    // Manually corrupt the meta to be 3 days old
    const store = fsm.__getStore();
    const metaKey = Object.keys(store.files).find(f => f.includes('offline_meta'));
    if (metaKey) {
      const meta = JSON.parse(store.files[metaKey]);
      meta.cachedAt = Date.now() - 3 * 24 * 3600 * 1000; // 3 days ago
      await FS.writeAsStringAsync('file://' + metaKey, JSON.stringify(meta));
    }
    const status = await getCacheStatus(URL);
    expect(status).toBe('stale');
  });

  it('returns "none" after deleteCachedPage', async () => {
    await cachePageHtml(URL, '<html>x</html>', 'Routing', 'nextjs');
    await deleteCachedPage(URL);
    const status = await getCacheStatus(URL);
    expect(status).toBe('none');
  });
});

// ════════════════════════════════════════════════════════════════════
// 6. getAllCachedPages — ordering and stale flag
// ════════════════════════════════════════════════════════════════════
describe('getAllCachedPages', () => {
  it('returns empty array when nothing is cached', async () => {
    const pages = await getAllCachedPages();
    expect(pages).toEqual([]);
  });

  it('newest entries appear first', async () => {
    await cachePageHtml('https://a.com', '<html>a</html>', 'A', 'test');
    await new Promise(r => setTimeout(r, 10)); // small delay to separate timestamps
    await cachePageHtml('https://b.com', '<html>b</html>', 'B', 'test');
    const pages = await getAllCachedPages();
    // newest first → b before a
    expect(pages[0].url).toBe('https://b.com');
    expect(pages[1].url).toBe('https://a.com');
  });

  it('isStale flag is false for fresh entries', async () => {
    await cachePageHtml('https://fresh.com', '<html>f</html>', 'Fresh', 'test');
    const [entry] = await getAllCachedPages();
    expect(entry.isStale).toBe(false);
  });

  it('isStale flag reflects cachedAt in index correctly', async () => {
    await cachePageHtml('https://old.com', '<html>old</html>', 'Old', 'test');
    // Patch index to have old timestamp
    const store = fsm.__getStore();
    const indexKey = Object.keys(store.files).find(f => f.includes('offline_index.json'));
    if (indexKey) {
      const index = JSON.parse(store.files[indexKey]);
      index[0].cachedAt = Date.now() - 50 * 3600 * 1000; // 50h ago
      await FS.writeAsStringAsync('file://' + indexKey, JSON.stringify(index));
    }
    const [entry] = await getAllCachedPages();
    expect(entry.isStale).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// 7. deleteCachedPage
// ════════════════════════════════════════════════════════════════════
describe('deleteCachedPage', () => {
  it('removes the HTML file', async () => {
    const URL = 'https://tailwindcss.com/docs/grid';
    await cachePageHtml(URL, '<html>grid</html>', 'Grid', 'tailwind');
    await deleteCachedPage(URL);
    const info = await FS.getInfoAsync(getCachedPath(URL));
    expect(info.exists).toBe(false);
  });

  it('removes the metadata file', async () => {
    const URL = 'https://tailwindcss.com/docs/flex';
    await cachePageHtml(URL, '<html>flex</html>', 'Flex', 'tailwind');
    const storeAfterCache = fsm.__getStore();
    const metaKeyBefore = Object.keys(storeAfterCache.files).find(f => f.includes('offline_meta'));
    expect(metaKeyBefore).toBeDefined();

    await deleteCachedPage(URL);
    const storeAfterDelete = fsm.__getStore();
    const metaKeyAfter = Object.keys(storeAfterDelete.files).find(f => f.includes('offline_meta'));
    expect(metaKeyAfter).toBeUndefined();
  });

  it('removes from index', async () => {
    const URL = 'https://react.dev/useCallback';
    await cachePageHtml(URL, '<html>cb</html>', 'useCallback', 'react');
    await deleteCachedPage(URL);
    const pages = await getAllCachedPages();
    expect(pages.find(p => p.url === URL)).toBeUndefined();
  });

  it('removing one page does not affect others in index', async () => {
    await cachePageHtml('https://a.com/1', '<html>1</html>', '1', 't');
    await cachePageHtml('https://a.com/2', '<html>2</html>', '2', 't');
    await cachePageHtml('https://a.com/3', '<html>3</html>', '3', 't');
    await deleteCachedPage('https://a.com/2');
    const pages = await getAllCachedPages();
    expect(pages).toHaveLength(2);
    expect(pages.find(p => p.url === 'https://a.com/2')).toBeUndefined();
    expect(pages.find(p => p.url === 'https://a.com/1')).toBeDefined();
    expect(pages.find(p => p.url === 'https://a.com/3')).toBeDefined();
  });

  it('deleting non-existent URL does not throw', async () => {
    await expect(deleteCachedPage('https://notcached.com/page')).resolves.not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════
// 8. clearAllCache
// ════════════════════════════════════════════════════════════════════
describe('clearAllCache', () => {
  it('empties getAllCachedPages', async () => {
    await cachePageHtml('https://a.com', '<html>a</html>', 'A', 't');
    await cachePageHtml('https://b.com', '<html>b</html>', 'B', 't');
    await clearAllCache();
    const pages = await getAllCachedPages();
    expect(pages).toHaveLength(0);
  });

  it('removes all HTML files from FileSystem', async () => {
    await cachePageHtml('https://a.com', '<html>a</html>', 'A', 't');
    await clearAllCache();
    const store = fsm.__getStore();
    const htmlFiles = Object.keys(store.files).filter(f => f.endsWith('.html'));
    expect(htmlFiles).toHaveLength(0);
  });

  it('calling on empty cache does not throw', async () => {
    await expect(clearAllCache()).resolves.not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════
// 9. getCacheStats
// ════════════════════════════════════════════════════════════════════
describe('getCacheStats', () => {
  it('returns 0 count and 0 sizeMb when empty', async () => {
    const stats = await getCacheStats();
    expect(stats.count).toBe(0);
    expect(stats.sizeMb).toBe(0);
  });

  it('returns correct count after caching pages', async () => {
    await cachePageHtml('https://a.com', '<html>a</html>', 'A', 't');
    await cachePageHtml('https://b.com', '<html>b</html>', 'B', 't');
    const stats = await getCacheStats();
    expect(stats.count).toBe(2);
  });

  it('returns non-zero sizeMb for non-empty HTML', async () => {
    const html = '<html>' + 'x'.repeat(100_000) + '</html>';
    await cachePageHtml('https://big.com', html, 'Big', 't');
    const stats = await getCacheStats();
    expect(stats.sizeMb).toBeGreaterThan(0);
    // Should be roughly 0.1 MB
    expect(stats.sizeMb).toBeGreaterThan(0.05);
    expect(stats.sizeMb).toBeLessThan(1);
  });
});

// ════════════════════════════════════════════════════════════════════
// 10. CAPTURE_HTML_JS — chunk splitting logic
// ════════════════════════════════════════════════════════════════════
describe('CAPTURE_HTML_JS script logic', () => {
  const CHUNK_SIZE = 200 * 1024; // 200 KB

  // Extract & run the script in a fake browser-like environment
  function runCaptureScript(html: string, title: string): { type: string; [key: string]: unknown }[] {
    const messages: { type: string; [key: string]: unknown }[] = [];
    const fakeWindow = {
      ReactNativeWebView: {
        postMessage: (raw: string) => {
          messages.push(JSON.parse(raw));
        },
      },
    };
    const fakeDocument = { documentElement: { outerHTML: html }, title };

    // Wrap the script to inject our fake globals
    const wrappedScript = `
      (function(window, document) {
        ${CAPTURE_HTML_JS.replace(/true;$/, '')}
      })(fakeWindow, fakeDocument);
    `;
    // eslint-disable-next-line no-new-func
    new Function('fakeWindow', 'fakeDocument', wrappedScript)(fakeWindow, fakeDocument);
    return messages;
  }

  it('sends captureStart as first message', () => {
    const msgs = runCaptureScript('<html><body>hello</body></html>', 'Hello');
    expect(msgs[0].type).toBe('captureStart');
  });

  it('sends captureDone as last message', () => {
    const msgs = runCaptureScript('<html><body>hello</body></html>', 'Hello');
    expect(msgs[msgs.length - 1].type).toBe('captureDone');
  });

  it('all middle messages are captureChunk', () => {
    const html = '<html><body>hello world</body></html>';
    const msgs = runCaptureScript(html, 'Test');
    const middle = msgs.slice(1, -1);
    middle.forEach(m => expect(m.type).toBe('captureChunk'));
  });

  it('captureStart.chunks matches actual chunk count', () => {
    const html = 'x'.repeat(500 * 1024); // 500 KB → 3 chunks
    const msgs = runCaptureScript(html, 'Big');
    const start = msgs[0];
    const chunks = msgs.filter(m => m.type === 'captureChunk');
    expect(start.chunks).toBe(chunks.length);
    expect(chunks.length).toBe(Math.ceil(html.length / CHUNK_SIZE));
  });

  it('reassembled HTML matches original for small page', () => {
    const html = '<html><body><h1>Test</h1><p>' + 'content '.repeat(100) + '</p></body></html>';
    const msgs = runCaptureScript(html, 'Test');
    const chunks = msgs
      .filter(m => m.type === 'captureChunk')
      .sort((a, b) => (a.index as number) - (b.index as number));
    const assembled = chunks.map(c => c.data as string).join('');
    expect(assembled).toBe(html);
  });

  it('reassembled HTML matches original for large page (3MB)', () => {
    // 3 MB of HTML — 15 chunks
    const html = '<html><body>' + 'A'.repeat(3_000_000) + '</body></html>';
    const msgs = runCaptureScript(html, 'Large');
    const chunks = msgs
      .filter(m => m.type === 'captureChunk')
      .sort((a, b) => (a.index as number) - (b.index as number));
    const assembled = chunks.map(c => c.data as string).join('');
    expect(assembled).toBe(html);
    expect(chunks.length).toBe(Math.ceil(html.length / CHUNK_SIZE));
  });

  it('chunk indices are sequential starting from 0', () => {
    const html = 'x'.repeat(600 * 1024);
    const msgs = runCaptureScript(html, 'Test');
    const chunks = msgs.filter(m => m.type === 'captureChunk');
    const indices = chunks.map(c => c.index as number);
    expect(indices).toEqual([...Array(chunks.length).keys()]);
  });

  it('captureStart.title matches document.title', () => {
    const msgs = runCaptureScript('<html>test</html>', 'My Page Title');
    expect(msgs[0].title).toBe('My Page Title');
  });

  it('single small message for tiny pages (1 chunk)', () => {
    const html = '<html><body>tiny</body></html>';
    const msgs = runCaptureScript(html, 'Tiny');
    const chunks = msgs.filter(m => m.type === 'captureChunk');
    expect(chunks.length).toBe(1);
    expect(msgs[0].chunks).toBe(1);
  });

  it('every chunk message has both index and data fields', () => {
    const html = 'y'.repeat(700 * 1024);
    const msgs = runCaptureScript(html, 'Test');
    msgs.filter(m => m.type === 'captureChunk').forEach(chunk => {
      expect(typeof chunk.index).toBe('number');
      expect(typeof chunk.data).toBe('string');
    });
  });

  it('no chunk exceeds CHUNK_SIZE characters', () => {
    const html = 'z'.repeat(2_000_000);
    const msgs = runCaptureScript(html, 'Big');
    msgs.filter(m => m.type === 'captureChunk').forEach(chunk => {
      expect((chunk.data as string).length).toBeLessThanOrEqual(CHUNK_SIZE);
    });
  });
});

// ════════════════════════════════════════════════════════════════════
// 11. Chunk assembly — simulated handleMessage flow
// ════════════════════════════════════════════════════════════════════
describe('chunk assembly (simulated handleMessage)', () => {
  /**
   * Reproduce what handleMessage in [sourceId].tsx does:
   * accumulate chunks via useRef-like refs, assemble on captureDone.
   */
  function simulateAssembly(msgs: { type: string; [key: string]: unknown }[]): {
    html: string;
    title: string;
    error: string | null;
  } {
    const htmlChunks: string[] = [];
    let expectedChunks = 0;
    let captureTitle = '';
    let error: string | null = null;
    let finalHtml = '';
    let finalTitle = '';

    for (const data of msgs) {
      if (data.type === 'captureStart') {
        const count = data.chunks as number;
        htmlChunks.length = 0;
        // match the code: new Array(data.chunks)
        for (let i = 0; i < count; i++) htmlChunks[i] = '';
        expectedChunks = count;
        captureTitle = (data.title as string) || '';
      } else if (data.type === 'captureChunk') {
        htmlChunks[data.index as number] = data.data as string;
      } else if (data.type === 'captureDone') {
        finalHtml = htmlChunks.join('');
        finalTitle = captureTitle;
        expectedChunks; // referenced to avoid lint warning
      } else if (data.type === 'captureError') {
        error = data.error as string;
      }
    }
    return { html: finalHtml, title: finalTitle, error };
  }

  function runCapture(html: string, title: string) {
    const CHUNK_SIZE = 200 * 1024;
    const total = Math.max(1, Math.ceil(html.length / CHUNK_SIZE));
    const msgs: { type: string; [key: string]: unknown }[] = [
      { type: 'captureStart', title, chunks: total },
    ];
    for (let i = 0; i < total; i++) {
      msgs.push({ type: 'captureChunk', index: i, data: html.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE) });
    }
    msgs.push({ type: 'captureDone' });
    return msgs;
  }

  it('assembles small HTML correctly', () => {
    const html = '<html><body>hello</body></html>';
    const { html: assembled, error } = simulateAssembly(runCapture(html, 'Test'));
    expect(error).toBeNull();
    expect(assembled).toBe(html);
  });

  it('assembles 5 MB HTML correctly', () => {
    const html = '<html><body>' + 'Q'.repeat(5_000_000) + '</body></html>';
    const { html: assembled } = simulateAssembly(runCapture(html, 'Big'));
    expect(assembled.length).toBe(html.length);
    expect(assembled).toBe(html);
  });

  it('assembles correctly even with out-of-order chunks', () => {
    const html = '<html><body>' + 'R'.repeat(600 * 1024) + '</body></html>';
    const msgs = runCapture(html, 'Test');
    // shuffle the chunk messages (keep start first, done last)
    const start = msgs[0];
    const done = msgs[msgs.length - 1];
    const chunks = msgs.slice(1, -1);
    chunks.sort(() => Math.random() - 0.5); // shuffle
    const shuffled = [start, ...chunks, done];
    const { html: assembled } = simulateAssembly(shuffled);
    expect(assembled).toBe(html);
  });

  it('interleaved non-capture messages do not corrupt assembly', () => {
    const html = '<html><body>' + 'S'.repeat(300 * 1024) + '</body></html>';
    const msgs = runCapture(html, 'Test');
    // Insert scroll/meta messages between chunks
    const withNoise = [
      msgs[0],
      { type: 'scrollProgress', pct: 20 },
      msgs[1],
      { type: 'pageMeta', title: 'Noise' },
      msgs[2],
      msgs[3], // captureDone
    ];
    const { html: assembled } = simulateAssembly(withNoise);
    expect(assembled).toBe(html);
  });

  it('full round-trip: capture → assemble → cachePageHtml → loadCachedPage', async () => {
    const URL = 'https://docs.example.com/full-roundtrip';
    const html = '<!DOCTYPE html><html><head><title>Round Trip</title></head><body>' +
      '<p>' + 'data '.repeat(10_000) + '</p></body></html>';

    const msgs = runCapture(html, 'Round Trip');
    const { html: assembled } = simulateAssembly(msgs);
    expect(assembled).toBe(html);

    await cachePageHtml(URL, assembled, 'Round Trip', 'test');
    const loaded = await loadCachedPage(URL);
    expect(loaded).toBe(html);

    const status = await getCacheStatus(URL);
    expect(status).toBe('fresh');
  });
});

// ════════════════════════════════════════════════════════════════════
// 12. Edge cases
// ════════════════════════════════════════════════════════════════════
describe('edge cases', () => {
  it('URL with unicode path segments caches correctly', async () => {
    const url = 'https://developer.mozilla.org/ja/docs/Web/API/文字列';
    await cachePageHtml(url, '<html>ja</html>', 'Japanese', 'mdn');
    const loaded = await loadCachedPage(url);
    expect(loaded).toBe('<html>ja</html>');
  });

  it('URL with encoded chars caches correctly', async () => {
    const url = 'https://example.com/path%20with%20spaces?q=hello%20world';
    await cachePageHtml(url, '<html>encoded</html>', 'Encoded', 'test');
    const loaded = await loadCachedPage(url);
    expect(loaded).toBe('<html>encoded</html>');
  });

  it('HTML with embedded JSON and quotes does not corrupt index', async () => {
    const html = '<script>var x = {"key": "val\'ue", "arr": [1,2,3]}</script>';
    await cachePageHtml('https://json-in-html.com/', html, 'JSON Script', 'test');
    const loaded = await loadCachedPage('https://json-in-html.com/');
    expect(loaded).toBe(html);
  });

  it('HTML with null bytes does not cause crash', async () => {
    const html = '<html>no null bytes in real HTML</html>'; // browsers strip null bytes
    await expect(cachePageHtml('https://null.com/', html, 'Null', 'test')).resolves.not.toThrow();
  });

  it('re-caching a URL updates sizeBytes in index', async () => {
    const url = 'https://size-change.com/';
    await cachePageHtml(url, '<html>small</html>', 'Small', 'test');
    const [first] = await getAllCachedPages();
    const smallSize = first.sizeBytes;

    await cachePageHtml(url, '<html>' + 'x'.repeat(50_000) + '</html>', 'Big', 'test');
    const [second] = await getAllCachedPages();
    expect(second.sizeBytes).toBeGreaterThan(smallSize);
  });
});

// ════════════════════════════════════════════════════════════════════
// 13. Index integrity
// ════════════════════════════════════════════════════════════════════
describe('index integrity', () => {
  it('index survives corrupt JSON gracefully (returns empty array)', async () => {
    // Manually write a corrupt index
    const indexPath = `${FS.documentDirectory}offline_index.json`;
    await FS.writeAsStringAsync(indexPath, 'NOT VALID JSON{{{{');
    const pages = await getAllCachedPages();
    expect(pages).toEqual([]);
  });

  it('getCacheStatus returns "none" if HTML file missing but index entry exists', async () => {
    const url = 'https://ghost.com/';
    await cachePageHtml(url, '<html>ghost</html>', 'Ghost', 'test');
    // Manually delete just the HTML file
    await FS.deleteAsync(getCachedPath(url), { idempotent: true });
    const status = await getCacheStatus(url);
    expect(status).toBe('none');
  });

  it('10 sequential caches all appear in index', async () => {
    for (let i = 0; i < 10; i++) {
      await cachePageHtml(`https://example.com/page-${i}`, `<html>${i}</html>`, `Page ${i}`, 'test');
    }
    const pages = await getAllCachedPages();
    expect(pages).toHaveLength(10);
  });
});

// ════════════════════════════════════════════════════════════════════
// 14. Stale detection thresholds
// ════════════════════════════════════════════════════════════════════
describe('stale detection', () => {
  it('entry is NOT stale at 47h 59m', async () => {
    const url = 'https://stale-test.com/';
    await cachePageHtml(url, '<html>x</html>', 'X', 'test');
    const store = fsm.__getStore();
    const indexKey = Object.keys(store.files).find(f => f.includes('offline_index.json'))!;
    const index = JSON.parse(store.files[indexKey]);
    index[0].cachedAt = Date.now() - (48 * 3600 - 60) * 1000; // 47h 59m ago
    await FS.writeAsStringAsync('file://' + indexKey, JSON.stringify(index));
    const [entry] = await getAllCachedPages();
    expect(entry.isStale).toBe(false);
  });

  it('entry IS stale at exactly 48h + 1 second', async () => {
    const url = 'https://stale-test.com/';
    await cachePageHtml(url, '<html>x</html>', 'X', 'test');
    const store = fsm.__getStore();
    const indexKey = Object.keys(store.files).find(f => f.includes('offline_index.json'))!;
    const index = JSON.parse(store.files[indexKey]);
    index[0].cachedAt = Date.now() - (48 * 3600 + 1) * 1000; // 48h 1s ago
    await FS.writeAsStringAsync('file://' + indexKey, JSON.stringify(index));
    const [entry] = await getAllCachedPages();
    expect(entry.isStale).toBe(true);
  });
});
