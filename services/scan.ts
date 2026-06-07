// Document-scan capture. The ONLY module that touches expo-image-picker and the
// vault file directory. Scans are written to an app-private folder (NOT the shared
// Photos library) and are reachable only behind the vault/app lock (SPEC §7, §8).
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

/** App-private, sandboxed directory. Not indexed by Photos; wiped on uninstall. */
const VAULT_DIR = `${FileSystem.documentDirectory}vault/`;

export type ScanSource = 'camera' | 'library';

/** Absolute on-device path where an item's scan lives. */
export function scanPathFor(itemId: string): string {
  return `${VAULT_DIR}${itemId}.jpg`;
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(VAULT_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(VAULT_DIR, { intermediates: true });
  }
}

/** Ask for the OS permission needed for the chosen source. Returns granted. */
async function ensurePermission(source: ScanSource): Promise<boolean> {
  const res =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  return res.granted;
}

/**
 * Launch the camera or library, then copy the chosen image into the app-private
 * vault folder as <itemId>.jpg. Returns the saved path, or null if cancelled /
 * permission denied. The original picked URI is never persisted anywhere else.
 */
export async function captureScan(
  itemId: string,
  source: ScanSource,
): Promise<string | null> {
  if (!(await ensurePermission(source))) return null;

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.7,
    allowsEditing: false,
    exif: false,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || result.assets.length === 0) return null;

  await ensureDir();
  const dest = scanPathFor(itemId);
  await FileSystem.deleteAsync(dest, { idempotent: true });
  await FileSystem.copyAsync({ from: result.assets[0].uri, to: dest });
  return dest;
}

/** Remove an item's stored scan, if any. Safe to call when none exists. */
export async function deleteScan(itemId: string): Promise<void> {
  await FileSystem.deleteAsync(scanPathFor(itemId), { idempotent: true });
}
