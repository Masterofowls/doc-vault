import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/useThemeColor';
import { CacheEntry, clearAllCache, deleteCachedPage, getAllCachedPages } from '@/lib/offline';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function CachedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const bg = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'icon');
  const cardBg = useThemeColor({ light: '#f9fafb', dark: '#1c1c1e' }, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const subText = useThemeColor({ light: '#6b7280', dark: '#9ca3af' }, 'text');

  const [pages, setPages] = useState<CacheEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await getAllCachedPages();
      setPages(all.sort((a, b) => b.cachedAt - a.cachedAt));
    } catch (e) {
      Alert.alert('Error', String(e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const totalBytes = pages.reduce((s, p) => s + p.sizeBytes, 0);

  const handleDelete = useCallback(async (entry: CacheEntry) => {
    Alert.alert('Delete cached page?', entry.title || entry.url, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteCachedPage(entry.url);
          await load();
        },
      },
    ]);
  }, [load]);

  const handleClearAll = useCallback(() => {
    Alert.alert('Clear all cached pages?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          await clearAllCache();
          await load();
        },
      },
    ]);
  }, [load]);

  const handleOpen = useCallback((entry: CacheEntry) => {
    const sid = entry.sourceId ?? 'web';
    router.push(`/browser/${sid}?url=${encodeURIComponent(entry.url)}`);
  }, [router]);

  const renderItem = ({ item }: { item: CacheEntry }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: cardBg, borderColor }]}
      onPress={() => handleOpen(item)}
      onLongPress={() => handleDelete(item)}
      activeOpacity={0.75}
    >
      <View style={styles.cardRow}>
        <Ionicons
          name={item.isStale ? 'cloud-outline' : 'cloud-done'}
          size={20}
          color={item.isStale ? '#f59e0b' : '#22c55e'}
          style={{ marginRight: 10, marginTop: 2 }}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: textColor }]} numberOfLines={1}>
            {item.title || item.url}
          </Text>
          <Text style={[styles.cardUrl, { color: subText }]} numberOfLines={1}>
            {item.url}
          </Text>
          <View style={styles.cardMeta}>
            <Text style={[styles.metaText, { color: subText }]}>
              {formatDate(item.cachedAt)}
            </Text>
            <Text style={[styles.metaText, { color: subText }]}>
              {formatBytes(item.sizeBytes)}
            </Text>
            {item.isStale && (
              <View style={styles.staleBadge}>
                <Text style={styles.staleText}>⚠️ Stale</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6, backgroundColor: bg, borderBottomColor: borderColor }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: textColor }]}>Cached Pages</Text>
          {pages.length > 0 && (
            <Text style={[styles.subtitle, { color: subText }]}>
              {pages.length} page{pages.length !== 1 ? 's' : ''} · {formatBytes(totalBytes)}
            </Text>
          )}
        </View>
        {pages.length > 0 && (
          <TouchableOpacity style={styles.clearBtn} onPress={handleClearAll}>
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
            <Text style={styles.clearBtnText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      <FlatList
        data={pages}
        keyExtractor={item => item.url}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.list,
          pages.length === 0 && styles.emptyList,
          { paddingBottom: insets.bottom + 16 },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tintColor} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="cloud-offline-outline" size={56} color={borderColor} />
            <Text style={[styles.emptyTitle, { color: textColor }]}>No Cached Pages</Text>
            <Text style={[styles.emptyMsg, { color: subText }]}>
              Tap the ☁ button while browsing to save a page for offline use.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 2 },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  clearBtnText: { fontSize: 13, fontWeight: '600', color: '#ef4444' },

  list: { padding: 12, gap: 10 },
  emptyList: { flex: 1 },

  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cardTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  cardUrl: { fontSize: 11, marginBottom: 4 },
  cardMeta: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  metaText: { fontSize: 11 },
  staleBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  staleText: { fontSize: 10, color: '#92400e', fontWeight: '600' },
  deleteBtn: { padding: 4, marginLeft: 8 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyMsg: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
