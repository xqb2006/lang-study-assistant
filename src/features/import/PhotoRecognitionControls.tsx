import { importT, type DisplayLanguage } from "../../i18n/ui";

type PhotoRecognitionControlsProps = { photoCount: number; isRecognizing: boolean; progress: { current: number; total: number }; message: string; onRecognize: () => void; onCancel: () => void; displayLanguage?: DisplayLanguage; };
export function PhotoRecognitionControls({ photoCount, isRecognizing, progress, message, onRecognize, onCancel, displayLanguage = "zh-CN" }: PhotoRecognitionControlsProps) {
  return <><button className="primary-button" type="button" disabled={isRecognizing || !photoCount} onClick={onRecognize}>{isRecognizing ? importT(displayLanguage, "recognizing") : importT(displayLanguage, "startRecognition")}</button>{isRecognizing && <button className="cancel-button" type="button" onClick={onCancel}>{importT(displayLanguage, "stopKeepProgress")}</button>}{progress.total > 0 && <p className="import-progress">{importT(displayLanguage, "progress", progress)}</p>}{message && <p className="settings-feedback">{message}</p>}</>;
}
