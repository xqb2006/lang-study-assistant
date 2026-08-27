import { Square, Volume2 } from "lucide-react";
import { useSyncExternalStore } from "react";
import { getPronunciationSnapshot, speakWord, stopSpeaking, subscribePronunciation } from "./pronunciation";

export function PronunciationButton({ word, className = "secondary-button" }: { word: string; className?: string }) {
  const snapshot = useSyncExternalStore(subscribePronunciation, getPronunciationSnapshot, getPronunciationSnapshot);
  const isSpeaking = snapshot.status === "speaking" && snapshot.word === word.trim();
  const label = isSpeaking ? "停止朗读" : "朗读";

  return (
    <button
      className={`${className} pronunciation-button${isSpeaking ? " speaking" : ""}`}
      type="button"
      aria-label={`${label} ${word}`}
      aria-pressed={isSpeaking}
      onClick={() => (isSpeaking ? stopSpeaking() : speakWord(word))}
    >
      {isSpeaking ? <Square size={15} /> : <Volume2 size={15} />}
      {label}
    </button>
  );
}




