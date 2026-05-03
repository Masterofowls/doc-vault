import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { Text } from '../../components/ui/text';
import {
  CATEGORIES,
  DOC_SOURCES,
  DocSource,
  getSourcesByCategory,
  searchSources,
} from '../../lib/sources';

function SourceCard({ source, onPress }: { source: DocSource; onPress: () => void }) {
  const isDark = useColorScheme() === 'dark';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: isDark ? '#1a1a1a' : '#f8fafc', opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[styles.cardAccent, { backgroundColor: source.color }]} />
      <View style={styles.cardBody}>
        <Text style={styles.cardIcon}>{source.icon}</Text>
        <View style={styles.cardText}>
          <Text style={[styles.cardName, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>
            {source.name}
          </Text>
          <Text style={[styles.cardDesc, { color: isDark ? '#94a3b8' : '#64748b' }]} numberOfLines={1}>
            {source.description}
          </Text>
        </View>
        <View style={[styles.cardBadge, { backgroundColor: source.color + '22' }]}>
          <Text style={[styles.cardBadgeText, { color: source.color }]}>{source.category}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function BrowseScreen() {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filtered =
    query.length > 0
      ? searchSources(query)
      : selectedCategory
        ? getSourcesByCategory(selectedCategory)
        : DOC_SOURCES;

  const bg = isDark ? '#0a0a0a' : '#f1f5f9';
  const inputBg = isDark ? '#1a1a1a' : '#ffffff';
  const inputBorder = isDark ? '#2d2d2d' : '#e2e8f0';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={bg}
      />

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: textColor }]}>📚 DocVault</Text>
        <Text style={[styles.headerSub, { color: isDark ? '#94a3b8' : '#64748b' }]}>
          {DOC_SOURCES.length} documentation sources
        </Text>
      </View>

      {/* Search */}
      <View style={[styles.searchBox, { backgroundColor: inputBg, borderColor: inputBorder }]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search docs..."
          placeholderTextColor={isDark ? '#4b5563' : '#9ca3af'}
          style={[styles.searchInput, { color: textColor }]}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')}>
            <Text style={{ fontSize: 18, color: isDark ? '#9ca3af' : '#6b7280' }}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Category chips */}
      <FlashList
        data={['All', ...CATEGORIES]}
        horizontal
        estimatedItemSize={80}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 6 }}
        renderItem={({ item }) => {
          const active = item === 'All' ? selectedCategory === null : selectedCategory === item;
          return (
            <Pressable
              onPress={() => setSelectedCategory(item === 'All' ? null : item)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? '#2563eb' : isDark ? '#1a1a1a' : '#ffffff',
                  borderColor: active ? '#2563eb' : inputBorder,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? '#fff' : isDark ? '#94a3b8' : '#64748b' }]}>
                {item}
              </Text>
            </Pressable>
          );
        }}
        keyExtractor={(item) => item}
      />

      {/* Source list */}
      <FlashList
        data={filtered}
        estimatedItemSize={72}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <SourceCard
            source={item}
            onPress={() =>
              router.push({
                pathname: '/browser/[sourceId]',
                params: { sourceId: item.id, url: item.url },
              })
            }
          />
        )}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Text style={{ fontSize: 40 }}>🔍</Text>
            <Text style={{ color: isDark ? '#64748b' : '#94a3b8', marginTop: 8 }}>No results found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerSub: { fontSize: 12, marginTop: 2 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 15 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: { fontSize: 12, fontWeight: '600' },
  card: {
    flexDirection: 'row',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    minHeight: 66,
  },
  cardAccent: { width: 4 },
  cardBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  cardIcon: { fontSize: 26 },
  cardText: { flex: 1 },
  cardName: { fontSize: 14, fontWeight: '700' },
  cardDesc: { fontSize: 12, marginTop: 2 },
  cardBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  cardBadgeText: { fontSize: 10, fontWeight: '600' },
});
