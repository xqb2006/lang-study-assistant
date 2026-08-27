import type { CustomDictionaryStatus, ResourceImportAnalysis, ResourceType } from "./types";
import type { AppInvoke } from "../../services/appInvoke";

export const localDictionaryApi = {
  getCustomStatus(invoke: AppInvoke) {
    return invoke<CustomDictionaryStatus[]>("get_custom_dictionary_status");
  },
  analyzeCustom(invoke: AppInvoke, path: string) {
    return invoke<ResourceImportAnalysis>("analyze_custom_dictionary_file", { path });
  },
  importCustom(invoke: AppInvoke, path: string, name: string, language: string, definitionLanguage: string, resourceType: ResourceType) {
    return invoke<CustomDictionaryStatus>("import_custom_dictionary", {
      path,
      name,
      language,
      definitionLanguage,
      resourceType,
    });
  },
  renameCustom(invoke: AppInvoke, id: string, name: string) {
    return invoke<CustomDictionaryStatus>("rename_custom_dictionary", { id, name });
  },
  setCustomEnabled(invoke: AppInvoke, id: string, enabled: boolean) {
    return invoke<void>("set_custom_dictionary_enabled", { id, enabled });
  },
  deleteCustom(invoke: AppInvoke, id: string) {
    return invoke<void>("delete_custom_dictionary", { id });
  },
};