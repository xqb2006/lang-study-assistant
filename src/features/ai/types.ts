export type AiProviderProfile = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  chatModel: string;
  translationModel: string;
  models: string[];
};

export type AiConnectionTestResult = {
  message: string;
  latencyMs: number;
  model: string;
};

export type AiProviderStatus = {
  configured: boolean;
  activeProfileId: string;
  profiles: AiProviderProfile[];
  chatModel: string;
  translationModel: string;
  models: string[];
};
