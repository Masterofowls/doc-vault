import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Pressable,
  SafeAreaView,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { Text } from '../../components/ui/text';
import {
  addBookmark,
  addHistory,
  isBookmarked,
  removeBookmark,
} from '../../lib/database';
import { buildInjectionScript, MOBILE_USER_AGENT } from '../../lib/injection';
import { getSourceById } from '../../lib/sources';
import { useBrowserStore } from '../../store/browserStore';

export default function BrowserScreen() {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const params = useLocalSearchParams<{ sourceId: string; url: string }>();
  const sourceId = params.sourceId ?? '';
  const source = getSourceById(sourceId);
  const initialUrl = params.url ?? source?.url ?? 'https://devdocs.io/';

  const webViewRef = useRef<WebView>(null);
  const {
    adBlockEnabled,
    darkModeInjection,
  } = useBrowserStore();

  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [currentTitle, setCurrentTitle] = useState(source?.name ?? '');
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);
  const [showUrlBar, setShowUrlBar] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  // Check bookmark status when URL changes
  useEffect(() => {
    isBookmarked(currentUrl).then(setBookmarked);
  }, [currentUrl]);

  // Hardware back button
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) {
        webViewRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  const handleNavigation = useCallback(
    (nav: WebViewNavigation) => {
      setCurrentUrl(nav.url);
      setCurrentTitle(nav.title || nav.url);
      setCanGoBack(nav.canGoBack);
      setCanGoForward(nav.canGoForward);
    },
    [],
  );

  const handleLoadEnd = useCallback(async () => {
    setIsLoading(false);
    setProgress(0);
    if (currentUrl && currentUrl !== 'about:blank') {
      await addHistory(currentUrl, currentTitle || currentUrl, sourceId);
    }
  }, [currentUrl, currentTitle, sourceId]);

  const toggleBookmark = async () => {
    if (bookmarked) {
      await removeBookmark(currentUrl);
      setBookmarked(false);
    } else {
      await addBookmark(currentUrl, currentTitle || currentUrl, sourceId);
      setBookmarked(true);
    }
  };

  const navigateTo = (url: string) => {
    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }
    setCurrentUrl(finalUrl);
    setShowUrlBar(false);
    webViewRef.current?.injectJavaScript(`window.location.href = '${finalUrl}';`);
  };

  const bg = isDark ? '#0a0a0a' : '#f1f5f9';
  const navBg = isDark ? '#111111' : '#ffffff';
  const borderColor = isDark ? '#2d2d2d' : '#e2e8f0';
  const iconColor = isDark ? '#e2e8f0' : '#374151';

  const injectedScript = adBlockEnabled
    ? buildInjectionScript(sourceId, darkModeInjection)
    : darkModeInjection
      ? buildInjectionScript(sourceId, true)
      : undefined;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      {/* Top nav bar */}
      <View style={[styles.navBar, { backgroundColor: navBg, borderBottomColor: borderColor }]}>
        <Pressable onPress={() => router.back()} style={styles.navBtn} hitSlop={8}>
          <Text style={[styles.navIcon, { color: iconColor }]}>←</Text>
        </Pressable>

        <Pressable onPress={() => webViewRef.current?.goBack()} style={styles.navBtn} hitSlop={8} disabled={!canGoBack}>
          <Text style={[styles.navIcon, { color: canGoBack ? iconColor : '#6b7280', fontSize: 18 }]}>‹</Text>
        </Pressable>

        <Pressable onPress={() => webViewRef.current?.goForward()} style={styles.navBtn} hitSlop={8} disabled={!canGoForward}>
          <Text style={[styles.navIcon, { color: canGoForward ? iconColor : '#6b7280', fontSize: 18 }]}>›</Text>
        </Pressable>

        {/* URL bar */}
        <Pressable
          onPress={() => {
            setUrlInput(currentUrl);
            setShowUrlBar(true);
          }}
          style={[styles.urlBar, { backgroundColor: isDark ? '#1a1a1a' : '#f1f5f9', borderColor }]}
        >
          {isLoading && (
            <View style={[styles.progressBar, { width: `${Math.round(progress * 100)}%` as unknown as number }]} />
          )}
          <Text style={[styles.urlText, { color: isDark ? '#94a3b8' : '#64748b' }]} numberOfLines={1}>
            {currentUrl.replace(/^https?:\/\//, '')}
          </Text>
        </Pressable>

        <Pressable onPress={toggleBookmark} style={styles.navBtn} hitSlop={8}>
          <Text style={[styles.navIcon, { color: bookmarked ? '#f59e0b' : iconColor }]}>
            {bookmarked ? '★' : '☆'}
          </Text>
        </Pressable>

        <Pressable onPress={() => webViewRef.current?.reload()} style={styles.navBtn} hitSlop={8}>
          <Text style={[styles.navIcon, { color: iconColor }]}>↻</Text>
        </Pressable>
      </View>

      {/* URL input overlay */}
      {showUrlBar && (
        <View style={[styles.urlOverlay, { backgroundColor: navBg, borderBottomColor: borderColor }]}>
          <TextInput
            value={urlInput}
            onChangeText={setUrlInput}
            autoFocus
            selectTextOnFocus
            onSubmitEditing={() => navigateTo(urlInput)}
            returnKeyType="go"
            style={[styles.urlInput, { color: isDark ? '#f1f5f9' : '#0f172a', borderColor }]}
            placeholder="Enter URL or search..."
            placeholderTextColor={isDark ? '#4b5563' : '#9ca3af'}
          />
          <Pressable onPress={() => setShowUrlBar(false)} style={styles.navBtn}>
            <Text style={{ color: iconColor, fontWeight: '600' }}>✕</Text>
          </Pressable>
        </View>
      )}

      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{ uri: initialUrl }}
        style={{ flex: 1 }}
        userAgent={MOBILE_USER_AGENT}
        javaScriptEnabled
        domStorageEnabled
        allowsBackForwardNavigationGestures
        startInLoadingState
        injectedJavaScript={injectedScript}
        injectedJavaScriptBeforeContentLoaded={MOBILE_USER_AGENT ? undefined : undefined}
        onNavigationStateChange={handleNavigation}
        onLoadProgress={({ nativeEvent }) => {
          setIsLoading(true);
          setProgress(nativeEvent.progress);
        }}
        onLoadEnd={handleLoadEnd}
        onError={(e) => console.warn('WebView error:', e.nativeEvent)}
        setSupportMultipleWindows={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 4,
  },
  navBtn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
  },
  navIcon: { fontSize: 20, fontWeight: '600' },
  urlBar: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  progressBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#2563eb33',
    borderRadius: 8,
  },
  urlText: { fontSize: 12 },
  urlOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    gap: 8,
  },
  urlInput: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 14,
  },
});
