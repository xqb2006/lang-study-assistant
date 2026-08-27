import { appLocalDataDir } from "@tauri-apps/api/path";
import { mkdir, remove, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";

export function appResourceCachePath(directory: string) {
  return `${directory.replace(/[\\/]$/, "")}\\resource-import-cache`;
}

export function appResourceCacheSessionPath(cacheDirectory: string, sessionName: string) {
  return `${cacheDirectory}\\${sessionName}`;
}

export async function writeAppResourceCacheFile(fileName: string, content: string) {
  const directory = await appLocalDataDir();
  const cacheDirectory = appResourceCachePath(directory);
  await mkdir(cacheDirectory, { recursive: true });
  const output = `${cacheDirectory}\\${fileName}`;
  await writeTextFile(output, content);
  return output;
}

export async function createAppResourceCacheSession(prefix: string) {
  const directory = await appLocalDataDir();
  const cacheDirectory = appResourceCachePath(directory);
  const sessionDirectory = appResourceCacheSessionPath(cacheDirectory, `${prefix}-${Date.now()}-${crypto.randomUUID()}`);
  await mkdir(sessionDirectory, { recursive: true });
  return sessionDirectory;
}

export async function writeAppResourceCacheBinaryFile(directory: string, fileName: string, content: Uint8Array) {
  const output = `${directory}\\${fileName}`;
  await writeFile(output, content);
  return output;
}

export async function removeAppResourceCacheSession(directory: string) {
  await remove(directory, { recursive: true });
}
