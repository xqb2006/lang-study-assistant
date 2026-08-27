import { importRuntimeT, importT, type DisplayLanguage } from "../../i18n/ui";
import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile, readTextFile } from "@tauri-apps/plugin-fs";
import { appInvoke, isTauri } from "../../services/appInvoke";
import { parseQuestionText, recognizeQuestionImage } from "./recognition";
import type { QuestionDraft } from "./types";

type QuestionImportPanelProps = {
  articleId: number;
  onSaved: () => Promise<void>;
  displayLanguage?: DisplayLanguage;
};

export function QuestionImportPanel({ articleId, onSaved, displayLanguage = "zh-CN" }: QuestionImportPanelProps) {
  const [rawText, setRawText] = useState("");
  const [drafts, setDrafts] = useState<QuestionDraft[]>([]);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);

  const importFile = async () => {
    if (!isTauri) {
      setMessage(importRuntimeT(displayLanguage, "questionDesktopOnly"));
      return;
    }
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: "题目文件", extensions: ["txt", "md", "docx"] }],
      });
      if (!path || Array.isArray(path)) return;
      const text = path.toLowerCase().endsWith(".docx")
        ? await (await import("../../documentTools")).extractDocxText(
            await readFile(path),
          )
        : await readTextFile(path);
      setRawText(text);
      setMessage(importRuntimeT(displayLanguage, "questionsImported"));
    } catch (error) {
      setMessage(importRuntimeT(displayLanguage, "questionFileFailed", { error: String(error) }));
    }
  };

  const importImage = async () => {
    if (!isTauri) {
      setMessage(importRuntimeT(displayLanguage, "questionImageOnly"));
      return;
    }
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: "题目图片", extensions: ["jpg", "jpeg", "png", "webp"] }],
      });
      if (!path || Array.isArray(path)) return;
      setIsRecognizing(true);
      const bytes = await readFile(path);
      const extension = path.split(".").pop()?.toLowerCase();
      const mime =
        extension === "png"
          ? "image/png"
          : extension === "webp"
            ? "image/webp"
            : "image/jpeg";
      const imageData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          typeof reader.result === "string"
            ? resolve(reader.result)
            : reject(new Error(importRuntimeT(displayLanguage, "imageReadFailed")));
        reader.onerror = () => reject(reader.error ?? new Error(importRuntimeT(displayLanguage, "imageReadFailed")));
        reader.readAsDataURL(new Blob([bytes], { type: mime }));
      });
      const recognized = await recognizeQuestionImage(imageData);
      setDrafts(recognized);
      setMessage(importRuntimeT(displayLanguage, "imageRecognized", { count: recognized.length }));
    } catch (error) {
      setMessage(importRuntimeT(displayLanguage, "imageRecognitionFailed", { error: String(error) }));
    } finally {
      setIsRecognizing(false);
    }
  };

  const update = (index: number, patch: Partial<QuestionDraft>) =>
    setDrafts((current) =>
      current.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, ...patch } : draft,
      ),
    );

  const createDraftsFromText = () => {
    const parsed = parseQuestionText(rawText);
    setDrafts(parsed);
    setMessage(
      parsed.length
        ? importRuntimeT(displayLanguage, "questionsRecognized", { count: parsed.length })
        : importRuntimeT(displayLanguage, "questionsNotRecognized"),
    );
  };

  const saveAll = async () => {
    const valid = drafts.filter((draft) => draft.prompt.trim());
    if (!valid.length) {
      setMessage(importRuntimeT(displayLanguage, "questionRequired"));
      return;
    }
    try {
      setIsSaving(true);
      await appInvoke<number>("save_questions", {
        input: {
          articleId,
          questions: valid.map((draft, index) => ({
            articleId,
            position: index + 1,
            questionType: "single_choice",
            prompt: draft.prompt,
            answer: draft.answer,
            explanation: draft.explanation,
            sourceLine: draft.sourceLine ?? null,
            options: draft.options.filter((option) => option.content.trim()),
          })),
        },
      });
      await onSaved();
      setDrafts([]);
      setRawText("");
      setMessage(importRuntimeT(displayLanguage, "questionsSaved", { count: valid.length }));
    } catch (error) {
      setMessage(importRuntimeT(displayLanguage, "questionsSaveFailed", { error: String(error) }));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="question-import-panel">
      <h3>{importT(displayLanguage, "questionImportTitle")}</h3>
      <p className="modal-copy">
        {importT(displayLanguage, "questionImportHint")}
      </p>
      <div className="question-import-actions">
        <button className="secondary-button" type="button" onClick={() => void importFile()}>
          {importT(displayLanguage, "importQuestionFile")}
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={isRecognizing}
          onClick={() => void importImage()}
        >
          {isRecognizing ? importT(displayLanguage, "recognizingQuestions") : importT(displayLanguage, "importQuestionImage")}
        </button>
        <button className="primary-button" type="button" onClick={createDraftsFromText}>
          {importT(displayLanguage, "recognizePasted")}
        </button>
      </div>
      <textarea
        rows={6}
        value={rawText}
        onChange={(event) => setRawText(event.target.value)}
        placeholder={"1. What is the main idea?\nA. ...\nB. ...\n答案：A"}
      />
      {message && <p className="settings-feedback">{message}</p>}
      {drafts.length > 0 && (
        <div className="question-draft-list">
          {drafts.map((draft, index) => (
            <article key={`${index}-${draft.prompt}`}>
              <b>{importT(displayLanguage, "questionNumber", { index: index + 1 })}</b>
              <textarea
                rows={3}
                value={draft.prompt}
                onChange={(event) => update(index, { prompt: event.target.value })}
                placeholder={importT(displayLanguage, "questionPrompt")}
              />
              {draft.options.map((option, optionIndex) => (
                <label key={`${optionIndex}-${option.content}`}>
                  <input
                    type="radio"
                    name={`draft-answer-${index}`}
                    checked={option.isCorrect}
                    onChange={() =>
                      update(index, {
                        answer: String.fromCharCode(65 + optionIndex),
                        options: draft.options.map((item, itemIndex) => ({
                          ...item,
                          isCorrect: itemIndex === optionIndex,
                        })),
                      })
                    }
                  />
                  <input
                    value={option.content}
                    onChange={(event) =>
                      update(index, {
                        options: draft.options.map((item, itemIndex) =>
                          itemIndex === optionIndex
                            ? { ...item, content: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                </label>
              ))}
              <input
                value={draft.answer}
                onChange={(event) => update(index, { answer: event.target.value.toUpperCase() })}
                placeholder={importT(displayLanguage, "correctAnswer")}
              />
              <textarea
                rows={2}
                value={draft.explanation}
                onChange={(event) => update(index, { explanation: event.target.value })}
                placeholder={importT(displayLanguage, "explanationOptional")}
              />
            </article>
          ))}
        </div>
      )}
      {drafts.length > 0 && (
        <button
          className="primary-button"
          type="button"
          disabled={isSaving}
          onClick={() => void saveAll()}
        >
          {isSaving ? importT(displayLanguage, "saving") : importT(displayLanguage, "saveQuestions", { count: drafts.length })}
        </button>
      )}
    </section>
  );
}
