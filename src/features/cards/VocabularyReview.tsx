import { GraduationCap, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { vocabularyT, type DisplayLanguage } from "../../i18n/ui";
import type { Card } from "./types";
import { PronunciationButton } from "./PronunciationButton";

export function VocabularyReview({ cards, focusedCardId, loading, query, onQuery, onExportPdf, onExportWord, onOpenArticle, displayLanguage = "zh-CN" }: {
  cards: Card[];
  focusedCardId?: number | null;
  loading: boolean;
  query: string;
  onQuery: (value: string) => void;
  onExportPdf: (items: Card[]) => void;
  onExportWord: (items: Card[]) => void;
  onOpenArticle: (articleId: number) => void;
  displayLanguage?: DisplayLanguage;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const focusedRowRef = useRef<HTMLTableRowElement | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleCards = cards.filter((card) => !normalizedQuery || [card.word, card.phonetic, card.translation, card.definition].join(" ").toLowerCase().includes(normalizedQuery));
  const selectedCard = visibleCards.find((card) => card.id === selectedId) ?? visibleCards[0] ?? null;
  useEffect(() => {
    if (selectedId && !visibleCards.some((card) => card.id === selectedId)) setSelectedId(null);
  }, [selectedId, visibleCards]);
  useEffect(() => {
    if (focusedCardId && cards.some((card) => card.id === focusedCardId)) setSelectedId(focusedCardId);
  }, [cards, focusedCardId]);
  useEffect(() => {
    if (selectedCard?.id === focusedCardId) focusedRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusedCardId, selectedCard?.id]);

  return (
    <section className="vocabulary-review">
      <header className="vocabulary-review-head">
        <div>
          <p>{vocabularyT(displayLanguage, "section")}</p>
          <h1>{vocabularyT(displayLanguage, "title")}</h1>
          <span>{vocabularyT(displayLanguage, "summary", { total: cards.length, visible: visibleCards.length })}</span>
        </div>
        <div className="vocabulary-review-actions">
          <button className="secondary-button" type="button" disabled={!visibleCards.length} onClick={() => onExportWord(visibleCards)}>{vocabularyT(displayLanguage, "exportWord")}</button>
          <button className="primary-button" type="button" disabled={!visibleCards.length} onClick={() => onExportPdf(visibleCards)}>{vocabularyT(displayLanguage, "exportPdf")}</button>
        </div>
      </header>
      <label className="vocabulary-search">
        <Search size={16} />
        <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder={vocabularyT(displayLanguage, "searchPlaceholder")} />
      </label>
      {loading ? <ReviewEmptyState text={vocabularyT(displayLanguage, "loading")} /> : !visibleCards.length ? (
        <ReviewEmptyState icon={<GraduationCap />} text={vocabularyT(displayLanguage, "empty")} detail={vocabularyT(displayLanguage, "emptyDetail")} />
      ) : (
        <div className="vocabulary-review-grid">
          <div className="vocabulary-table-wrap">
            <table className="vocabulary-table">
              <thead><tr><th>{vocabularyT(displayLanguage, "word")}</th><th>{vocabularyT(displayLanguage, "phonetic")}</th><th>{vocabularyT(displayLanguage, "definition")}</th><th>{vocabularyT(displayLanguage, "contexts")}</th></tr></thead>
              <tbody>{visibleCards.map((card) => (
                <tr key={card.id} ref={card.id === focusedCardId ? focusedRowRef : undefined} className={selectedCard?.id === card.id ? "selected" : ""} onClick={() => setSelectedId(card.id)}>
                  <td>{card.word}</td><td>{card.phonetic ? `/${card.phonetic}/` : "?"}</td><td>{card.translation || card.definition || vocabularyT(displayLanguage, "noDefinition")}</td><td>{card.references.length}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <aside className="vocabulary-detail">
            {selectedCard && <>
              <div className="vocabulary-detail-title"><div><h2>{selectedCard.word}</h2>{selectedCard.phonetic && <span>/{selectedCard.phonetic}/</span>}</div><PronunciationButton word={selectedCard.word} /><b>{vocabularyT(displayLanguage, "contextCount", { count: selectedCard.references.length })}</b></div>
              <p>{selectedCard.translation || selectedCard.definition || vocabularyT(displayLanguage, "noDefinition")}</p>
              <div className="vocabulary-contexts">{selectedCard.references.map((reference, index) => <button key={reference.id} type="button" onClick={() => onOpenArticle(reference.articleId)}><small>{vocabularyT(displayLanguage, "contextLine", { index: String(index + 1).padStart(2, "0"), title: reference.articleTitle, line: reference.lineNumber })}</small><span>{reference.contextSentence}</span></button>)}</div>
            </>}
          </aside>
        </div>
      )}
    </section>
  );
}

function ReviewEmptyState({ icon, text, detail }: { icon?: React.ReactNode; text: string; detail?: string }) {
  return <div className="empty-state">{icon}<p>{text}</p>{detail && <span>{detail}</span>}</div>;
}




