import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { localDictionaryApi } from "./api";
import type { AppInvoke } from "../../services/appInvoke";
import { resourceT, type DisplayLanguage } from "../../i18n/ui";
import type { CustomDictionaryStatus, DictionaryInstallProgress } from "./types";

export function useLocalDictionaryStatus(invoke: AppInvoke, isTauri: boolean, displayLanguage: DisplayLanguage) {
  const [customDictionaries, setCustomDictionaries] = useState<CustomDictionaryStatus[]>([]);
  const [progress, setProgress] = useState<DictionaryInstallProgress | null>(null);
  const [message, setMessage] = useState("");

  const refreshStatus = useCallback(async () => {
    try {
      setCustomDictionaries(await localDictionaryApi.getCustomStatus(invoke));
    } catch (error) {
      setMessage(resourceT(displayLanguage, "statusReadFailed", { error: String(error) }));
    }
  }, [displayLanguage, invoke]);

  useEffect(() => {
    void refreshStatus();
    if (!isTauri) return;
    let removeListener: (() => void) | undefined;
    void listen<DictionaryInstallProgress>("dictionary-install-progress", (event) => setProgress(event.payload)).then((unlisten) => {
      removeListener = unlisten;
    });
    return () => removeListener?.();
  }, [isTauri, refreshStatus]);

  return { customDictionaries, progress, message, setMessage, setProgress, refreshStatus };
}