import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/useThemeColor';
import { DOC_SOURCES, DocSource, getAllSources, setCustomSources } from '@/lib/sources';
import {
  addCustomSource,
  deleteCustomSource,
  getAllCustomSources,
  getAllSourcePrefs,
  setSourcePref,
  SourcePref,
} from '@/lib/database';

const EMOJI_PRESETS = ['📚', '🔗', '⚡', '🎨', '🛠️', '🌐', '🔧', '💡', '📖', '🚀', '🔬', '🗂️'];
const COLOR_PRESETS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#06b6d4', '#84cc16'];

export default function BrowseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const bg = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'icon');
  const cardBg = useThemeColor({ light: '#f9fafb', dark: '#1c1c1e' }, 'background');

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [prefs, setPrefs] = useState<Record<string, SourcePref>>({});
  const [showHidden, setShowHidden] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);

  // Add custom source form
  const [formUrl, setFormUrl] = useState('');
  const [formName, setFormName] = useState('');
  const [formIcon, setFormIcon] = useState('🔗');
  const [formColor, setFormColor] = useState('#6366f1');
  const [formCategory, setFormCategory] = useState('Custom');
  const [formDesc, setFormDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const [customs, loadedPrefs] = await Promise.all([getAllCustomSources(), getAllSourcePrefs()]);
    setCustomSources(
      customs.map((c) => ({
        id: c.id,
        name: c.name,
        url: c.url,
        icon: c.icon,
        color: c.color,
        category: c.category,
        description: c.description,
      })),
    );
    setPrefs(loadedPrefs);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const allSources = getAllSources();
  const categories = useMemo(() => ['All', ...new Set(allSources.map((s) => s.category))], [prefs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let sources = allSources.filter((s) => {
      const pref = prefs[s.id];
      if (!showHidden && pref?.hidden) return false;
      if (activeCategory !== 'All' && s.category !== activeCategory) return false;
      if (q) {
        return (
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
    // Pinned to top
    sources.sort((a, b) => {
      const ap = prefs[a.id]?.pinned ? 1 : 0;
      const bp = prefs[b.id]?.pinned ? 1 : 0;
      return bp - ap;
    });
    return sources;
  }, [allSources, prefs, search, activeCategory, showHidden]);

  const handleLongPress = useCallback(
    (source: DocSource) => {
      const pref = prefs[source.id];
      const isPinned = !!pref?.pinned;
      const isHidden = !!pref?.hidden;
      const isCustom = !DOC_SOURCES.find((s) => s.id === source.id);

      const options = [
        isPinned ? '📌 Unpin' : '📌 Pin to top',
        isHidden ? '👁 Show' : '🙈 Hide',
        ...(isCustom ? ['🗑 Delete source'] : []),
        'Cancel',
      ];

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options, cancelButtonIndex: options.length - 1, destructiveButtonIndex: isCustom ? 2 : undefined },
          async (idx) => {
            if (idx === 0) {
              await setSourcePref(source.id, !isPinned, isHidden);
              await loadData();
            } else if (idx === 1) {
              await setSourcePref(source.id, isPinned, !isHidden);
              await loadData();
            } else if (idx === 2 && isCustom) {
              Alert.alert('Delete Source', `Remove "${source.name}"?`, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    await deleteCustomSource(source.id);
                    await loadData();
                  },
                },
              ]);
            }
          },
        );
      } else {
        Alert.alert(source.name, undefined, [
          {
            text: isPinned ? '📌 Unpin' : '📌 Pin to top',
            onPress: async () => {
              await setSourcePref(source.id, !isPinned, isHidden);
              await loadData();
            },
          },
          {
            text: isHidden ? '👁 Show' : '🙈 Hide',
            onPress: async () => {
              await setSourcePref(source.id, isPinned, !isHidden);
              await loadData();
            },
          },
          ...(isCustom
            ? [
                {
                  text: '🗑 Delete source',
                  style: 'destructive' as const,
                  onPress: async () => {
                    await deleteCustomSource(source.id);
                    await loadData();
                  },
                },
              ]
            : []),
          { text: 'Cancel', style: 'cancel' as const },
        ]);
      }
    },
    [prefs, loadData],
  );

  const handleAddSource = useCallback(async () => {
    if (!formUrl.trim() || !formName.trim()) {
      Alert.alert('Error', 'URL and name are required.');
      return;
    }
    setSaving(true);
    try {
      let url = formUrl.trim();
      if (!url.startsWith('http')) url = 'https://' + url;
      const id = 'custom_' + Date.now();
      await addCustomSource({
        id,
        name: formName.trim(),
        url,
        icon: formIcon,
        color: formColor,
        category: formCategory.trim() || 'Custom',
        description: formDesc.trim(),
      });
      await loadData();
      setAddModalVisible(false);
      setFormUrl('');
      setFormName('');
      setFormIcon('🔗');
      setFormColor('#6366f1');
      setFormCategory('Custom');
      setFormDesc('');
    } finally {
      setSaving(false);
    }
  }, [formUrl, formName, formIcon, formColor, formCategory, formDesc, loadData]);

  const renderSource = useCallback(
    ({ item }: { item: DocSource }) => {
      const pref = prefs[item.id];
      const isPinned = !!pref?.pinned;
      const isHidden = !!pref?.hidden;

      return (
        <TouchableOpacity
          style={[styles.sourceCard, { backgroundColor: cardBg, borderColor, opacity: isHidden ? 0.45 : 1 }]}
          onPress={() => router.push(`/browser/${item.id}`)}
          onLongPress={() => handleLongPress(item)}
          activeOpacity={0.75}
        >
          <View style={[styles.iconBadge, { backgroundColor: item.color + '22' }]}>
            <Text style={styles.iconText}>{item.icon}</Text>
          </View>
          <View style={styles.sourceInfo}>
            <View style={styles.sourceNameRow}>
              <Text style={[styles.sourceName, { color: textColor }]} numberOfLines={1}>
                {item.name}
              </Text>
              {isPinned && <Ionicons name="pin" size={12} color={item.color} style={{ marginLeft: 4 }} />}
            </View>
            <Text style={[styles.sourceDesc, { color: borderColor }]} numberOfLines={1}>
              {item.description}
            </Text>
            <View style={[styles.categoryBadge, { backgroundColor: item.color + '22' }]}>
              <Text style={[styles.categoryText, { color: item.color }]}>{item.category}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={borderColor} />
        </TouchableOpacity>
      );
    },
    [prefs, textColor, borderColor, cardBg, router, handleLongPress],
  );

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: borderColor }]}>
        <Text style={[styles.title, { color: textColor }]}>Documentation</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setShowHidden((v) => !v)}
            style={styles.headerBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={showHidden ? 'eye' : 'eye-off-outline'} size={22} color={borderColor} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setAddModalVisible(true)}
            style={styles.headerBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="add-circle-outline" size={26} color="#6366f1" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={[styles.searchBar, { borderColor }]}>
        <Ionicons name="search-outline" size={18} color={borderColor} />
        <TextInput
          style={[styles.searchInput, { color: textColor }]}
          placeholder="Search docs…"
          placeholderTextColor={borderColor}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={borderColor} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}
        keyboardShouldPersistTaps="handled"
      >
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.chip,
              activeCategory === cat && styles.chipActive,
              { borderColor },
              activeCategory === cat && { borderColor: '#6366f1', backgroundColor: '#6366f122' },
            ]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text
              style={[
                styles.chipText,
                { color: activeCategory === cat ? '#6366f1' : textColor },
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Source list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderSource}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 16 }]}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: borderColor }]}>No sources found</Text>
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Add Source Modal */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={[styles.modal, { backgroundColor: bg }]}>
          <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
            <TouchableOpacity onPress={() => setAddModalVisible(false)}>
              <Text style={{ color: '#ef4444', fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: textColor }]}>Add Source</Text>
            <TouchableOpacity onPress={handleAddSource} disabled={saving}>
              <Text style={{ color: '#6366f1', fontSize: 16, fontWeight: '600' }}>
                {saving ? 'Adding…' : 'Add'}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Text style={[styles.fieldLabel, { color: borderColor }]}>URL *</Text>
            <TextInput
              style={[styles.fieldInput, { color: textColor, borderColor }]}
              value={formUrl}
              onChangeText={setFormUrl}
              placeholder="https://docs.example.com"
              placeholderTextColor={borderColor}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={[styles.fieldLabel, { color: borderColor }]}>Name *</Text>
            <TextInput
              style={[styles.fieldInput, { color: textColor, borderColor }]}
              value={formName}
              onChangeText={setFormName}
              placeholder="Documentation name"
              placeholderTextColor={borderColor}
            />
            <Text style={[styles.fieldLabel, { color: borderColor }]}>Description</Text>
            <TextInput
              style={[styles.fieldInput, { color: textColor, borderColor }]}
              value={formDesc}
              onChangeText={setFormDesc}
              placeholder="Short description"
              placeholderTextColor={borderColor}
            />
            <Text style={[styles.fieldLabel, { color: borderColor }]}>Category</Text>
            <TextInput
              style={[styles.fieldInput, { color: textColor, borderColor }]}
              value={formCategory}
              onChangeText={setFormCategory}
              placeholder="Custom"
              placeholderTextColor={borderColor}
            />
            <Text style={[styles.fieldLabel, { color: borderColor }]}>Icon</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {EMOJI_PRESETS.map((e) => (
                <TouchableOpacity
                  key={e}
                  style={[styles.emojiBtn, formIcon === e && { borderColor: '#6366f1', borderWidth: 2 }]}
                  onPress={() => setFormIcon(e)}
                >
                  <Text style={{ fontSize: 24 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={[styles.fieldLabel, { color: borderColor }]}>Color</Text>
            <View style={styles.colorRow}>
              {COLOR_PRESETS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorSwatch, { backgroundColor: c }, formColor === c && styles.colorActive]}
                  onPress={() => setFormColor(c)}
                />
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
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
  title: { fontSize: 24, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  headerBtn: { padding: 4 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15 },
  categoryRow: { paddingHorizontal: 12, gap: 8, paddingBottom: 8, flexDirection: 'row' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipActive: {},
  chipText: { fontSize: 13, fontWeight: '500' },
  list: { paddingHorizontal: 12, paddingTop: 8 },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 22 },
  sourceInfo: { flex: 1, gap: 2 },
  sourceNameRow: { flexDirection: 'row', alignItems: 'center' },
  sourceName: { fontSize: 15, fontWeight: '600', flex: 1 },
  sourceDesc: { fontSize: 12 },
  categoryBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  categoryText: { fontSize: 11, fontWeight: '600' },
  emptyText: { textAlign: 'center', marginTop: 60, fontSize: 15 },
  // Modal
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 17, fontWeight: '600' },
  modalBody: { padding: 16, gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4, marginTop: 12 },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  emojiBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  colorRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  colorSwatch: { width: 32, height: 32, borderRadius: 16 },
  colorActive: { borderWidth: 3, borderColor: '#fff' },
});
