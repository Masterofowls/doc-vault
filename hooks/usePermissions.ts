import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { NativeDocVault } from '../lib/nativeModule';
import { debugLog } from '../lib/debugLog';

export interface PermissionState {
  checked: boolean;
  allGranted: boolean;
  sdkInt: number;
  statuses: Record<string, boolean>;
}

/**
 * Checks storage permission status on mount.
 * On Android the OS dialog fires from MainActivity.kt; this hook just reports current state.
 */
export function usePermissions(): PermissionState {
  const [state, setState] = useState<PermissionState>({
    checked: false,
    allGranted: false,
    sdkInt: 0,
    statuses: {},
  });

  useEffect(() => {
    if (Platform.OS !== 'android') {
      setState({ checked: true, allGranted: true, sdkInt: 0, statuses: {} });
      return;
    }
    NativeDocVault.checkPermissions()
      .then((perms) => {
        const { sdkInt, release, ...statuses } = perms as Record<string, boolean | number | string>;
        const allGranted = Object.values(statuses).every((v) => v === true);
        debugLog.info('Permissions', `SDK ${sdkInt} (${release}) | allGranted=${allGranted}`);
        setState({
          checked: true,
          allGranted,
          sdkInt: sdkInt as number,
          statuses: statuses as Record<string, boolean>,
        });
        if (!allGranted) {
          debugLog.warn('Permissions', `Denied: ${JSON.stringify(statuses)}`);
          Alert.alert(
            'Storage Permissions',
            'Some storage permissions were denied. File caching and export may not work correctly. Please grant permissions in app settings.',
            [{ text: 'OK' }],
          );
        }
      })
      .catch((e) => {
        debugLog.error('Permissions', `checkPermissions failed: ${String(e)}`);
        setState({ checked: true, allGranted: false, sdkInt: 0, statuses: {} });
      });
  }, []);

  return state;
}
