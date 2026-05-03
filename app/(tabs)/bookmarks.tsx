import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
import { Text } from '../../components/ui/text';
import { Bookmark, clearAllBookmarks, getAllBookmarks, removeBookmark } from '../../lib/database';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function BookmarksScreen() {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  const load = useCallback(async () => {
    const data = await getAllBookmarks();
    setBookmarks(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (url: string) => {
    await removeBookmark(url);
    await load();
  };

  const handleClearAll = () => {
    Alert.alert('Clear Bookmarks', 'Remove all bookmarks?', [
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
  };

  const bg = isDark ? '#0a0a0a' : '#f1f5f9';
  const cardBg = isDark ? '#1a1a1a' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>⭐ Bookmarks</Text>
        {bookmarks.length > 0 && (
          <Pressable onPress={handleClearAll}>
            <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600' }}>Clear all</Text>
          </Pressable>
        )}
      </View>

      <FlashList
        data={bookmarks}
        estimatedItemSize={72}
        onRefresh={load}
        refreshing={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/browser/[sourceId]',
                params: { sourceId: item.sourceId, url: item.url },
              })
            }
            style={[styles.card, { backgroundColor: cardBg }]}
          >
            <View style={styles.cardMain}>
              <Text style={[styles.cardTitle, { color: textColor }]} numberOfLines={1}>
                {item.title || item.url}
              </Text>
              <Text style={[styles.cardUrl, { color: subColor }]} numberOfLines={1}>
                {item.url}
              </Text>
              <Text style={[styles.cardTime, { color: subColor }]}>{timeAgo(item.createdAt)}</Text>
            </View>
            <Pressable
              onPress={() => handleDelete(item.url)}
              style={styles.deleteBtn}
              hitSlop={12}
            >
              <Text style={{ fontSize: 16 }}>🗑️</Text>
            </Pressable>
          </Pressable>
        )}
        keyExtractor={(item) => item.url}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 48 }}>⭐</Text>
            <Text style={[styles.emptyText, { color: subColor }]}>No bookmarks yet</Text>
            <Text style={{ color: subColor, fontSize: 12, marginTop: 4 }}>
              Tap the star in the browser to save pages
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '800' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  cardMain: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '600' },
  cardUrl: { fontSize: 11, marginTop: 2 },
  cardTime: { fontSize: 10, marginTop: 4 },
  deleteBtn: { padding: 4 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 12 },
});
