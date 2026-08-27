import type { AppInvoke } from "../../services/appInvoke";
import type { AiConnectionTestResult, AiProviderProfile, AiProviderStatus } from "./types";

export const aiProviderApi = {
  getStatus(invoke: AppInvoke) {
    return invoke<AiProviderStatus>("get_ai_provider_status");
  },
  saveProfile(invoke: AppInvoke, profile: AiProviderProfile, activate: boolean) {
    return invoke<AiProviderStatus>("save_ai_provider_profile", { input: { profile, activate } });
  },
  activateProfile(invoke: AppInvoke, id: string) {
    return invoke<AiProviderStatus>("activate_ai_provider_profile", { input: { profileId: id } });
  },
  deleteProfile(invoke: AppInvoke, id: string) {
    return invoke<AiProviderStatus>("delete_ai_provider_profile", { input: { profileId: id } });
  },
  discoverModels(invoke: AppInvoke, profile: AiProviderProfile) {
    return invoke<string[]>("discover_ai_models", { input: profile });
  },
  testProvider(invoke: AppInvoke, profile: AiProviderProfile) {
    return invoke<AiConnectionTestResult>("test_ai_provider", { input: profile });
  },
};
