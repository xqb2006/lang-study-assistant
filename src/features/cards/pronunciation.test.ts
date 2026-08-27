import { beforeEach, describe, expect, test, vi } from "vitest";
import { getPronunciationSnapshot, speakWord, stopSpeaking } from "./pronunciation";

describe("pronunciation", () => {
  const speak = vi.fn();
  const cancel = vi.fn();
  const voices = [{ lang: "en-US", name: "English test voice" }];
  let lastUtterance: { lang: string; rate: number; volume: number; voice?: unknown } | undefined;

  beforeEach(() => {
    speak.mockReset();
    cancel.mockReset();
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { speak: (utterance: typeof lastUtterance) => { lastUtterance = utterance; speak(utterance); }, cancel, getVoices: () => voices } });
    class TestUtterance {
      text: string;
      lang = "";
      rate = 0;
      onend?: () => void;
      onerror?: () => void;
      constructor(text: string) { this.text = text; }
    }
    vi.stubGlobal("SpeechSynthesisUtterance", TestUtterance);
    stopSpeaking();
  });

  test("starts one word and exposes speaking state", () => {
    expect(speakWord("  announced  ")).toBe(true);
    expect(cancel).toHaveBeenCalled();
    expect(speak).toHaveBeenCalledOnce();
    expect(getPronunciationSnapshot()).toEqual({ status: "speaking", word: "announced" });
    expect(lastUtterance?.volume).toBe(1);
    expect(lastUtterance?.voice).toEqual(voices[0]);
  });

  test("stops the active word", () => {
    speakWord("announced");
    stopSpeaking();
    expect(cancel).toHaveBeenCalled();
    expect(getPronunciationSnapshot()).toEqual({ status: "idle", word: null });
  });
});




