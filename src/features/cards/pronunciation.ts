export type PronunciationStatus = "idle" | "speaking";

type PronunciationSnapshot = {
  status: PronunciationStatus;
  word: string | null;
};

const listeners = new Set<() => void>();
let snapshot: PronunciationSnapshot = { status: "idle", word: null };
let activeUtterance: SpeechSynthesisUtterance | null = null;

function notify() {
  listeners.forEach((listener) => listener());
}

function selectVoice(language: string) {
  const voices = window.speechSynthesis.getVoices?.() ?? [];
  const normalizedLanguage = language.toLowerCase();
  return voices.find((voice) => voice.lang.toLowerCase() === normalizedLanguage)
    ?? voices.find((voice) => voice.lang.toLowerCase().startsWith(normalizedLanguage.split("-")[0]))
    ?? voices.find((voice) => voice.lang.toLowerCase().startsWith("en-"));
}

function setSnapshot(next: PronunciationSnapshot) {
  snapshot = next;
  notify();
}

export function getPronunciationSnapshot() {
  return snapshot;
}

export function subscribePronunciation(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  activeUtterance = null;
  setSnapshot({ status: "idle", word: null });
}

export function speakWord(word: string, language = "en-US") {
  const normalizedWord = word.trim();
  if (!normalizedWord || typeof window === "undefined" || !window.speechSynthesis) return false;
  stopSpeaking();
  const utterance = new SpeechSynthesisUtterance(normalizedWord);
  utterance.lang = language;
  utterance.rate = 0.85;
  utterance.volume = 1;
  const voice = selectVoice(language);
  if (voice) utterance.voice = voice;
  activeUtterance = utterance;
  utterance.onend = () => {
    if (activeUtterance === utterance) {
      activeUtterance = null;
      setSnapshot({ status: "idle", word: null });
    }
  };
  utterance.onerror = () => {
    if (activeUtterance === utterance) {
      activeUtterance = null;
      setSnapshot({ status: "idle", word: null });
    }
  };
  setSnapshot({ status: "speaking", word: normalizedWord });
  window.speechSynthesis.speak(utterance);
  return true;
}


