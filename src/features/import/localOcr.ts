import { appInvoke } from "../../services/appInvoke";

export type LocalOcrProviderId = "windows";

export const defaultLocalOcrProvider: LocalOcrProviderId = "windows";

export type LocalOcrResult = {
  text: string;
  language: string;
  lines: { text: string; words: { y: number; height: number }[] }[];
};

export async function recognizeWithLocalOcr(input: { path: string; language: string; provider?: LocalOcrProviderId }) {
  const provider = input.provider ?? defaultLocalOcrProvider;
  if (provider !== "windows") throw new Error(`Unsupported local OCR provider: ${provider}`);
  return appInvoke<LocalOcrResult>("recognize_local_ocr", {
    input: { path: input.path, language: input.language },
  });
}
