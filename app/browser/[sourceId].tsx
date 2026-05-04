import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation, WebViewMessageEvent } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useThemeColor } from '@/hooks/useThemeColor';
import {
  addBookmark,
  addHistory,
  isBookmarked,
  removeBookmark,
} from '@/lib/database';
import { getSourceById } from '@/lib/sources';
import {
  buildInjection,
  buildReadingModeToggle,
  DARK_MODE_CSS,
  MOBILE_USER_AGENT,
} from '@/lib/injection';
import {
  CAPTURE_HTML_JS,
  EXTRACT_META_JS,
  SCROLL_PROGRESS_JS,
  cachePageHtml,
  getCacheStatus,
  loadCachedPage,
} from '@/lib/offline';
import { shareBookmark } from '@/lib/exportImport';
import { getSettings, setSetting, setLastVisited } from '@/lib/storage';

const toast = (msg: string) => {
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
};

export default function BrowserScreen() {
  const { sourceId: rawSourceId, url: initialUrl } = useLocalSearchParams<{ sourceId: string; url?: string }>();
  // useLocalSearchParams can return string[] — always coerce to a single string
  const sourceId = Array.isArray(rawSourceId) ? (rawSourceId[0] ?? '') : (rawSourceId ?? '');
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const source = getSourceById(sourceId);
  const startUrl = (Array.isArray(initialUrl) ? initialUrl[0] : initialUrl) ?? source?.url ?? 'https://developer.mozilla.org';

  // ── Navigation state ──────────────────────────────────────────────────────
  const [currentUrl, setCurrentUrl] = useState(startUrl);
  const [displayUrl, setDisplayUrl] = useState(startUrl);
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState(startUrl);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [pageTitle, setPageTitle] = useState(source?.name ?? '');

  // ── Bookmark & cache state ────────────────────────────────────────────────
  const [bookmarked, setBookmarked] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<'fresh' | 'stale' | 'none'>('none');
  const [offlineMode, setOfflineMode] = useState(false);        // single-page offline view
  const [globalOfflineMode, setGlobalOfflineMode] = useState(false); // all-pages offline mode
  const [offlineHtml, setOfflineHtml] = useState<string | null>(null);
  const [capturingCache, setCapturingCache] = useState(false);

  // Chunk assembly refs — reused across chunks for a single capture session
  const htmlChunks = useRef<string[]>([]);
  const expectedChunks = useRef<number>(0);
  const captureTitle = useRef<string>('');

  // ── Reading / display state ───────────────────────────────────────────────
  const [readingMode, setReadingMode] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [fontSize, setFontSize] = useState(17);
  const [showMenu, setShowMenu] = useState<'share' | 'settings' | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const webviewRef = useRef<WebView>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // ── Theme ─────────────────────────────────────────────────────────────────
  const bg = useThemeColor({}, 'background');
  const tintColor = source?.color ?? '#6366f1';
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'icon');
  const cardBg = useThemeColor({ light: '#f4f4f5', dark: '#1c1c1e' }, 'background');

  // ── Load persisted settings ───────────────────────────────────────────────
  useEffect(() => {
    getSettings().then(s => {
      setFontSize(s.readingFontSize);
      setDarkMode(s.darkModeOverride);
      if (s.readingModeDefault) setReadingMode(true);
    });
  }, []);

  // ── Check bookmark + cache status on URL change ───────────────────────────
  useEffect(() => {
    isBookmarked(currentUrl).then(setBookmarked);
    getCacheStatus(currentUrl).then(setCacheStatus);
    setLastVisited(sourceId, currentUrl).catch(() => {});
  }, [currentUrl, sourceId]);

  // ── Animate progress bar ──────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  // ── Nav state handler ─────────────────────────────────────────────────────
  const handleNavState = useCallback(
    (state: WebViewNavigation) => {
      setCanGoBack(state.canGoBack);
      setCanGoForward(state.canGoForward);
      if (state.url) {
        setCurrentUrl(state.url);
        setDisplayUrl(state.url);
        setUrlInput(state.url);
      }
      if (state.title) setPageTitle(state.title);
      if (!state.loading && state.url && state.url !== 'about:blank') {
        addHistory(state.url, state.title || state.url, sourceId).catch(() => {});
        isBookmarked(state.url).then(setBookmarked);
        getCacheStatus(state.url).then(setCacheStatus);
      }
    },
    [sourceId],
  );

  // ── Message handler from WebView ──────────────────────────────────────────
  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);

        if (data.type === 'captureStart') {
          // Reset chunk buffer for new capture
          htmlChunks.current = new Array(data.chunks as number);
          expectedChunks.current = data.chunks as number;
          captureTitle.current = (data.title as string) || pageTitle;

        } else if (data.type === 'captureChunk') {
          htmlChunks.current[data.index as number] = data.data as string;

        } else if (data.type === 'captureDone') {
          const html = htmlChunks.current.join('');
          const title = captureTitle.current || pageTitle;
          htmlChunks.current = [];
          expectedChunks.current = 0;
          try {
            await cachePageHtml(currentUrl, html, title, sourceId);
            setOfflineHtml(html);
            setCacheStatus('fresh');
            toast('📥 Page cached for offline use');
          } catch (cacheErr) {
            console.error('[DocVault Cache] cachePageHtml failed:', cacheErr);
            Alert.alert('Cache error', `Failed to save page: ${String(cacheErr)}`);
          } finally {
            setCapturingCache(false);
          }

        } else if (data.type === 'captureError') {
          setCapturingCache(false);
          htmlChunks.current = [];
          expectedChunks.current = 0;
          Alert.alert('Cache error', String(data.error));

        } else if (data.type === 'scrollProgress') {
          setScrollProgress(data.pct as number);

        } else if (data.type === 'pageMeta') {
          if (data.title && !pageTitle) setPageTitle(data.title as string);
        }
      } catch (e) {
        console.error('[DocVault Cache] handleMessage error:', e);
        setCapturingCache(false);
        Alert.alert('Cache error', String(e));
      }
    },
    [currentUrl, pageTitle, sourceId],
  );

  // ── Bookmark toggle ───────────────────────────────────────────────────────
  const handleToggleBookmark = useCallback(async () => {
    try {
      if (bookmarked) {
        await removeBookmark(currentUrl);
        setBookmarked(false);
        toast('Bookmark removed');
      } else {
        await addBookmark(currentUrl, pageTitle || currentUrl, sourceId);
        setBookmarked(true);
        toast('⭐ Bookmarked');
        // Auto-cache when bookmarking (if setting enabled)
        const settings = await getSettings();
        if (settings.autoCacheBookmarks && cacheStatus === 'none') {
          setCapturingCache(true);
          webviewRef.current?.injectJavaScript(CAPTURE_HTML_JS);
          // Safety timeout — reset if WebView never sends captureHtml message
          setTimeout(() => setCapturingCache(false), 15000);
        }
      }
    } catch (e) {
      Alert.alert('Bookmark error', String(e));
    }
  }, [bookmarked, currentUrl, pageTitle, sourceId, cacheStatus]);

  // ── Cache page ────────────────────────────────────────────────────────────
  const handleCachePage = useCallback(async () => {
    if (capturingCache) return;
    try {
      setCapturingCache(true);
      webviewRef.current?.injectJavaScript(CAPTURE_HTML_JS);
      // Safety timeout — reset if WebView never sends captureHtml message back
      setTimeout(() => setCapturingCache(false), 15000);
      if (!bookmarked) {
        await addBookmark(currentUrl, pageTitle || currentUrl, sourceId);
        setBookmarked(true);
      }
    } catch (e) {
      setCapturingCache(false);
      Alert.alert('Cache error', String(e));
    }
  }, [capturingCache, currentUrl, pageTitle, sourceId, bookmarked]);

  // ── Toggle offline mode ───────────────────────────────────────────────────
  const handleToggleOffline = useCallback(async () => {
    try {
      if (offlineMode) {
        setOfflineMode(false);
        return;
      }
      if (offlineHtml) {
        setOfflineMode(true);
        return;
      }
      const html = await loadCachedPage(currentUrl);
      if (html) {
        setOfflineHtml(html);
        setOfflineMode(true);
        toast('📖 Loading offline version');
      } else {
        toast('No cached version — tap ☁ to save first');
      }
    } catch (e) {
      Alert.alert('Offline error', String(e));
    }
  }, [offlineMode, offlineHtml, currentUrl]);

  // ── Toggle global offline mode ────────────────────────────────────────────
  const handleToggleGlobalOffline = useCallback(async () => {
    const next = !globalOfflineMode;
    setGlobalOfflineMode(next);
    if (next) {
      // Immediately try to serve current page from cache
      const html = await loadCachedPage(currentUrl);
      if (html) {
        setOfflineHtml(html);
        setOfflineMode(true);
        toast('📡 Offline mode ON — serving cached page');
      } else {
        toast('📡 Offline mode ON — no cache for current page');
      }
    } else {
      setOfflineMode(false);
      toast('🌐 Online mode');
    }
  }, [globalOfflineMode, currentUrl]);

  // When global offline mode is on, intercept URL changes and serve cache
  useEffect(() => {
    if (!globalOfflineMode || !currentUrl) return;
    let cancelled = false;
    loadCachedPage(currentUrl).then(html => {
      if (cancelled) return;
      if (html) {
        setOfflineHtml(html);
        setOfflineMode(true);
      } else {
        setOfflineMode(false);
        setOfflineHtml(null);
      }
    });
    return () => { cancelled = true; };
  }, [currentUrl, globalOfflineMode]);


  const handleToggleReadingMode = useCallback(() => {
    webviewRef.current?.injectJavaScript(buildReadingModeToggle());
    setReadingMode(prev => !prev);
  }, []);

  // ── Dark mode toggle ──────────────────────────────────────────────────────
  const handleToggleDarkMode = useCallback(() => {
    webviewRef.current?.injectJavaScript(DARK_MODE_CSS);
    setDarkMode(prev => {
      setSetting('darkModeOverride', !prev).catch(() => {});
      return !prev;
    });
  }, []);

  // ── Font size ─────────────────────────────────────────────────────────────
  const changeFontSize = useCallback((delta: number) => {
    setFontSize(prev => {
      const next = Math.max(12, Math.min(26, prev + delta));
      setSetting('readingFontSize', next).catch(() => {});
      webviewRef.current?.injectJavaScript(`
        (function() {
          document.body.style.fontSize = '${next}px';
          document.getElementById('__dv_reading_wrap') && 
            (document.getElementById('__dv_reading_wrap').style.fontSize = '${next}px');
        })();
      `);
      return next;
    });
  }, []);

  // ── Share ─────────────────────────────────────────────────────────────────
  const handleShare = useCallback(
    async (format: 'url' | 'markdown' | 'json') => {
      setShowMenu(null);
      const bm = { id: 0, url: currentUrl, title: pageTitle || currentUrl, sourceId, createdAt: Date.now() };
      try {
        if (format === 'url') {
          await Clipboard.setStringAsync(currentUrl);
          toast('🔗 URL copied');
        } else {
          await shareBookmark(bm, format);
        }
      } catch (e) {
        Alert.alert('Share error', String(e));
      }
    },
    [currentUrl, pageTitle, sourceId],
  );

  // ── URL submit ────────────────────────────────────────────────────────────
  const handleUrlSubmit = useCallback(() => {
    let target = urlInput.trim();
    if (target && !target.startsWith('http://') && !target.startsWith('https://')) {
      // If it looks like a search query, use DDG
      if (!target.includes('.') || target.includes(' ')) {
        target = `https://duckduckgo.com/?q=${encodeURIComponent(target)}`;
      } else {
        target = 'https://' + target;
      }
    }
    setCurrentUrl(target);
    setDisplayUrl(target);
    setEditingUrl(false);
    setOfflineMode(false);
    setOfflineHtml(null);
  }, [urlInput]);

  // ── Page load complete ────────────────────────────────────────────────────
  const handleLoadEnd = useCallback(() => {
    setLoading(false);
    setProgress(0);
    // Extract metadata
    webviewRef.current?.injectJavaScript(EXTRACT_META_JS);
    webviewRef.current?.injectJavaScript(SCROLL_PROGRESS_JS);
    // Apply reading mode if default
    if (readingMode) {
      webviewRef.current?.injectJavaScript(buildReadingModeToggle());
    }
    // Apply dark mode if enabled
    if (darkMode) {
      webviewRef.current?.injectJavaScript(DARK_MODE_CSS);
    }
  }, [readingMode, darkMode]);

  // ── Build injection ───────────────────────────────────────────────────────
  const injection = buildInjection(sourceId ?? '');

  const webviewSource = offlineMode && offlineHtml
    ? { html: offlineHtml, baseUrl: currentUrl }
    : { uri: currentUrl };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar style="auto" />

      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 4, backgroundColor: bg, borderBottomColor: borderColor }]}>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.back()} hitSlop={HIT}>
          <Ionicons name="arrow-back" size={22} color={textColor} />
        </TouchableOpacity>

        {editingUrl ? (
          <TextInput
            style={[styles.urlInput, { color: textColor, borderColor, backgroundColor: cardBg }]}
            value={urlInput}
            onChangeText={setUrlInput}
            onSubmitEditing={handleUrlSubmit}
            onBlur={() => setEditingUrl(false)}
            autoFocus
            returnKeyType="go"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            selectTextOnFocus
            placeholder="Search or enter URL"
            placeholderTextColor={borderColor}
          />
        ) : (
          <TouchableOpacity
            style={[styles.urlBar, { borderColor, backgroundColor: cardBg }]}
            onPress={() => { setUrlInput(currentUrl); setEditingUrl(true); }}
          >
            {offlineMode && <Ionicons name="cloud-offline-outline" size={13} color={tintColor} style={{ marginRight: 4 }} />}
            {cacheStatus === 'fresh' && !offlineMode && (
              <Ionicons name="cloud-done-outline" size={13} color="#22c55e" style={{ marginRight: 3 }} />
            )}
            {cacheStatus === 'stale' && !offlineMode && (
              <Ionicons name="cloud-outline" size={13} color="#f59e0b" style={{ marginRight: 3 }} />
            )}
            <Text style={[styles.urlText, { color: textColor }]} numberOfLines={1} ellipsizeMode="middle">
              {pageTitle || displayUrl}
            </Text>
            {loading && <ActivityIndicator size="small" color={tintColor} style={{ marginLeft: 6 }} />}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => loading ? webviewRef.current?.stopLoading() : webviewRef.current?.reload()}
          hitSlop={HIT}
        >
          <Ionicons name={loading ? 'close' : 'refresh'} size={22} color={textColor} />
        </TouchableOpacity>
      </View>

      {/* ── Progress bar ── */}
      {loading && (
        <Animated.View
          style={[
            styles.progressBar,
            {
              backgroundColor: tintColor,
              width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      )}

      {/* ── Global offline mode banner ── */}
      {globalOfflineMode && (
        <View style={[styles.offlineBanner, { backgroundColor: tintColor }]}>
          <Ionicons name="wifi-outline" size={13} color="#fff" />
          <Text style={styles.offlineBannerText}>Offline Mode</Text>
        </View>
      )}

      {/* ── Scroll progress strip ── */}
      {scrollProgress > 0 && !loading && (
        <View style={[styles.scrollStrip, { backgroundColor: borderColor }]}>
          <View style={[styles.scrollFill, { width: `${scrollProgress}%` as any, backgroundColor: tintColor }]} />
        </View>
      )}

      {/* ── WebView ── */}
      <WebView
        ref={webviewRef}
        source={webviewSource}
        style={styles.webview}
        onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress)}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={handleLoadEnd}
        onNavigationStateChange={handleNavState}
        onMessage={handleMessage}
        injectedJavaScript={injection}
        injectedJavaScriptBeforeContentLoaded={injection}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        thirdPartyCookiesEnabled={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsBackForwardNavigationGestures
        userAgent={MOBILE_USER_AGENT}
        onShouldStartLoadWithRequest={() => true}
        startInLoadingState
        renderLoading={() => (
          <View style={[styles.loadingOverlay, { backgroundColor: bg }]}>
            <ActivityIndicator size="large" color={tintColor} />
          </View>
        )}
      />

      {/* ── Share / Settings overlay ── */}
      {showMenu !== null && (
        <Pressable style={styles.overlay} onPress={() => setShowMenu(null)}>
          <View style={[styles.floatMenu, { backgroundColor: bg, borderColor }]}>
            {showMenu === 'share' && (
              <>
                <Text style={[styles.menuTitle, { color: textColor }]}>Share / Copy</Text>
                <MenuItem icon="link-outline" label="Copy URL" color={tintColor} textColor={textColor} onPress={() => handleShare('url')} />
                <MenuItem icon="document-text-outline" label="Share as Markdown" color={tintColor} textColor={textColor} onPress={() => handleShare('markdown')} />
                <MenuItem icon="code-outline" label="Share as JSON" color={tintColor} textColor={textColor} onPress={() => handleShare('json')} />
              </>
            )}
            {showMenu === 'settings' && (
              <>
                <Text style={[styles.menuTitle, { color: textColor }]}>Display</Text>
                <View style={styles.fontRow}>
                  <TouchableOpacity style={[styles.fontBtn, { borderColor }]} onPress={() => changeFontSize(-1)}>
                    <Text style={[styles.fontBtnText, { color: textColor }]}>A−</Text>
                  </TouchableOpacity>
                  <Text style={[styles.fontLabel, { color: textColor }]}>{fontSize}px</Text>
                  <TouchableOpacity style={[styles.fontBtn, { borderColor }]} onPress={() => changeFontSize(1)}>
                    <Text style={[styles.fontBtnText, { color: textColor }]}>A+</Text>
                  </TouchableOpacity>
                </View>
                <MenuItem
                  icon={readingMode ? 'book' : 'book-outline'}
                  label={readingMode ? 'Exit Reading Mode' : 'Reading Mode'}
                  color={readingMode ? tintColor : textColor}
                  textColor={textColor}
                  onPress={() => { handleToggleReadingMode(); setShowMenu(null); }}
                />
                <MenuItem
                  icon={darkMode ? 'moon' : 'moon-outline'}
                  label={darkMode ? 'Dark Mode (on)' : 'Dark Mode (off)'}
                  color={darkMode ? '#818cf8' : textColor}
                  textColor={textColor}
                  onPress={() => { handleToggleDarkMode(); setShowMenu(null); }}
                />
                <MenuItem
                  icon="desktop-outline"
                  label="Desktop Site"
                  color={textColor}
                  textColor={textColor}
                  onPress={() => {
                    webviewRef.current?.injectJavaScript(`
                      (function(){
                        let meta=document.querySelector('meta[name="viewport"]');
                        if(meta) meta.content='width=1280';
                      })();
                    `);
                    setShowMenu(null);
                  }}
                />
                <MenuItem
                  icon="refresh-outline"
                  label="Reset Layout"
                  color={textColor}
                  textColor={textColor}
                  onPress={() => { webviewRef.current?.reload(); setShowMenu(null); }}
                />
              </>
            )}
          </View>
        </Pressable>
      )}

      {/* ── Bottom toolbar ── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 4, backgroundColor: bg, borderTopColor: borderColor }]}>
        {/* Back */}
        <ToolBtn
          icon="chevron-back"
          size={24}
          color={canGoBack ? textColor : borderColor}
          disabled={!canGoBack}
          onPress={() => webviewRef.current?.goBack()}
        />

        {/* Forward */}
        <ToolBtn
          icon="chevron-forward"
          size={24}
          color={canGoForward ? textColor : borderColor}
          disabled={!canGoForward}
          onPress={() => webviewRef.current?.goForward()}
        />

        {/* ⭐ Bookmark — center, always visible */}
        <ToolBtn
          icon={bookmarked ? 'star' : 'star-outline'}
          size={28}
          color={bookmarked ? '#f59e0b' : textColor}
          style={styles.toolBtnMain}
          onPress={handleToggleBookmark}
        />

        {/* ☁ Cache / offline */}
        <TouchableOpacity
          style={styles.toolBtn}
          onPress={capturingCache ? undefined : handleCachePage}
          onLongPress={handleToggleOffline}
          hitSlop={HIT}
        >
          {capturingCache ? (
            <ActivityIndicator size="small" color={tintColor} />
          ) : (
            <Ionicons
              name={
                offlineMode ? 'cloud-offline' :
                cacheStatus === 'fresh' ? 'cloud-done' :
                cacheStatus === 'stale' ? 'cloud-outline' :
                'cloud-download-outline'
              }
              size={24}
              color={
                offlineMode ? tintColor :
                cacheStatus === 'fresh' ? '#22c55e' :
                cacheStatus === 'stale' ? '#f59e0b' :
                textColor
              }
            />
          )}
        </TouchableOpacity>

        {/* 📡 Global offline mode toggle */}
        <ToolBtn
          icon={globalOfflineMode ? 'wifi' : 'wifi-outline'}
          size={22}
          color={globalOfflineMode ? tintColor : textColor}
          onPress={handleToggleGlobalOffline}
        />

        {/* ⋯ Menu */}
        <ToolBtn
          icon="ellipsis-horizontal"
          size={22}
          color={textColor}
          onPress={() => setShowMenu(prev => prev === 'share' ? null : 'share')}
          onLongPress={() => setShowMenu(prev => prev === 'settings' ? null : 'settings')}
        />
      </View>
    </View>
  );
}

// ─── Small reusable components ───────────────────────────────────────────────

const HIT = { top: 10, bottom: 10, left: 10, right: 10 };

interface ToolBtnProps {
  icon: string;
  size: number;
  color: string;
  disabled?: boolean;
  style?: object;
  onPress?: () => void;
  onLongPress?: () => void;
}
function ToolBtn({ icon, size, color, disabled, style, onPress, onLongPress }: ToolBtnProps) {
  return (
    <TouchableOpacity
      style={[styles.toolBtn, disabled && styles.toolBtnDisabled, style]}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={HIT}
    >
      <Ionicons name={icon as any} size={size} color={color} />
    </TouchableOpacity>
  );
}

interface MenuItemProps {
  icon: string;
  label: string;
  color: string;
  textColor: string;
  onPress: () => void;
}
function MenuItem({ icon, label, color, textColor, onPress }: MenuItemProps) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={[styles.menuItemText, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  navBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urlBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginHorizontal: 4,
    minHeight: 34,
  },
  urlInput: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginHorizontal: 4,
    fontSize: 14,
    minHeight: 34,
  },
  urlText: {
    flex: 1,
    fontSize: 12,
  },

  progressBar: {
    height: 2,
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 20,
  },
  scrollStrip: {
    height: 2,
    width: '100%',
  },
  scrollFill: {
    height: 2,
  },

  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 3,
  },
  offlineBannerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },

  webview: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 6,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  toolBtn: {
    width: 46,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  toolBtnMain: {
    width: 54,
  },
  toolBtnDisabled: { opacity: 0.3 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 100,
    justifyContent: 'flex-end',
  },
  floatMenu: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 4,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 11,
    paddingHorizontal: 4,
  },
  menuItemText: {
    fontSize: 15,
  },

  fontRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 12,
  },
  fontBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  fontBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  fontLabel: {
    fontSize: 15,
    minWidth: 50,
    textAlign: 'center',
  },
});
