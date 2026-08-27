import { invoke as tauriInvoke } from "@tauri-apps/api/core";

export type AppInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

export const isTauri = "__TAURI_INTERNALS__" in window;

export const appInvoke: AppInvoke = (command, args = {}) => {
  if (!isTauri) {
    return Promise.reject(new Error("当前版本仅支持桌面客户端，请使用英语阅读助手.exe"));
  }
  return tauriInvoke(command, args);
};
