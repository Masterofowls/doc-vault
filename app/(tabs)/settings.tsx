import { Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, useColorScheme, View } from 'react-native';
import { Text } from '../../components/ui/text';
import { useBrowserStore } from '../../store/browserStore';
import { clearHistory } from '../../lib/database';
import { useState } from 'react';

function SettingRow({
  icon,
  label,
  description,
  right,
}: {
  icon: string;
  label: string;
  description?: string;
  right?: React.ReactNode;
}) {
  const isDark = useColorScheme() === 'dark';
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' },
      ]}
    >
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: isDark ? '#f1f5f9' : '#0f172a', fontSize: 14, fontWeight: '600' }}>
          {label}
        </Text>
        {description && (
          <Text style={{ color: isDark ? '#64748b' : '#94a3b8', fontSize: 12, marginTop: 2 }}>
            {description}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}

export default function SettingsScreen() {
  const isDark = useColorScheme() === 'dark';
  const { adBlockEnabled, darkModeInjection, toggleAdBlock, toggleDarkMode } = useBrowserStore();
  const [historyCleared, setHistoryCleared] = useState(false);

  const bg = isDark ? '#0a0a0a' : '#f1f5f9';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#94a3b8' : '#64748b';

  const handleClearHistory = async () => {
    await clearHistory();
    setHistoryCleared(true);
    setTimeout(() => setHistoryCleared(false), 2000);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>⚙️ Settings</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

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

        <Text style={[styles.section, { color: subColor }]}>DATA</Text>
        <SettingRow
          icon="🕐"
          label="Clear History"
          description="Remove all browsing history"
          right={
            <Pressable onPress={handleClearHistory} style={styles.btn}>
              <Text style={styles.btnText}>
                {historyCleared ? '✓ Cleared' : 'Clear'}
              </Text>
            </Pressable>
          }
        />

        <Text style={[styles.section, { color: subColor }]}>ABOUT</Text>
        <SettingRow
          icon="📚"
          label="DocVault"
          description="Ultimate documentation browser"
        />
        <SettingRow
          icon="🔢"
          label="Version"
          description="1.0.0"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
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
});
