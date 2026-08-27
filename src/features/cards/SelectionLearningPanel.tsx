import { BookOpen, Highlighter, X } from "lucide-react";
import type { Selection } from "./types";
import type { DictionaryResult } from "./useCardActions";
import { readerT, type DisplayLanguage } from "../../i18n/ui";
import { PronunciationButton } from "./PronunciationButton";

type SelectionLearningPanelProps = {
  aiConfigured: boolean;
  displayLanguage?: DisplayLanguage;
  isLookingUp: boolean;
  lookup: DictionaryResult | null;
  selected: Selection | null;
  onCancel: () => void;
  onClear: () => void;
  onDictionary: () => void;
  onMark: () => void;
  onSave: () => void;
  onSemanticAnalysis: () => void;
  onRegenerateAnalysis: () => void;
};

export function SelectionLearningPanel({
  aiConfigured,
  displayLanguage = "zh-CN",
  isLookingUp,
  lookup,
  selected,
  onCancel,
  onClear,
  onDictionary,
  onMark,
  onSave,
  onSemanticAnalysis,
  onRegenerateAnalysis,
}: SelectionLearningPanelProps) {
  if (!selected) {
    return (
      <section className="selection-learning-panel selection-learning-panel-empty">
        <div className="selection-learning-panel-head">
          <div>
            <p>{readerT(displayLanguage, "currentSelection")}</p>
            <h2>{readerT(displayLanguage, "dictionaryContext")}</h2>
          </div>
        </div>
        <p className="selection-learning-empty-copy">
          鍦ㄦ鏂囨垨缁冧範棰樹腑閫変腑鍗曡瘝銆佺煭璇悗锛屽彲鐩存帴鏌ヨ璇嶅吀鎴栬繘琛岃澧冪簿鏋愩€?        </p>
      </section>
    );
  }

  const isQuestionSelection = selected.origin === "question";

  return (
    <section className="selection-learning-panel" aria-live="polite">
      <div className="selection-learning-panel-head">
        <div>
          <p>{isQuestionSelection ? readerT(displayLanguage, "questionSelection") : readerT(displayLanguage, "currentSelection")}</p>
          <h2>{selected.word}</h2>
          <small>{selected.contextSentence}</small>
        </div>
        <button className="icon-button" type="button" aria-label={readerT(displayLanguage, "clearSelection")} onClick={onClear}>
          <X size={15} />
        </button>
      </div>
      <div className="selection-learning-actions">
        {!isQuestionSelection && (
          <button className="secondary-button" type="button" onClick={onMark}>
            <Highlighter size={15} />
            {readerT(displayLanguage, "highlightOnly")}
          </button>
        )}
        <button className="primary-button" type="button" disabled={isLookingUp} onClick={onDictionary}>
          <BookOpen size={15} />
          {isLookingUp ? readerT(displayLanguage, "searching") : readerT(displayLanguage, "dictionaryLookup")}
        </button>
        <PronunciationButton word={selected.word} />
        <button className="secondary-button" type="button" disabled={isLookingUp || !aiConfigured} onClick={onSemanticAnalysis}>
          {aiConfigured ? readerT(displayLanguage, "contextAnalysis") : readerT(displayLanguage, "configureAi")}
        </button>
        {lookup?.contextualMeaning && (
          <button className="secondary-button" type="button" disabled={isLookingUp || !aiConfigured} onClick={onRegenerateAnalysis}>
            閲嶆柊鐢熸垚
          </button>
        )}
        {isLookingUp && (
          <button className="cancel-button" type="button" onClick={onCancel}>
            {readerT(displayLanguage, "cancelSearch")}
          </button>
        )}
      </div>
      {lookup && (
        <div className="dictionary-result selection-learning-result">
          {lookup.phonetic && <small>/{lookup.phonetic}/</small>}
          {lookup.contextualMeaning ? (
            <section className="ai-meaning-block contextual">
              <span>鏈彞閲婁箟</span>
              <b>{lookup.contextualMeaning}</b>
            </section>
          ) : (
            <b>{lookup.translation || "鏈幏鍙栧埌涓枃閲婁箟"}</b>
          )}
          {lookup.commonMeanings?.length ? (
            <section className="ai-meaning-block">
              <span>甯歌閲婁箟</span>
              <p>{lookup.commonMeanings.join("、")}</p>
            </section>
          ) : (
            lookup.definition && <p className="dictionary-definition">{lookup.definition}</p>
          )}
          {lookup.sentenceTranslation && (
            <section className="ai-meaning-block">
              <span>鏁村彞缈昏瘧</span>
              <p className="dictionary-definition">{lookup.sentenceTranslation}</p>
            </section>
          )}
          {lookup.usageNote && (
            <section className="ai-meaning-block">
              <span>鐢ㄦ硶鎻愮ず</span>
              <p className="dictionary-definition">{lookup.usageNote}</p>
            </section>
          )}
          {!isQuestionSelection && (
            <button className="primary-button" type="button" disabled={isLookingUp} onClick={onSave}>
              {readerT(displayLanguage, "saveLearningCard")}
            </button>
          )}
        </div>
      )}
    </section>
  );
}






