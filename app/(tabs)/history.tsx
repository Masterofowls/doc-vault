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
import { clearHistory, deleteHistoryEntry, getAllHistory, HistoryEntry } from '../../lib/database';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function HistoryScreen() {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const load = useCallback(async () => {
    const data = await getAllHistory();
    setHistory(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleClearAll = () => {
    Alert.alert('Clear History', 'Remove all browsing history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearHistory();
          await load();
        },
      },
    ]);
  };

  const handleDelete = async (id: number) => {
    await deleteHistoryEntry(id);
    await load();
  };

  const bg = isDark ? '#0a0a0a' : '#f1f5f9';
  const cardBg = isDark ? '#1a1a1a' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>🕐 History</Text>
        {history.length > 0 && (
          <Pressable onPress={handleClearAll}>
            <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600' }}>Clear all</Text>
          </Pressable>
        )}
      </View>

      <FlashList
        data={history}
        estimatedItemSize={68}
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
              <Text style={[styles.cardTime, { color: subColor }]}>{timeAgo(item.visitedAt)}</Text>
            </View>
            <Pressable onPress={() => handleDelete(item.id)} hitSlop={12}>
              <Text style={{ fontSize: 16 }}>✕</Text>
            </Pressable>
          </Pressable>
        )}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 80 }}>
            <Text style={{ fontSize: 48 }}>🕐</Text>
            <Text style={[{ fontSize: 16, fontWeight: '600', marginTop: 12 }, { color: subColor }]}>
              No history yet
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
  },
  cardMain: { flex: 1, marginRight: 8 },
  cardTitle: { fontSize: 14, fontWeight: '600' },
  cardUrl: { fontSize: 11, marginTop: 2 },
  cardTime: { fontSize: 10, marginTop: 4 },
});
