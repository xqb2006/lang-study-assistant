import { FloatingWindow } from "../../components/FloatingWindow";
import type { ExportOptions } from "./types";
import { readerT, t, type DisplayLanguage } from "../../i18n/ui";

export function ExportOptionsModal({ options, displayLanguage = "zh-CN", onChange, onClose, onConfirm }: {
  options: ExportOptions;
  displayLanguage?: DisplayLanguage;
  onChange: (options: ExportOptions) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <FloatingWindow title={readerT(displayLanguage, "exportOptions")} onClose={onClose}>
      <label className="checkbox-row"><input type="checkbox" checked={options.includeHighlights} onChange={(event) => onChange({ ...options, includeHighlights: event.target.checked })} /> 保留原文高亮</label>
      <label className="checkbox-row"><input type="checkbox" checked={options.includeTranslation} onChange={(event) => onChange({ ...options, includeTranslation: event.target.checked })} /> 导出文章中文译文</label>
      <label className="checkbox-row"><input type="checkbox" checked={options.includeQuestions} onChange={(event) => onChange({ ...options, includeQuestions: event.target.checked, includeQuestionAnswers: event.target.checked ? options.includeQuestionAnswers : false })} /> 导出阅读题目</label>
      <label className="checkbox-row"><input type="checkbox" disabled={!options.includeQuestions} checked={options.includeQuestionAnswers} onChange={(event) => onChange({ ...options, includeQuestionAnswers: event.target.checked })} /> 附带题目答案与解析</label>
      <label className="checkbox-row"><input type="checkbox" checked={options.includeMarkedWords} onChange={(event) => onChange({ ...options, includeMarkedWords: event.target.checked })} /> 导出本文章标记生词详情</label>
      <label className="checkbox-row"><input type="checkbox" checked={options.includeVocabularyList} onChange={(event) => onChange({ ...options, includeVocabularyList: event.target.checked })} /> 在文末附加本文单词表（紧凑打印版）</label>
      <div className="form-actions"><button className="cancel-button" type="button" onClick={onClose}>{t(displayLanguage, "cancel")}</button><button className="primary-button" type="button" onClick={onConfirm}>{readerT(displayLanguage, "startExport")}</button></div>
    </FloatingWindow>
  );
}
