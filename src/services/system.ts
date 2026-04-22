import { invoke } from '@tauri-apps/api/core';

export interface LocalPathInfo {
  exists: boolean;
  isDir: boolean;
}

export async function inspectLocalPath(path: string): Promise<LocalPathInfo> {
  try {
    return await invoke<LocalPathInfo>('inspect_local_path', { path });
  } catch {
    return {
      exists: false,
      isDir: false,
    };
  }
}
