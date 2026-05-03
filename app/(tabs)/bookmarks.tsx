import React, { useCallback, useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Bookmark, clearAllBookmarks, getAllBookmarks, removeBookmark } from '@/lib/database';
import { exportBookmarks, importBookmarks, shareBookmark } from '@/lib/exportImport';

export default function BookmarksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const bg = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'icon');
  const cardBg = useThemeColor({ light: '#f9fafb', dark: '#1c1c1e' }, 'background');

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  const load = useCallback(async () => {
    setBookmarks(await getAllBookmarks());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = useCallback(
    async (bm: Bookmark) => {
      await removeBookmark(bm.url);
      await load();
    },
    [load],
  );

  const handleLongPress = useCallback(
    (bm: Bookmark) => {
      const options = ['📋 Copy URL', '📄 Share as Markdown', '📦 Share as JSON', '🗑 Delete', 'Cancel'];
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options, cancelButtonIndex: 4, destructiveButtonIndex: 3 },
          async (idx) => {
            if (idx === 0) await shareBookmark(bm, 'url');
            else if (idx === 1) await shareBookmark(bm, 'markdown');
            else if (idx === 2) await shareBookmark(bm, 'json');
            else if (idx === 3) await handleDelete(bm);
          },
        );
      } else {
        Alert.alert(bm.title, bm.url, [
          { text: '📋 Copy URL', onPress: () => shareBookmark(bm, 'url') },
          { text: '📄 Share as Markdown', onPress: () => shareBookmark(bm, 'markdown') },
          { text: '📦 Share as JSON', onPress: () => shareBookmark(bm, 'json') },
          { text: '🗑 Delete', style: 'destructive', onPress: () => handleDelete(bm) },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }
    },
    [handleDelete],
  );

  const handleClearAll = useCallback(() => {
    Alert.alert('Clear Bookmarks', 'Remove all bookmarks? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          await clearAllBookmarks();
          await load();
        },
      },
    ]);
  }, [load]);

  const handleExport = useCallback((format: 'json' | 'markdown') => {
    exportBookmarks(format).catch((e) => Alert.alert('Export failed', String(e)));
  }, []);

  const handleImport = useCallback(async () => {
    const result = await importBookmarks();
    await load();
    Alert.alert(
      'Import complete',
      `Imported: ${result.imported}\nSkipped: ${result.skipped}${result.errors ? `\nErrors: ${result.errors}` : ''}`,
    );
  }, [load]);

  const handleExportMenu = useCallback(() => {
    const opts = ['📄 Export as Markdown', '📦 Export as JSON', '📥 Import from JSON', 'Cancel'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: opts, cancelButtonIndex: 3 },
        (idx) => {
          if (idx === 0) handleExport('markdown');
          else if (idx === 1) handleExport('json');
          else if (idx === 2) handleImport();
        },
      );
    } else {
      Alert.alert('Bookmarks', undefined, [
        { text: '📄 Export Markdown', onPress: () => handleExport('markdown') },
        { text: '📦 Export JSON', onPress: () => handleExport('json') },
        { text: '📥 Import JSON', onPress: handleImport },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [handleExport, handleImport]);

  const renderItem = useCallback(
    ({ item }: { item: Bookmark }) => (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: cardBg, borderColor }]}
        onPress={() => router.push(`/browser/${item.sourceId || 'mdn'}?url=${encodeURIComponent(item.url)}`)}
        onLongPress={() => handleLongPress(item)}
        activeOpacity={0.75}
      >
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            {item.cachedPath && (
              <Ionicons name="cloud-done-outline" size={13} color="#10b981" style={{ marginRight: 4 }} />
            )}
            <Text style={[styles.cardTitle, { color: textColor }]} numberOfLines={2}>
              {item.title}
            </Text>
          </View>
          <Text style={[styles.cardUrl, { color: borderColor }]} numberOfLines={1}>
            {item.url}
          </Text>
          <Text style={[styles.cardDate, { color: borderColor }]}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
        </TouchableOpacity>
      </TouchableOpacity>
    ),
    [textColor, borderColor, cardBg, router, handleDelete, handleLongPress],
  );

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: borderColor }]}>
        <Text style={[styles.title, { color: textColor }]}>
          Bookmarks {bookmarks.length > 0 ? `(${bookmarks.length})` : ''}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={handleExportMenu}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="share-outline" size={22} color="#6366f1" />
          </TouchableOpacity>
          {bookmarks.length > 0 && (
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={handleClearAll}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={22} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={bookmarks}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 16 }]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="star-outline" size={48} color={borderColor} />
            <Text style={[styles.emptyTitle, { color: textColor }]}>No bookmarks yet</Text>
            <Text style={[styles.emptyText, { color: borderColor }]}>
              Tap the ⭐ in the browser toolbar to save pages.
            </Text>
            <TouchableOpacity style={styles.importBtn} onPress={handleImport}>
              <Ionicons name="download-outline" size={18} color="#6366f1" />
              <Text style={{ color: '#6366f1', fontWeight: '600' }}>Import Bookmarks</Text>
            </TouchableOpacity>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 22, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerBtn: { padding: 6 },
  list: { paddingHorizontal: 12, paddingTop: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  cardContent: { flex: 1, gap: 3 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '600', flex: 1 },
  cardUrl: { fontSize: 12 },
  cardDate: { fontSize: 11 },
  deleteBtn: { padding: 4 },
  emptyContainer: {
    alignItems: 'center',
    gap: 10,
    marginTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyText: { fontSize: 14, textAlign: 'center' },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
});
