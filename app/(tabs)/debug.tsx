import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { Text } from '../../components/ui/text';
import { debugLog, LogEntry } from '../../lib/debugLog';
import { NativeDocVault } from '../../lib/nativeModule';
import { usePermissions } from '../../hooks/usePermissions';

export default function DebugScreen() {
  const isDark = useColorScheme() === 'dark';
  const bg = isDark ? '#0f0f0f' : '#f9fafb';
  const card = isDark ? '#1a1a2e' : '#ffffff';
  const border = isDark ? '#1e293b' : '#e2e8f0';
  const text = isDark ? '#e2e8f0' : '#1e293b';
  const muted = isDark ? '#64748b' : '#94a3b8';

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [storageInfo, setStorageInfo] = useState<Record<string, string | number | boolean>>({});
  const perms = usePermissions();

  useEffect(() => {
    const unsub = debugLog.subscribe(setLogs);
    loadStorageInfo();
    return unsub;
  }, []);

  const loadStorageInfo = useCallback(async () => {
    try {
      const info = await NativeDocVault.getStorageInfo();
      setStorageInfo(info as unknown as Record<string, string | number | boolean>);
    } catch (e) {
      debugLog.error('DebugScreen', `getStorageInfo failed: ${String(e)}`);
    }
  }, []);

  const levelColor = (level: string) => {
    if (level === 'error') return '#ef4444';
    if (level === 'warn') return '#f59e0b';
    return isDark ? '#60a5fa' : '#2563eb';
  };

  const renderLog = ({ item }: { item: LogEntry }) => (
    <View style={[styles.logRow, { borderBottomColor: border }]}>
      <Text style={[styles.logLevel, { color: levelColor(item.level) }]}>
        [{item.level.toUpperCase()}]
      </Text>
      <Text style={[styles.logTag, { color: muted }]}>[{item.tag}]</Text>
      <Text style={[styles.logMsg, { color: text }]}>{item.msg}</Text>
      <Text style={[styles.logTs, { color: muted }]}>
        {new Date(item.ts).toTimeString().slice(0, 8)}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.header, { backgroundColor: card, borderBottomColor: border }]}>
        <Text style={[styles.title, { color: text }]}>🔧 Debug Panel</Text>
        <TouchableOpacity
          onPress={() => {
            debugLog.clearAll().then(() => loadStorageInfo());
            Alert.alert('Debug', 'Logs cleared');
          }}
          style={[styles.btn, { backgroundColor: '#ef4444' }]}
        >
          <Text style={styles.btnText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.infoSection}>
        {/* Permissions */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>📋 Permissions (SDK {perms.sdkInt})</Text>
          {Object.entries(perms.statuses).map(([k, v]) => (
            <Text key={k} style={[styles.infoRow, { color: v ? '#22c55e' : '#ef4444' }]}>
              {v ? '✅' : '❌'} {k}
            </Text>
          ))}
          {!perms.checked && <Text style={{ color: muted }}>Checking…</Text>}
        </View>

        {/* Storage info */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>💾 Storage Info</Text>
          {Object.entries(storageInfo).map(([k, v]) => (
            <Text key={k} style={[styles.infoRow, { color: text }]}>
              <Text style={{ color: muted }}>{k}: </Text>{String(v)}
            </Text>
          ))}
          <TouchableOpacity
            onPress={loadStorageInfo}
            style={[styles.btn, { backgroundColor: isDark ? '#1d4ed8' : '#3b82f6', marginTop: 8 }]}
          >
            <Text style={styles.btnText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Log entries */}
      <View style={[styles.logSection, { backgroundColor: card, borderTopColor: border }]}>
        <Text style={[styles.cardTitle, { color: text, paddingHorizontal: 12, paddingTop: 8 }]}>
          📜 Logs ({logs.length})
        </Text>
        <FlatList
          data={[...logs].reverse()}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderLog}
          style={{ flex: 1 }}
        />
      </View>
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
    paddingTop: 52,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: { fontSize: 16, fontWeight: '700' },
  btn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  infoSection: { maxHeight: 260 },
  card: { margin: 12, padding: 12, borderRadius: 8, borderWidth: 1 },
  cardTitle: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  infoRow: { fontSize: 11, fontFamily: 'monospace', marginBottom: 2 },
  logSection: { flex: 1, borderTopWidth: 1 },
  logRow: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logLevel: { fontSize: 10, fontWeight: '700', fontFamily: 'monospace' },
  logTag: { fontSize: 10, fontFamily: 'monospace' },
  logMsg: { fontSize: 11, fontFamily: 'monospace', flexShrink: 1 },
  logTs: { fontSize: 9, fontFamily: 'monospace', marginTop: 1 },
});
