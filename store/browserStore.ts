import { create } from 'zustand';
import { Bookmark, HistoryEntry } from '../lib/database';

interface BrowserState {
  // Navigation
  currentUrl: string;
  currentTitle: string;
  currentSourceId: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
  loadProgress: number;

  // UI state
  showNavBar: boolean;
  darkModeInjection: boolean;
  adBlockEnabled: boolean;

  // Collections (loaded from DB)
  bookmarks: Bookmark[];
  history: HistoryEntry[];
  isBookmarked: boolean;

  // Actions
  setUrl: (url: string, sourceId?: string) => void;
  setTitle: (title: string) => void;
  setNavigation: (canGoBack: boolean, canGoForward: boolean) => void;
  setLoading: (loading: boolean, progress?: number) => void;
  setShowNavBar: (show: boolean) => void;
  toggleDarkMode: () => void;
  toggleAdBlock: () => void;
  setBookmarks: (bookmarks: Bookmark[]) => void;
  setHistory: (history: HistoryEntry[]) => void;
  setIsBookmarked: (val: boolean) => void;
}

export const useBrowserStore = create<BrowserState>((set) => ({
  currentUrl: '',
  currentTitle: '',
  currentSourceId: '',
  canGoBack: false,
  canGoForward: false,
  isLoading: false,
  loadProgress: 0,

  showNavBar: true,
  darkModeInjection: false,
  adBlockEnabled: true,

  bookmarks: [],
  history: [],
  isBookmarked: false,

  setUrl: (url, sourceId = '') =>
    set({ currentUrl: url, currentSourceId: sourceId, isBookmarked: false }),
  setTitle: (title) => set({ currentTitle: title }),
  setNavigation: (canGoBack, canGoForward) => set({ canGoBack, canGoForward }),
  setLoading: (isLoading, loadProgress = 0) => set({ isLoading, loadProgress }),
  setShowNavBar: (showNavBar) => set({ showNavBar }),
  toggleDarkMode: () => set((s) => ({ darkModeInjection: !s.darkModeInjection })),
  toggleAdBlock: () => set((s) => ({ adBlockEnabled: !s.adBlockEnabled })),
  setBookmarks: (bookmarks) => set({ bookmarks }),
  setHistory: (history) => set({ history }),
  setIsBookmarked: (isBookmarked) => set({ isBookmarked }),
}));
