import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Bookmark, getAllBookmarks, addBookmark } from './database';

function formatDate(ts: number): string {
  return new Date(ts).toISOString().split('T')[0];
}

export function bookmarkToMarkdown(bm: Bookmark): string {
  return `## ${bm.title}\n\n[${bm.title}](${bm.url})\n\n- **Source**: ${bm.sourceId}\n- **Saved**: ${formatDate(bm.createdAt)}\n`;
}

export function bookmarksToMarkdown(bookmarks: Bookmark[]): string {
  const lines = ['# DocVault Bookmarks\n', `> Exported on ${new Date().toLocaleDateString()}\n`];
  for (const bm of bookmarks) {
    lines.push(bookmarkToMarkdown(bm));
  }
  return lines.join('\n');
}

export function bookmarksToJson(bookmarks: Bookmark[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      version: 1,
      bookmarks: bookmarks.map((bm) => ({
        url: bm.url,
        title: bm.title,
        sourceId: bm.sourceId,
        savedAt: bm.createdAt,
      })),
    },
    null,
    2,
  );
}

export async function exportBookmarks(format: 'json' | 'markdown'): Promise<void> {
  const bookmarks = await getAllBookmarks();
  const ext = format === 'json' ? 'json' : 'md';
  const content = format === 'json' ? bookmarksToJson(bookmarks) : bookmarksToMarkdown(bookmarks);
  const filename = `docvault-bookmarks-${Date.now()}.${ext}`;
  const path = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, content, { encoding: FileSystem.EncodingType.UTF8 });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(path, {
      mimeType: format === 'json' ? 'application/json' : 'text/markdown',
      dialogTitle: 'Export Bookmarks',
      UTI: format === 'json' ? 'public.json' : 'net.daringfireball.markdown',
    });
  }
}

export async function shareBookmark(bm: Bookmark, format: 'markdown' | 'json' | 'url'): Promise<void> {
  let content: string;
  if (format === 'url') {
    content = bm.url;
  } else if (format === 'markdown') {
    content = bookmarkToMarkdown(bm);
  } else {
    content = JSON.stringify({ url: bm.url, title: bm.title, sourceId: bm.sourceId, savedAt: bm.createdAt }, null, 2);
  }
  const filename = `bookmark-${Date.now()}.${format === 'url' ? 'txt' : format === 'markdown' ? 'md' : 'json'}`;
  const path = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, content);
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(path, { dialogTitle: 'Share Bookmark' });
  }
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
}

export async function importBookmarks(): Promise<ImportResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/json', '*/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) {
    return { imported: 0, skipped: 0, errors: 0 };
  }
  const asset = result.assets[0];
  const content = await FileSystem.readAsStringAsync(asset.uri);
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  try {
    const data = JSON.parse(content);
    const bookmarks: { url: string; title: string; sourceId?: string }[] = Array.isArray(data)
      ? data
      : data.bookmarks ?? [];
    for (const bm of bookmarks) {
      if (!bm.url || !bm.title) { skipped++; continue; }
      try {
        await addBookmark(bm.url, bm.title, bm.sourceId ?? 'import');
        imported++;
      } catch {
        skipped++;
      }
    }
  } catch {
    errors++;
  }
  return { imported, skipped, errors };
}
