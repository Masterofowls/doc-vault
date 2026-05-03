import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components/ui/text';
import { useBrowserStore } from '../../store/browserStore';
import { clearHistory } from '../../lib/database';
import { clearAllCache, getCacheStats } from '../../lib/offline';
import { exportBookmarks, importBookmarks } from '../../lib/exportImport';
import { useThemeColor } from '@/hooks/useThemeColor';

interface SettingRowProps {
  icon: string;
  label: string;
  description?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}
function SettingRow({ icon, label, description, right, onPress }: SettingRowProps) {
  const textColor = useThemeColor({}, 'text');
  const subColor = useThemeColor({}, 'icon');
  const cardBg = useThemeColor({ light: '#ffffff', dark: '#1a1a1a' }, 'background');

  return (
    <Pressable
      style={[styles.row, { backgroundColor: cardBg }]}
      onPress={onPress}
      android_ripple={onPress ? { color: '#88888822' } : undefined}
    >
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: textColor, fontSize: 14, fontWeight: '600' }}>{label}</Text>
        {description && (
          <Text style={{ color: subColor, fontSize: 12, marginTop: 2 }}>{description}</Text>
        )}
      </View>
      {right}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { adBlockEnabled, darkModeInjection, toggleAdBlock, toggleDarkMode } = useBrowserStore();

  const bg = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const subColor = useThemeColor({}, 'icon');

  const [historyCleared, setHistoryCleared] = useState(false);
  const [cacheStats, setCacheStats] = useState({ count: 0, sizeMb: 0 });

  const loadStats = useCallback(async () => {
    setCacheStats(await getCacheStats());
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleClearHistory = async () => {
    await clearHistory();
    setHistoryCleared(true);
    setTimeout(() => setHistoryCleared(false), 2000);
  };

  const handleClearCache = useCallback(() => {
    Alert.alert('Clear Offline Cache', `Remove ${cacheStats.count} cached pages (${cacheStats.sizeMb} MB)?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearAllCache();
          loadStats();
          Alert.alert('Done', 'Offline cache cleared.');
        },
      },
    ]);
  }, [cacheStats, loadStats]);

  const handleExport = useCallback((format: 'json' | 'markdown') => {
    exportBookmarks(format).catch((e) => Alert.alert('Export failed', String(e)));
  }, []);

  const handleImport = useCallback(async () => {
    const result = await importBookmarks();
    Alert.alert(
      'Import complete',
      `Imported: ${result.imported}\nSkipped: ${result.skipped}${result.errors ? `\nErrors: ${result.errors}` : ''}`,
    );
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.title, { color: textColor }]}>⚙️ Settings</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>

        <Text style={[styles.section, { color: subColor }]}>BROWSING</Text>
        <SettingRow
          icon="🚫"
          label="Ad Blocker"
          description="Block ads and trackers"
          right={<Switch value={adBlockEnabled} onValueChange={toggleAdBlock} />}
        />
        <SettingRow
          icon="🌙"
          label="Dark Mode Injection"
          description="Force dark mode on all sites"
          right={<Switch value={darkModeInjection} onValueChange={toggleDarkMode} />}
        />

        <Text style={[styles.section, { color: subColor }]}>BOOKMARKS</Text>
        <SettingRow
          icon="📄"
          label="Export as Markdown"
          description="Share all bookmarks as .md"
          onPress={() => handleExport('markdown')}
          right={<Text style={styles.arrow}>›</Text>}
        />
        <SettingRow
          icon="📦"
          label="Export as JSON"
          description="Share all bookmarks as .json"
          onPress={() => handleExport('json')}
          right={<Text style={styles.arrow}>›</Text>}
        />
        <SettingRow
          icon="📥"
          label="Import Bookmarks"
          description="Import from a JSON file"
          onPress={handleImport}
          right={<Text style={styles.arrow}>›</Text>}
        />

        <Text style={[styles.section, { color: subColor }]}>DATA</Text>
        <SettingRow
          icon="💾"
          label="Offline Cache"
          description={
            cacheStats.count > 0
              ? `${cacheStats.count} page${cacheStats.count !== 1 ? 's' : ''} — ${cacheStats.sizeMb} MB`
              : 'No pages cached'
          }
          onPress={cacheStats.count > 0 ? handleClearCache : undefined}
          right={
            cacheStats.count > 0 ? (
              <Pressable onPress={handleClearCache} style={[styles.btn, { backgroundColor: '#ef4444' }]}>
                <Text style={styles.btnText}>Clear</Text>
              </Pressable>
            ) : null
          }
        />
        <SettingRow
          icon="🕐"
          label="Clear History"
          description="Remove all browsing history"
          right={
            <Pressable onPress={handleClearHistory} style={styles.btn}>
              <Text style={styles.btnText}>{historyCleared ? '✓ Cleared' : 'Clear'}</Text>
            </Pressable>
          }
        />

        <Text style={[styles.section, { color: subColor }]}>ABOUT</Text>
        <SettingRow icon="📚" label="DocVault" description="Ultimate documentation browser · v1.1.0" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800' },
  section: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginHorizontal: 12,
    marginBottom: 1,
    borderRadius: 10,
    gap: 12,
  },
  rowIcon: { fontSize: 20 },
  btn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  arrow: { fontSize: 20, color: '#94a3b8' },
});
