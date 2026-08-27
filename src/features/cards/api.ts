import type { AppInvoke } from "../../services/appInvoke";
import type { Card, CardCreateResult, CardReference, Selection } from "./types";

export const cardApi = {
  createMarking(invoke: AppInvoke, articleId: number, selection: Selection) {
    return invoke<void>("create_marking", { input: { articleId, ...selection } });
  },
  createCard(invoke: AppInvoke, input: Record<string, unknown>) {
    return invoke<CardCreateResult>("create_card", { input });
  },
  updateCard(invoke: AppInvoke, card: Card) {
    return invoke<void>("update_card", { input: card });
  },
  updateContext(invoke: AppInvoke, reference: CardReference) {
    return invoke<void>("update_card_context", {
      input: {
        id: reference.id,
        contextualMeaning: reference.contextualMeaning,
        sentenceTranslation: reference.sentenceTranslation,
        usageNote: reference.usageNote,
        learningNote: reference.learningNote,
        source: "user",
        overwriteUserEdits: false,
      },
    });
  },
  deleteCard(invoke: AppInvoke, id: number) {
    return invoke<void>("delete_card", { id });
  },
};
