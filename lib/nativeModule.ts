import { NativeModules, Platform } from 'react-native';

interface PermissionStatus {
  READ_EXTERNAL_STORAGE?: boolean;
  WRITE_EXTERNAL_STORAGE?: boolean;
  READ_MEDIA_IMAGES?: boolean;
  READ_MEDIA_VIDEO?: boolean;
  READ_MEDIA_AUDIO?: boolean;
  sdkInt: number;
  release: string;
}

interface StorageInfo {
  filesDir: string;
  cacheDir: string;
  externalFilesDir: string;
  filesExists: boolean;
  cacheExists: boolean;
  filesDirFree: number;
  cacheDirFree: number;
}

interface DocVaultNativeInterface {
  checkPermissions(): Promise<PermissionStatus>;
  saveToDownloads(content: string, filename: string, mimeType: string): Promise<string>;
  getStorageInfo(): Promise<StorageInfo>;
  appendDebugLog(entry: string): Promise<boolean>;
  readDebugLog(): Promise<string>;
  clearDebugLog(): Promise<boolean>;
}

const { DocVaultNative } = NativeModules;

/** JS wrapper for the DocVaultModule native bridge. Falls back gracefully on non-Android. */
export const NativeDocVault: DocVaultNativeInterface = {
  checkPermissions: () => {
    if (Platform.OS === 'android' && DocVaultNative) {
      return DocVaultNative.checkPermissions();
    }
    return Promise.resolve({ sdkInt: 0, release: 'web' });
  },

  saveToDownloads: (content, filename, mimeType) => {
    if (Platform.OS === 'android' && DocVaultNative) {
      return DocVaultNative.saveToDownloads(content, filename, mimeType);
    }
    return Promise.reject(new Error('saveToDownloads only available on Android'));
  },

  getStorageInfo: () => {
    if (Platform.OS === 'android' && DocVaultNative) {
      return DocVaultNative.getStorageInfo();
    }
    return Promise.resolve({
      filesDir: '(web)',
      cacheDir: '(web)',
      externalFilesDir: '(web)',
      filesExists: true,
      cacheExists: true,
      filesDirFree: 0,
      cacheDirFree: 0,
    });
  },

  appendDebugLog: (entry) => {
    if (Platform.OS === 'android' && DocVaultNative) {
      return DocVaultNative.appendDebugLog(entry);
    }
    return Promise.resolve(false);
  },

  readDebugLog: () => {
    if (Platform.OS === 'android' && DocVaultNative) {
      return DocVaultNative.readDebugLog();
    }
    return Promise.resolve('');
  },

  clearDebugLog: () => {
    if (Platform.OS === 'android' && DocVaultNative) {
      return DocVaultNative.clearDebugLog();
    }
    return Promise.resolve(false);
  },
};
