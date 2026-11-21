// The browser globals the plugin reads, kept here so the rest of client/ runs on iOS and Android unchanged. Each
// export checks for web first and has an answer for native clients, which have no `navigator.userAgent` to read.
import { Platform } from 'react-native';

/** True on a Mac running Paseo's desktop app, which runs as web; false on every other client. */
export function isMacWeb(): boolean {
  if (Platform.OS !== 'web') return false;
  return typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent ?? '');
}
