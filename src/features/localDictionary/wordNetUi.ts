import type { DisplayLanguage } from "../../i18n/ui";
import type { WordNetImportProgress } from "./resourceFileConversion";
import { isResourceImportError, type ResourceImportErrorCode } from "./resourceImportErrors";

type WordNetUiKey = "importDirectory" | "analyzingDirectory" | "analyzingEntries" | "checkingDirectory" | "parsingFile" | "importFailed" | "resourceFileFilter";

const resourceLanguageCodes: Record<string, string> = {
  zh: "zh",
  en: "en",
  ja: "ja",
  ko: "ko",
  fr: "fr",
  de: "de",
  es: "es",
  it: "it",
  pt: "pt",
  ru: "ru",
  ar: "ar",
};

const wordNetMessages: Record<DisplayLanguage, Record<WordNetUiKey, string>> = {
  "zh-CN": { importDirectory: "导入 WordNet 目录", analyzingDirectory: "正在分析 WordNet 目录…", analyzingEntries: "正在分析 WordNet 词条…", checkingDirectory: "正在检查 WordNet 目录…", parsingFile: "正在解析 {file}（{percent}%）…", importFailed: "WordNet 导入失败：{error}", resourceFileFilter: "语言资源文件" },
  "zh-TW": { importDirectory: "匯入 WordNet 目錄", analyzingDirectory: "正在分析 WordNet 目錄…", analyzingEntries: "正在分析 WordNet 詞條…", checkingDirectory: "正在檢查 WordNet 目錄…", parsingFile: "正在解析 {file}（{percent}%）…", importFailed: "WordNet 匯入失敗：{error}", resourceFileFilter: "語言資源檔案" },
  en: { importDirectory: "Import WordNet folder", analyzingDirectory: "Analyzing WordNet folder…", analyzingEntries: "Analyzing WordNet entries…", checkingDirectory: "Checking WordNet folder…", parsingFile: "Parsing {file} ({percent}%)…", importFailed: "WordNet import failed: {error}", resourceFileFilter: "Language resource files" },
  ja: { importDirectory: "WordNet フォルダーをインポート", analyzingDirectory: "WordNet フォルダーを解析中…", analyzingEntries: "WordNet の見出し語を解析中…", checkingDirectory: "WordNet フォルダーを確認中…", parsingFile: "{file} を解析中（{percent}%）…", importFailed: "WordNet のインポートに失敗しました: {error}", resourceFileFilter: "言語リソースファイル" },
  ko: { importDirectory: "WordNet 폴더 가져오기", analyzingDirectory: "WordNet 폴더를 분석하는 중…", analyzingEntries: "WordNet 항목을 분석하는 중…", checkingDirectory: "WordNet 폴더를 확인하는 중…", parsingFile: "{file} 분석 중 ({percent}%)…", importFailed: "WordNet 가져오기에 실패했습니다: {error}", resourceFileFilter: "언어 리소스 파일" },
  fr: { importDirectory: "Importer le dossier WordNet", analyzingDirectory: "Analyse du dossier WordNet…", analyzingEntries: "Analyse des entrées WordNet…", checkingDirectory: "Vérification du dossier WordNet…", parsingFile: "Analyse de {file} ({percent} %)…", importFailed: "Échec de l’importation de WordNet : {error}", resourceFileFilter: "Fichiers de ressources linguistiques" },
  de: { importDirectory: "WordNet-Ordner importieren", analyzingDirectory: "WordNet-Ordner wird analysiert…", analyzingEntries: "WordNet-Einträge werden analysiert…", checkingDirectory: "WordNet-Ordner wird geprüft…", parsingFile: "{file} wird analysiert ({percent} %)…", importFailed: "WordNet-Import fehlgeschlagen: {error}", resourceFileFilter: "Sprachressourcendateien" },
  es: { importDirectory: "Importar carpeta de WordNet", analyzingDirectory: "Analizando la carpeta de WordNet…", analyzingEntries: "Analizando entradas de WordNet…", checkingDirectory: "Comprobando la carpeta de WordNet…", parsingFile: "Analizando {file} ({percent} %)…", importFailed: "Error al importar WordNet: {error}", resourceFileFilter: "Archivos de recursos lingüísticos" },
};

const importErrorMessages: Record<DisplayLanguage, Record<ResourceImportErrorCode, string>> = {
  "zh-CN": { "xml-invalid": "XML 文件无法解析。", "json-invalid": "JSON 文件格式无效。", "stardict-64-bit": "暂不支持 64 位索引的 StarDict 词典。", "stardict-no-entries": "未从 StarDict 文件读取到有效词条。", "epub-metadata-missing": "EPUB 缺少包元数据。", "epub-chapter-missing": "EPUB 中没有可读取的正文内容。", "wordnet-missing-file": "WordNet 目录不完整，缺少 {file}。请选择完整的 dict 文件夹。", "wordnet-no-entries": "未从 WordNet 目录读取到有效词条。请确认文件来自 WordNet 原始词典目录。", "gzip-archive": "暂不支持直接导入 .tar.gz 归档包，请先解压后选择其中的资源文件或 WordNet dict 文件夹。", "gzip-unsupported-format": "暂不支持直接导入 .{extension}.gz，请先解压后导入原始文件。", "gzip-invalid": "压缩资源文件已损坏或不是有效的 gzip 文件。", "gzip-empty": "压缩资源文件为空。", "resource-no-entries": "未读取到可导入的有效词条。" },
  "zh-TW": { "xml-invalid": "XML 檔案無法解析。", "json-invalid": "JSON 檔案格式無效。", "stardict-64-bit": "目前不支援使用 64 位索引的 StarDict 字典。", "stardict-no-entries": "未能從 StarDict 檔案讀取有效詞條。", "epub-metadata-missing": "EPUB 缺少套件中繼資料。", "epub-chapter-missing": "EPUB 沒有可讀取的正文內容。", "wordnet-missing-file": "WordNet 目錄不完整，缺少 {file}。請選擇完整的 dict 資料夾。", "wordnet-no-entries": "未能從 WordNet 目錄讀取有效詞條。請確認檔案來自 WordNet 原始字典目錄。", "gzip-archive": "不支援直接匯入 .tar.gz 封存檔。請先解壓縮後選擇其中的資源檔案或 WordNet dict 資料夾。", "gzip-unsupported-format": "不支援直接匯入 .{extension}.gz。請先解壓縮後匯入原始檔案。", "gzip-invalid": "壓縮資源檔案已損壞或不是有效的 gzip 檔案。", "gzip-empty": "壓縮資源檔案是空的。", "resource-no-entries": "未讀取到可匯入的有效詞條。" },
  en: { "xml-invalid": "The XML file cannot be parsed.", "json-invalid": "The JSON file is invalid.", "stardict-64-bit": "StarDict dictionaries with 64-bit indexes are not supported yet.", "stardict-no-entries": "No valid entries were read from the StarDict files.", "epub-metadata-missing": "The EPUB package metadata is missing.", "epub-chapter-missing": "The EPUB has no readable text chapter.", "wordnet-missing-file": "The WordNet folder is incomplete: {file} is missing. Select the complete dict folder.", "wordnet-no-entries": "No valid entries were read from the WordNet folder. Confirm that it is an original WordNet dictionary folder.", "gzip-archive": ".tar.gz archive packages cannot be imported directly. Extract them first, then select a resource file or the WordNet dict folder.", "gzip-unsupported-format": ".{extension}.gz cannot be imported directly. Extract the original file first.", "gzip-invalid": "The compressed resource is damaged or is not a valid gzip file.", "gzip-empty": "The compressed resource file is empty.", "resource-no-entries": "No valid entries were found to import." },
  ja: { "xml-invalid": "XML ファイルを解析できません。", "json-invalid": "JSON ファイルの形式が無効です。", "stardict-64-bit": "64 ビット索引の StarDict 辞書はまだ対応していません。", "stardict-no-entries": "StarDict ファイルから有効な見出し語を読み取れませんでした。", "epub-metadata-missing": "EPUB パッケージのメタデータがありません。", "epub-chapter-missing": "EPUB に読み取れる本文章がありません。", "wordnet-missing-file": "WordNet フォルダーが不完全です: {file} がありません。完全な dict フォルダーを選択してください。", "wordnet-no-entries": "WordNet フォルダーから有効な見出し語を読み取れませんでした。公式の WordNet 辞書フォルダーを確認してください。", "gzip-archive": ".tar.gz アーカイブは直接インポートできません。先に展開してから、リソースファイルまたは WordNet の dict フォルダーを選択してください。", "gzip-unsupported-format": ".{extension}.gz は直接インポートできません。先に元のファイルを展開してください。", "gzip-invalid": "圧縮リソースが破損しているか、有効な gzip ファイルではありません。", "gzip-empty": "圧縮リソースファイルが空です。", "resource-no-entries": "インポートできる有効な見出し語がありません。" },
  ko: { "xml-invalid": "XML 파일을 분석할 수 없습니다.", "json-invalid": "JSON 파일 형식이 올바르지 않습니다.", "stardict-64-bit": "64비트 인덱스 StarDict 사전은 아직 지원하지 않습니다.", "stardict-no-entries": "StarDict 파일에서 유효한 항목을 읽지 못했습니다.", "epub-metadata-missing": "EPUB 패키지 메타데이터가 없습니다.", "epub-chapter-missing": "EPUB에 읽을 수 있는 본문 장이 없습니다.", "wordnet-missing-file": "WordNet 폴더가 불완전합니다: {file} 파일이 없습니다. 완전한 dict 폴더를 선택하세요.", "wordnet-no-entries": "WordNet 폴더에서 유효한 항목을 읽지 못했습니다. 원본 WordNet 사전 폴더인지 확인하세요.", "gzip-archive": ".tar.gz 보관 파일은 직접 가져올 수 없습니다. 먼저 압축을 푼 뒤 리소스 파일 또는 WordNet dict 폴더를 선택하세요.", "gzip-unsupported-format": ".{extension}.gz 파일은 직접 가져올 수 없습니다. 먼저 원본 파일의 압축을 푸세요.", "gzip-invalid": "압축 리소스가 손상되었거나 올바른 gzip 파일이 아닙니다.", "gzip-empty": "압축 리소스 파일이 비어 있습니다.", "resource-no-entries": "가져올 수 있는 유효한 항목이 없습니다." },
  fr: { "xml-invalid": "Le fichier XML ne peut pas être analysé.", "json-invalid": "Le fichier JSON est invalide.", "stardict-64-bit": "Les dictionnaires StarDict avec index 64 bits ne sont pas encore pris en charge.", "stardict-no-entries": "Aucune entrée valide n’a été lue dans les fichiers StarDict.", "epub-metadata-missing": "Les métadonnées du paquet EPUB sont absentes.", "epub-chapter-missing": "L’EPUB ne contient aucun chapitre de texte lisible.", "wordnet-missing-file": "Le dossier WordNet est incomplet : {file} est manquant. Sélectionnez le dossier dict complet.", "wordnet-no-entries": "Aucune entrée valide n’a été lue dans le dossier WordNet. Vérifiez qu’il s’agit du dossier d’origine WordNet.", "gzip-archive": "Les archives .tar.gz ne peuvent pas être importées directement. Extrayez-les, puis sélectionnez un fichier de ressource ou le dossier dict de WordNet.", "gzip-unsupported-format": "Le fichier .{extension}.gz ne peut pas être importé directement. Extrayez d’abord le fichier d’origine.", "gzip-invalid": "La ressource compressée est endommagée ou n’est pas un fichier gzip valide.", "gzip-empty": "Le fichier de ressource compressé est vide.", "resource-no-entries": "Aucune entrée valide à importer n’a été trouvée." },
  de: { "xml-invalid": "Die XML-Datei kann nicht gelesen werden.", "json-invalid": "Die JSON-Datei ist ungültig.", "stardict-64-bit": "StarDict-Wörterbücher mit 64-Bit-Index werden noch nicht unterstützt.", "stardict-no-entries": "Aus den StarDict-Dateien wurden keine gültigen Einträge gelesen.", "epub-metadata-missing": "Die EPUB-Paketmetadaten fehlen.", "epub-chapter-missing": "Das EPUB enthält kein lesbares Textkapitel.", "wordnet-missing-file": "Der WordNet-Ordner ist unvollständig: {file} fehlt. Wählen Sie den vollständigen dict-Ordner.", "wordnet-no-entries": "Aus dem WordNet-Ordner wurden keine gültigen Einträge gelesen. Prüfen Sie, ob es der originale WordNet-Wörterbuchordner ist.", "gzip-archive": ".tar.gz-Archive können nicht direkt importiert werden. Entpacken Sie sie zuerst und wählen Sie dann eine Ressourcendatei oder den WordNet-dict-Ordner.", "gzip-unsupported-format": ".{extension}.gz kann nicht direkt importiert werden. Entpacken Sie zuerst die Originaldatei.", "gzip-invalid": "Die komprimierte Ressource ist beschädigt oder keine gültige gzip-Datei.", "gzip-empty": "Die komprimierte Ressourcendatei ist leer.", "resource-no-entries": "Keine gültigen Einträge zum Import gefunden." },
  es: { "xml-invalid": "No se puede analizar el archivo XML.", "json-invalid": "El archivo JSON no es válido.", "stardict-64-bit": "Los diccionarios StarDict con índices de 64 bits aún no son compatibles.", "stardict-no-entries": "No se leyeron entradas válidas de los archivos StarDict.", "epub-metadata-missing": "Faltan los metadatos del paquete EPUB.", "epub-chapter-missing": "El EPUB no tiene ningún capítulo de texto legible.", "wordnet-missing-file": "La carpeta de WordNet está incompleta: falta {file}. Selecciona la carpeta dict completa.", "wordnet-no-entries": "No se leyeron entradas válidas de la carpeta de WordNet. Confirma que sea una carpeta de diccionario WordNet original.", "gzip-archive": "Los paquetes .tar.gz no se pueden importar directamente. Extráelos primero y luego selecciona un archivo de recursos o la carpeta dict de WordNet.", "gzip-unsupported-format": ".{extension}.gz no se puede importar directamente. Extrae primero el archivo original.", "gzip-invalid": "El recurso comprimido está dañado o no es un archivo gzip válido.", "gzip-empty": "El archivo de recursos comprimido está vacío.", "resource-no-entries": "No se encontraron entradas válidas para importar." },
};

export function wordNetT(language: DisplayLanguage, key: WordNetUiKey, replacements: Record<string, string | number> = {}) {
  return Object.entries(replacements).reduce((value, [name, replacement]) => value.split(`{${name}}`).join(String(replacement)), wordNetMessages[language][key]);
}

export function wordNetProgressText(progress: WordNetImportProgress, language: DisplayLanguage) {
  return progress.stage === "checking"
    ? wordNetT(language, "checkingDirectory")
    : wordNetT(language, "parsingFile", { file: progress.file ?? "WordNet", percent: progress.percent ?? 0 });
}

export function resourceImportErrorMessage(error: unknown, language: DisplayLanguage) {
  if (!isResourceImportError(error)) return String(error);
  return Object.entries(error.details).reduce((value, [name, replacement]) => value.split(`{${name}}`).join(replacement), importErrorMessages[language][error.code]);
}

export function resourceLanguageLabel(language: string, displayLanguage: DisplayLanguage, fallback: string) {
  const languageCode = resourceLanguageCodes[language];
  if (!languageCode) return fallback;
  try {
    return new Intl.DisplayNames([displayLanguage], { type: "language" }).of(languageCode) ?? fallback;
  } catch {
    return fallback;
  }
}
