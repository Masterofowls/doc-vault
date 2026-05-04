/**
 * In-memory mock for expo-file-system/legacy.
 * Simulates the full FileSystem API used by offline.ts.
 */

const store = new Map(); // path → string content
const dirStore = new Set(); // paths that are directories

const EncodingType = {
  UTF8: 'utf8',
  Base64: 'base64',
};

const documentDirectory = 'file:///data/user/0/com.docvault.app/files/';

function normPath(p) {
  return p.startsWith('file://') ? p.slice(7) : p;
}

async function getInfoAsync(path) {
  const p = normPath(path);
  if (dirStore.has(p)) return { exists: true, isDirectory: true };
  if (store.has(p)) {
    const buf = Buffer.from(store.get(p), 'utf8');
    return { exists: true, isDirectory: false, size: buf.length };
  }
  return { exists: false };
}

async function makeDirectoryAsync(path) {
  const p = normPath(path);
  dirStore.add(p);
}

async function writeAsStringAsync(path, content) {
  const p = normPath(path);
  // Ensure parent dir exists (simulate fs behaviour)
  const parentDir = p.substring(0, p.lastIndexOf('/'));
  dirStore.add(parentDir);
  store.set(p, content);
}

async function readAsStringAsync(path) {
  const p = normPath(path);
  if (!store.has(p)) throw new Error(`File not found: ${path}`);
  return store.get(p);
}

async function deleteAsync(path, opts = {}) {
  const p = normPath(path);
  if (!store.has(p) && !dirStore.has(p)) {
    if (opts && opts.idempotent) return;
    throw new Error(`Cannot delete: ${path} does not exist`);
  }
  store.delete(p);
  dirStore.delete(p);
  // Also delete children (simulate rmdir -rf)
  for (const k of [...store.keys()]) {
    if (k.startsWith(p + '/') || k.startsWith(p)) store.delete(k);
  }
  for (const k of [...dirStore.keys()]) {
    if (k.startsWith(p + '/') || k.startsWith(p)) dirStore.delete(k);
  }
}

async function readDirectoryAsync(dir) {
  const p = normPath(dir).replace(/\/$/, '');
  const results = [];
  for (const k of store.keys()) {
    if (k.startsWith(p + '/')) {
      const rel = k.slice(p.length + 1);
      if (!rel.includes('/')) results.push(rel);
    }
  }
  return results;
}

// Expose internal state for test assertions
function __resetStore() {
  store.clear();
  dirStore.clear();
}
function __getStore() {
  return { files: Object.fromEntries(store), dirs: [...dirStore] };
}

module.exports = {
  EncodingType,
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  writeAsStringAsync,
  readAsStringAsync,
  deleteAsync,
  readDirectoryAsync,
  __resetStore,
  __getStore,
};
