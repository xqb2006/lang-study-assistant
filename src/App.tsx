import {
  Suspense,
  lazy,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Highlighter,
  Pencil,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import "./App.css";
import { BilingualArticle, type ReaderParagraphContext } from "./components/BilingualArticle";
import { FloatingWindow } from "./components/FloatingWindow";
import { ConfirmDeleteModal } from "./components/ConfirmDeleteModal";
import { LocalDictionaryCenterModal } from "./features/localDictionary/LocalDictionaryCenterModal";
import { useLearningWorkspace } from "./features/learning/useLearningWorkspace";
import { QuestionImportPanel } from "./features/import/QuestionImportPanel";
import { PhotoImportModal } from "./features/import/PhotoImportModal";
import { ReaderActionDock } from "./features/chapters/ReaderActionDock";
import { Bookshelf } from "./features/chapters/Bookshelf";
import { BookCreationModal } from "./features/chapters/BookCreationModal";
import { BookContentPackageModal, type BookContentTarget } from "./features/chapters/BookContentPackageModal";
import { useArticleWorkspace } from "./features/chapters/useArticleWorkspace";
import { useReaderLayout } from "./features/chapters/useReaderLayout";
import {
  initialChapterDraft,
  useBookImport,
} from "./features/chapters/useBookImport";
import { useProjectPreferences } from "./features/chapters/useProjectPreferences";
import { DisplayLanguageModal } from "./features/shell/DisplayLanguageModal";
import { appNoticeT, chapterCreateT, learningT, t, workspaceT, type DisplayLanguage } from "./i18n/ui";
import { useReaderSelectionWorkspace } from "./features/cards/useReaderSelectionWorkspace";
import { useVocabularyReview } from "./features/cards/useVocabularyReview";
import { CardEditorModal, ContextEditorModal } from "./features/cards/CardEditModals";
import { SelectionLearningPanel } from "./features/cards/SelectionLearningPanel";
import { PronunciationButton } from "./features/cards/PronunciationButton";
import { useShortcutWorkspace } from "./features/shortcuts/useShortcutWorkspace";
import { useExportActions } from "./features/export/useExportActions";
import { AppSidebar, type ShellView } from "./features/shell/AppSidebar";
import { MobileNavigation } from "./features/shell/MobileNavigation";
import { useOverlayState } from "./features/shell/useOverlayState";
import { SettingsModal } from "./features/settings/SettingsModal";
import { useSettingsWorkspace } from "./features/settings/useSettingsWorkspace";
import { appInvoke } from "./services/appInvoke";
import { ANALYSIS_CACHE_LIMIT_KEY, DEFAULT_ANALYSIS_CACHE_LIMIT } from "./features/cards/analysisCache";
import { ReadingAssistantModal } from "./features/assistant/ReadingAssistantModal";
import { ReaderAssistantCompanion } from "./features/assistant/ReaderAssistantCompanion";

// 仅在本地开发构建中显示，正式发布包不会出现。
const TEST_BUILD_LABEL = import.meta.env.DEV ? "测试构建 · 本地开发" : "";

const LearningWorkspace = lazy(async () => {
  const module = await import("./components/LearningWorkspace");
  return { default: module.LearningWorkspace };
});
const VocabularyReview = lazy(async () => {
  const module = await import("./features/cards/VocabularyReview");
  return { default: module.VocabularyReview };
});
const ShortcutSettingsPage = lazy(async () => {
  const module = await import("./features/shortcuts/ShortcutSettingsPage");
  return { default: module.ShortcutSettingsPage };
});
const DiagnosticsPage = lazy(async () => {
  const module = await import("./features/shell/DiagnosticsPage");
  return { default: module.DiagnosticsPage };
});
const ExportOptionsModal = lazy(async () => {
  const module = await import("./features/export/ExportOptionsModal");
  return { default: module.ExportOptionsModal };
});

function DeferredFeatureLoading() {
  return <p className="settings-feedback">正在加载功能模块…</p>;
}

export default function App() {
  const { loadArticleParagraphs, loadLearningQuestions, submitLearningAnswer } =
    useLearningWorkspace();
  const [bookshelfVersion, setBookshelfVersion] = useState(0);
  const [bookContentAction, setBookContentAction] = useState<{ mode: "import" | "export"; targetBook?: BookContentTarget } | null>(null);
  const [activeView, setActiveView] = useState<ShellView>("library");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("准备就绪");
  const [focusedReviewCardId, setFocusedReviewCardId] = useState<number | null>(null);
  const [analysisCacheLimit, setAnalysisCacheLimit] = useState(() => {
    const stored = window.localStorage.getItem(ANALYSIS_CACHE_LIMIT_KEY);
    if (stored === null) return DEFAULT_ANALYSIS_CACHE_LIMIT;
    const value = Number(stored);
    return Number.isFinite(value) ? Math.max(0, Math.min(value, 2000)) : DEFAULT_ANALYSIS_CACHE_LIMIT;
  });
  const [displayLanguageOpen, setDisplayLanguageOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [mobileLibraryView, setMobileLibraryView] = useState<"shelf" | "reader">("shelf");
  const [assistantIdentityVersion, setAssistantIdentityVersion] = useState(0);
  const [currentParagraph, setCurrentParagraph] = useState<ReaderParagraphContext | null>(null);
  const {
    articles,
    setArticles,
    article,
    setArticle,
    marks,
    cards,
    load,
    reloadIfCurrent,
    clearCurrentArticle,
    refresh,
  } = useArticleWorkspace(setNotice);
  const readerRef = useRef<HTMLElement>(null);
  const learningWorkspaceRef = useRef<HTMLElement>(null);
  const {
    chapterPhotoOpen,
    closeReaderOverlays,
    editingCard,
    editingContext,
    exportFormat,
    exportOptions,
    learningOpen,
    localDictionaryOpen,
    pendingCardDelete,
    setEditingCard,
    setEditingContext,
    setExportFormat,
    setExportOptions,
    setLearningOpen,
    setLocalDictionaryOpen,
    setChapterPhotoOpen,
    setPendingCardDelete,
    setSettingsOpen,
    settingsOpen,
  } = useOverlayState();

  useEffect(() => {
    if (!learningOpen) return;

    const frameId = window.requestAnimationFrame(() => {
      learningWorkspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      learningWorkspaceRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [article?.id, learningOpen]);
  const {
    cardsCollapsed,
    hideCardPanel,
    listCollapsed,
    navCollapsed,
    startCardPanelResize,
    showCardPanel,
    toggleArticleList,
    toggleCardPanel,
    toggleNavigation,
    workspaceStyle,
  } = useReaderLayout();
  const focusReaderCard = (cardId: number) => {
    setFocusedReviewCardId(cardId);
    setActiveView("library");
    setMobileLibraryView("reader");
    showCardPanel();
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        document.getElementById(`word-card-${cardId}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 240);
    });
  };
  const {
    cards: reviewCards,
    loading: reviewLoading,
    query: reviewQuery,
    setQuery: setReviewQuery,
  } = useVocabularyReview(activeView === "vocabulary", setNotice);
  const refreshBookshelf = () => setBookshelfVersion((value) => value + 1);
  const {
    activeModel,
    activeProfileId,
    addModel,
    aiConfigured,
    aiProfiles,
    aiProvider,
    aiRequest,
    aiTestResult,
    createAiProfile,
    discoverModels,
    models,
    modelDraft,
    pendingAiProfileDelete,
    removeAiProfile,
    saveAiProvider,
    savedModels,
    selectAiProfile,
    setAiProvider,
    setModelDraft,
    setPendingAiProfileDelete,
    setSavedModels,
    settingsError,
    testAiProvider,
    activateAiProfile,
  } = useSettingsWorkspace({ setNotice });
  const {
    defaultLearningLanguage,
    displayLanguage,
    saveDefaultLearningLanguage,
    saveDisplayLanguage,
  } = useProjectPreferences(setNotice);
  const {
    articleOpen,
    chapterBook,
    chapterDraft,
    chapterQuestionsText,
    createArticle,
    createChapter,
    draft,
    importContentFile,
    importQuestionFile,
    isImporting,
    openBookCreation,
    closeBookCreation,
    setChapterBook,
    setChapterDraft,
    setChapterQuestionsText,
    setDraft,
  } = useBookImport({
    aiConfigured,
    defaultLearningLanguage,
    loadArticle: load,
    reloadCurrentArticle: reloadIfCurrent,
    refreshArticles: refresh,
    refreshBookshelf,
    setNotice,
  });
  const {
    exportPdf,
    exportVocabularyPdf,
    exportVocabularyWord,
    exportWord,
  } = useExportActions({
    article,
    cards,
    defaultOptions: exportOptions,
    marks,
    setNotice,
  });
  const {
    cancelLookup,
    captureReaderSelection,
    clearSelection,
    deleteCard,
    handleReaderShortcut,
    isCurrentSelectionLookingUp,
    jumpToReference,
    lookup,
    lookupSelection,
    lookupWithAi,
    markSelection,
    openQuestionLookup,
    saveLearningCard,
    saveCard,
    saveContext,
    selected,
  } = useReaderSelectionWorkspace({
    activeModel,
    analysisCacheLimit,
    article,
    cards,
    editingCard,
    editingContext,
    loadArticle: load,
    marks,
    onExistingCardSelect: focusReaderCard,
    pendingCardDelete,
    setEditingCard,
    setEditingContext,
    setNotice,
    setPendingCardDelete,
  });
  const {
    cancelRecording,
    recordingAction,
    recordingMessage,
    restoreDefaults,
    shortcuts,
    toggleRecording,
  } =
    useShortcutWorkspace({
      enabled: activeView === "library" && Boolean(article),
      onShortcut: (action) => handleReaderShortcut(action, readerRef, showCardPanel),
      setNotice,
    });
  useEffect(() => {
    void refresh(true);
  }, []);
  useEffect(() => {
    if (activeView === "library") return;
    closeReaderOverlays();
    cancelRecording();
  }, [activeView, cancelRecording, closeReaderOverlays]);
  useEffect(() => {
    const openShortcuts = () => {
      setSettingsOpen(false);
      setActiveView("shortcuts");
    };
    window.addEventListener("reading-agent:open-shortcuts", openShortcuts);
    return () =>
      window.removeEventListener("reading-agent:open-shortcuts", openShortcuts);
  }, []);
  return (
    <div className={`app-shell ${navCollapsed ? "nav-collapsed" : ""}`}>
      <AppSidebar
        activeView={activeView}
        articleCount={articles.length}
        configured={aiConfigured}
       
        markCount={marks.length}
        navCollapsed={navCollapsed}
        onNewBook={openBookCreation}
        onOpenDictionary={() => setLocalDictionaryOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenDisplayLanguage={() => setDisplayLanguageOpen(true)}
        onToggleNavigation={toggleNavigation}
        onViewChange={setActiveView}
        reviewCardCount={reviewCards.length}
      />
      <main>
        {activeView === "vocabulary" ? (
          <Suspense fallback={<DeferredFeatureLoading />}>
            <VocabularyReview
              cards={reviewCards}
              focusedCardId={focusedReviewCardId}
              loading={reviewLoading}
              query={reviewQuery}
              onQuery={setReviewQuery}
              onExportPdf={(items) => void exportVocabularyPdf(items, "我的单词")}
              onExportWord={(items) => void exportVocabularyWord(items, "我的单词")}
              onOpenArticle={(articleId) => { setActiveView("library"); void load(articleId); }}
             
            />
          </Suspense>
        ) : activeView === "diagnostics" ? (
          <Suspense fallback={<DeferredFeatureLoading />}><DiagnosticsPage /></Suspense>
        ) : activeView === "shortcuts" ? (
          <Suspense fallback={<DeferredFeatureLoading />}>
            <ShortcutSettingsPage
              shortcuts={shortcuts}
              recordingAction={recordingAction}
              recordingMessage={recordingMessage}
              onRecord={toggleRecording}
              onCancelRecording={cancelRecording}
              onRestoreDefaults={restoreDefaults}
             
            />
          </Suspense>
        ) : <>
        <header className="toolbar">
          <button
            className="icon-button"
            aria-label={workspaceT(displayLanguage, "collapseList")}
            onClick={toggleArticleList}
          >
            {listCollapsed ? <ChevronRight /> : <ChevronLeft />}
          </button>
          <label className="search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={workspaceT(displayLanguage, "search")}
            />
          </label>
          <span role="status">{notice}</span>
          {TEST_BUILD_LABEL ? (
            <small className="android-build-badge">{TEST_BUILD_LABEL}</small>
          ) : null}
          <button
            className="icon-button"
            aria-label={workspaceT(displayLanguage, "dictionarySettings")}
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={17} />
          </button>
        </header>
        <div
          className={`workspace ${listCollapsed ? "list-collapsed" : ""} ${cardsCollapsed ? "cards-collapsed" : ""} mobile-${mobileLibraryView}`}
          style={workspaceStyle}
        >
          <Bookshelf
            activeArticleId={article?.id}
           
            refreshKey={`${bookshelfVersion}:${articles.map((item) => item.id).join(",")}`}
            onOpenArticle={(id) => {
              if (id) {
                setMobileLibraryView("reader");
                void load(id);
              } else {
                setMobileLibraryView("shelf");
                clearCurrentArticle();
              }
            }}
            onNewBook={openBookCreation}
            onAddChapter={(book) => setChapterBook(book)}
            onImportReadingPackage={(book) => {
              setBookContentAction({
                mode: "import",
                targetBook: book ? { id: book.id, title: book.title, language: book.language } : undefined,
              });
            }}
            onExportBook={(book) => setBookContentAction({
              mode: "export",
              targetBook: { id: book.id, title: book.title, language: book.language },
            })}
            onArticleTitleChange={(articleId, title) => {
              if (articleId === article?.id) setArticle((current) => current ? { ...current, title } : current);
              if (articleId) setArticles((current) => current.map((item) => item.id === articleId ? { ...item, title } : item));
            }}
            onLibraryChanged={() => {
              refreshBookshelf();
              void refresh();
            }}
          />
          <section
            className="reader"
            ref={readerRef}
            onMouseUp={() => {
              if (captureReaderSelection(readerRef)) showCardPanel();
            }}
          >
            {article ? (
              <>
                <div className="reader-head">
                  <div>
                    <p>{workspaceT(displayLanguage, "currentReading")}</p>
                    <h2>{article.title}</h2>
                    <span>
                      {workspaceT(displayLanguage, "readingSummary", { words: article.content.trim().split(/\s+/).length, cards: cards.length })}
                    </span>
                  </div>
                  <div className="reader-actions">
                    <button
                      className="icon-button reader-card-panel-toggle"
                      type="button"
                      aria-label={cardsCollapsed ? "打开单词卡片" : "收起单词卡片"}
                      title={cardsCollapsed ? "打开单词卡片" : "收起单词卡片"}
                      onClick={toggleCardPanel}
                    >
                      {cardsCollapsed ? <ChevronLeft /> : <ChevronRight />}
                      <span className="reader-card-panel-toggle-label">{cardsCollapsed ? "单词卡" : "收起"}</span>
                    </button>
                  </div>
                </div>
                <BilingualArticle
                  article={article}
                  marks={marks}
                  loadParagraphs={loadArticleParagraphs}
                  onCurrentParagraphChange={setCurrentParagraph}
                 
                />
                {learningOpen && (
                  <section
                    ref={learningWorkspaceRef}
                    className="reader-learning-workspace"
                    tabIndex={-1}
                  >
                    <div className="learning-heading">
                      <h3>{learningT(displayLanguage, "workspaceTitle")}</h3>
                      <button className="icon-button" type="button" aria-label={t(displayLanguage, "cancel")} onClick={() => setLearningOpen(false)}>&times;</button>
                    </div>
                    <Suspense fallback={<DeferredFeatureLoading />}>
                      <LearningWorkspace
                        articleId={article.id}
                       
                        loadQuestions={loadLearningQuestions}
                        submitAnswer={submitLearningAnswer}
                        onTranslateQuestion={async (question) => {
                          if (!activeModel) throw new Error("请先在设置中添加并选择 AI 模型");
                          const result = await appInvoke<{ sentenceTranslation?: string; contextualMeaning?: string }>("lookup_with_ai", {
                            input: { word: question, context: question, model: activeModel, language: article.language ?? "en" },
                          });
                          return result.sentenceTranslation || result.contextualMeaning || "未获取到题目翻译";
                        }}
                        onLookupSelection={(selection, mode) => {
                          showCardPanel();
                          openQuestionLookup(selection, mode);
                        }}
                        questionImport={(onSaved) => (
                          <QuestionImportPanel articleId={article.id} onSaved={onSaved} />
                        )}
                        emptyState={<EmptyState text={appNoticeT(displayLanguage, "noQuestions")} detail={appNoticeT(displayLanguage, "noQuestionsHint")} />}
                      />
                    </Suspense>
                  </section>
                )}
              </>
            ) : (
              <EmptyState
                icon={<BookOpen size={34} />}
                text={workspaceT(displayLanguage, "selectArticle")}
                detail={workspaceT(displayLanguage, "selectArticleHint")}
              />
            )}
          </section>
          {!cardsCollapsed && (
            <button
              className="card-panel-backdrop"
              type="button"
              aria-label="关闭单词卡片面板"
              onClick={hideCardPanel}
            />
          )}
          <section className="cards-panel" aria-hidden={cardsCollapsed}>
            <div className="card-panel-resize-handle" onPointerDown={startCardPanelResize} role="separator" aria-orientation="vertical" aria-label="Resize word cards" />
            <div className="section-heading">
              <div>
                <p>{workspaceT(displayLanguage, "learningTips")}</p>
                <h1>{workspaceT(displayLanguage, "wordCards")}</h1>
              </div>
              <div className="card-panel-heading-actions">
                <b>{cards.length}</b>
                <button
                  className="icon-button card-panel-close"
                  type="button"
                  aria-label="收起单词卡片"
                  title="收起单词卡片"
                  onClick={hideCardPanel}
                >
                  <ChevronRight size={16} />
                  <span>收起</span>
                </button>
              </div>
            </div>
            <SelectionLearningPanel
              aiConfigured={aiConfigured}
             
              isLookingUp={isCurrentSelectionLookingUp}
              lookup={lookup}
              selected={selected}
              onCancel={cancelLookup}
              onClear={clearSelection}
              onDictionary={() => void lookupSelection()}
              onMark={() => void markSelection()}
              onSave={() => void saveLearningCard()}
              onSemanticAnalysis={() => void lookupWithAi()}
              onRegenerateAnalysis={() => void lookupWithAi(undefined, true)}
            />
            {cards.map((card) => (
              <div id={`word-card-${card.id}`} className={`word-card${focusedReviewCardId === card.id ? " focused" : ""}`} key={card.id}>
                <button
                  className="word-card-content"
                  onClick={() =>
                    document
                      .getElementById(`line-${card.lineNumber}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "center" })
                  }
                >
                  <strong>{card.word}</strong>
                  {card.phonetic && <small>/{card.phonetic}/</small>}
                  <span>
                    {card.translation || card.definition || workspaceT(displayLanguage, "noDefinition")}
                  </span>
                </button>
                <div className="card-actions">
                  <PronunciationButton word={card.word} className="icon-button pronunciation-icon-button" />
                  <button
                    className="icon-button"
                    aria-label={workspaceT(displayLanguage, "editCard")}
                    onClick={() => setEditingCard(card)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-button danger"
                    aria-label={workspaceT(displayLanguage, "deleteCard")}
                    onClick={() => setPendingCardDelete(card)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="card-references">
                  <b>{workspaceT(displayLanguage, "contexts", { count: card.references.length })}</b>
                  {card.references.length ? (
                    card.references.map((reference) => (
                      <div className="card-reference" key={reference.id}>
                        <button onClick={() => void jumpToReference(reference)}>
                          <small>
                            {workspaceT(displayLanguage, "referenceLine", { title: reference.articleTitle, line: reference.lineNumber })}
                          </small>
                          <span>{reference.contextSentence}</span>
                          {reference.contextualMeaning && (
                            <em>{workspaceT(displayLanguage, "contextMeaning", { value: reference.contextualMeaning })}</em>
                          )}
                          {reference.sentenceTranslation && (
                            <em>{workspaceT(displayLanguage, "sentenceTranslation", { value: reference.sentenceTranslation })}</em>
                          )}
                          {reference.usageNote && (
                            <em>{workspaceT(displayLanguage, "usageNote", { value: reference.usageNote })}</em>
                          )}
                          {reference.learningNote && (
                            <em>{workspaceT(displayLanguage, "note", { value: reference.learningNote })}</em>
                          )}
                        </button>
                        <button className="secondary-button context-edit-button" type="button" onClick={() => setEditingContext(reference)}>
                          {workspaceT(displayLanguage, "editContext")}
                        </button>
                      </div>
                    ))
                  ) : (
                    <small>{workspaceT(displayLanguage, "noReferences")}</small>
                  )}
                </div>
              </div>
            ))}
            {!cards.length && (
              <EmptyState
                icon={<Highlighter />}
                text={workspaceT(displayLanguage, "noCards")}
                detail={workspaceT(displayLanguage, "noCardsHint")}
              />
            )}
          </section>
        </div>
        {activeView === "library" && selected && (
          <aside className="mobile-selection-learning-sheet" aria-label={workspaceT(displayLanguage, "selectionPanel")}>
            <SelectionLearningPanel
              aiConfigured={aiConfigured}
             
              isLookingUp={isCurrentSelectionLookingUp}
              lookup={lookup}
              selected={selected}
              onCancel={cancelLookup}
              onClear={clearSelection}
              onDictionary={() => void lookupSelection()}
              onMark={() => void markSelection()}
              onSave={() => void saveLearningCard()}
              onSemanticAnalysis={() => void lookupWithAi()}
              onRegenerateAnalysis={() => void lookupWithAi(undefined, true)}
            />
          </aside>
        )}
        </>}
      </main>
      {articleOpen && (
        <BookCreationModal
          draft={draft}
         
          isSubmitting={isImporting}
          onCancel={closeBookCreation}
          onClose={closeBookCreation}
          onDraftChange={setDraft}
          projectDefaultLanguage={defaultLearningLanguage}
          onSaveProjectDefault={(language) => void saveDefaultLearningLanguage(language)}
          onOpenPackageImport={() => {
            closeBookCreation();
            setBookContentAction({ mode: "import" });
          }}
          onSubmit={createArticle}
        />
      )}
      {bookContentAction && (
        <BookContentPackageModal
          mode={bookContentAction.mode}
          targetBook={bookContentAction.targetBook}
          onClose={() => setBookContentAction(null)}
          onImported={(articleIds) => {
            setBookContentAction(null);
            refreshBookshelf();
            void refresh().then(() => articleIds[0] ? load(articleIds[0]) : undefined);
            setNotice(`本地书籍导入完成，共 ${articleIds.length} 个章节；未调用 AI。`);
          }}
        />
      )}
      {displayLanguageOpen && (
        <DisplayLanguageModal
          language={displayLanguage}
          onClose={() => setDisplayLanguageOpen(false)}
          onSave={(language: DisplayLanguage) => void saveDisplayLanguage(language)}
        />
      )}
      {settingsOpen && (
        <SettingsModal
          activeProfileId={activeProfileId}
          analysisCacheLimit={analysisCacheLimit}
          aiProfiles={aiProfiles}
          aiProvider={aiProvider}
          aiRequest={aiRequest}
          aiTestResult={aiTestResult}
          discoveredModels={models}
          modelDraft={modelDraft}
          onActivateProfile={() => void activateAiProfile()}
          onAnalysisCacheLimitChange={(value) => {
            const nextValue = Math.max(0, Math.min(value, 2000));
            setAnalysisCacheLimit(nextValue);
            window.localStorage.setItem(ANALYSIS_CACHE_LIMIT_KEY, String(nextValue));
          }}
          onAddModel={addModel}
          onChatModelChange={(chatModel) => setAiProvider({ ...aiProvider, chatModel })}
          onClose={() => setSettingsOpen(false)}
          onCreateProfile={createAiProfile}
          onDefaultModelChange={(translationModel) => setAiProvider({ ...aiProvider, translationModel })}
          onDeleteProfile={() => setPendingAiProfileDelete(aiProvider)}
          onDiscoverModels={() => void discoverModels()}
          onDiscardAiChanges={() => {
            const savedProfile = aiProfiles.find((profile) => profile.id === aiProvider.id);
            if (savedProfile) {
              setAiProvider(savedProfile);
              setSavedModels(savedProfile.models);
            }
            setSettingsOpen(false);
          }}
          onModelDraftChange={setModelDraft}
          onProfileChange={setAiProvider}
          onSavedModelsChange={setSavedModels}
          onSaveAi={saveAiProvider}
          onSelectProfile={selectAiProfile}
          onTestAi={() => void testAiProvider()}
          savedModels={savedModels}
          settingsError={settingsError}
         
        />
      )}
      {localDictionaryOpen && <LocalDictionaryCenterModal onClose={() => setLocalDictionaryOpen(false)} />}
      {activeView === "library" && exportFormat && (
        <Suspense fallback={<DeferredFeatureLoading />}>
          <ExportOptionsModal
            options={exportOptions}
           
            onChange={setExportOptions}
            onClose={() => setExportFormat(null)}
            onConfirm={() => {
              const format = exportFormat;
              setExportFormat(null);
              if (format === "pdf") void exportPdf();
              else void exportWord();
            }}
          />
        </Suspense>
      )}
      {pendingAiProfileDelete && (
        <ConfirmDeleteModal
          title={appNoticeT(displayLanguage, "deleteProfileTitle")}
          message={<>{appNoticeT(displayLanguage, "deleteProfileMessage", { name: pendingAiProfileDelete.name || appNoticeT(displayLanguage, "unnamedProfile") })}</>}
          onClose={() => setPendingAiProfileDelete(null)}
          onConfirm={removeAiProfile}
         
        />
      )}
      {pendingCardDelete && (
        <ConfirmDeleteModal
          title={appNoticeT(displayLanguage, "deleteCardTitle")}
          message={<>{appNoticeT(displayLanguage, "deleteCardMessage", { word: pendingCardDelete.word, count: pendingCardDelete.references.length })}</>}
          onClose={() => setPendingCardDelete(null)}
          onConfirm={deleteCard}
         
        />
      )}
      {editingContext && (
        <ContextEditorModal context={editingContext} onChange={setEditingContext} onClose={() => setEditingContext(null)} onSave={saveContext} />
      )}
      {editingCard && (
        <CardEditorModal card={editingCard} onChange={setEditingCard} onClose={() => setEditingCard(null)} onSave={saveCard} />
      )}
      {activeView === "library" && article && (
        <ReaderActionDock
          article={article}
         
          onOpenLearning={() => setLearningOpen(true)}
          onExportPdf={() => setExportFormat("pdf")}
          onExportWord={() => setExportFormat("word")}
          onChapterSaved={async () => {
            await load(article.id);
            setNotice(appNoticeT(displayLanguage, "chapterUpdated"));
          }}
        />
      )}
      {assistantOpen && article && (
        <ReadingAssistantModal
          activeModel={activeModel}
          aiConfigured={aiConfigured}
          articleId={article.id}
          articleLanguage={article.language}
          articleContent={article.content}
          currentParagraph={currentParagraph}
          selected={selected}
          onClose={() => {
            setAssistantOpen(false);
            setAssistantIdentityVersion((version) => version + 1);
          }}
        />
      )}
      {activeView === "library" && article && !assistantOpen && (
        <ReaderAssistantCompanion key={assistantIdentityVersion} onOpen={() => setAssistantOpen(true)} />
      )}
      <MobileNavigation
        activeView={activeView}
        assistantAvailable={Boolean(article)}
        libraryView={mobileLibraryView}
        onOpenAssistant={() => setAssistantOpen(true)}
        onOpenReader={() => {
          setActiveView("library");
          setMobileLibraryView("reader");
        }}
        onOpenReview={() => setActiveView("vocabulary")}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenShelf={() => {
          setActiveView("library");
          setMobileLibraryView("shelf");
        }}
      />
      {chapterPhotoOpen && (
        <PhotoImportModal
          aiConfigured={aiConfigured}
          currentBookTitle={chapterBook?.title || appNoticeT(displayLanguage, "currentBook")}
          currentBookLanguage={chapterBook?.language || "en"}
         
          onClose={() => setChapterPhotoOpen(false)}
          onDraft={(photoDraft) => {
            setChapterDraft((current) => ({
              ...current,
              title: photoDraft.title || current.title,
              sourceText: photoDraft.sourceText,
              translationText: photoDraft.translationText,
            }));
            setChapterQuestionsText(
              photoDraft.questions
                .map((question, index) => `${index + 1}. ${question.prompt}\n${question.options.map((option) => option.content).join("\n")}\n${question.answer ? `答案：${question.answer}` : ""}\n${question.explanation ? `解析：${question.explanation}` : ""}`)
                .join("\n\n"),
            );
            setChapterPhotoOpen(false);
            setNotice(appNoticeT(displayLanguage, "recognitionFilled"));
          }}
        />
      )}
      {chapterBook && (
        <FloatingWindow
          title={chapterCreateT(displayLanguage, "title", { title: chapterBook.title })}
          onClose={() => {
            setChapterBook(null);
            setChapterDraft(initialChapterDraft);
          }}
        >
          <form onSubmit={createChapter} className="book-import-form">
            <p className="modal-copy">
              {chapterCreateT(displayLanguage, "hint")}
            </p>

            <div className="question-import-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setChapterPhotoOpen(true)}
              >
                {chapterCreateT(displayLanguage, "smartImport")}
              </button>
            </div>            <label>
              {chapterCreateT(displayLanguage, "chapterTitle")}
              <input
                value={chapterDraft.title}
                onChange={(event) =>
                  setChapterDraft({
                    ...chapterDraft,
                    title: event.target.value,
                  })
                }
                placeholder={chapterCreateT(displayLanguage, "chapterTitlePlaceholder")}
                required
              />
            </label>
            <div className="import-columns">
              <label>
                {chapterCreateT(displayLanguage, "sourceText")}
                <button
                  className="text-import-button"
                  type="button"
                  onClick={() => void importContentFile("source", "chapter")}
                >
                  {chapterCreateT(displayLanguage, "importContent")}
                </button>
                <textarea
                  rows={12}
                  value={chapterDraft.sourceText}
                  onChange={(event) =>
                    setChapterDraft({
                      ...chapterDraft,
                      sourceText: event.target.value,
                    })
                  }
                placeholder={chapterCreateT(displayLanguage, "sourcePlaceholder")}
                  required
                />
              </label>
              <label>
                {chapterCreateT(displayLanguage, "translationOptional")}
                <button
                  className="text-import-button"
                  type="button"
                  onClick={() =>
                    void importContentFile("translation", "chapter")
                  }
                >
                  {chapterCreateT(displayLanguage, "importContent")}
                </button>
                <textarea
                  rows={12}
                  value={chapterDraft.translationText}
                  onChange={(event) =>
                    setChapterDraft({
                      ...chapterDraft,
                      translationText: event.target.value,
                    })
                  }
                placeholder={chapterCreateT(displayLanguage, "translationPlaceholder")}
                />
              </label>
            </div>
            <label>
              {chapterCreateT(displayLanguage, "questionsOptional")}
              <button
                className="text-import-button"
                type="button"
                onClick={() => void importQuestionFile()}
              >
                {chapterCreateT(displayLanguage, "importQuestions")}
              </button>
              <textarea
                rows={7}
                value={chapterQuestionsText}
                onChange={(event) =>
                  setChapterQuestionsText(event.target.value)
                }
                placeholder={
                  chapterCreateT(displayLanguage, "questionsPlaceholder")
                }
              />
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={chapterDraft.autoTranslate}
                onChange={(event) =>
                  setChapterDraft({
                    ...chapterDraft,
                    autoTranslate: event.target.checked,
                  })
                }
              />
              {chapterCreateT(displayLanguage, "autoTranslate")}
            </label>
            <div className="form-actions">
              <button
                className="cancel-button"
                type="button"
                onClick={() => {
                  setChapterBook(null);
                  setChapterDraft(initialChapterDraft);
                }}
              >
                {t(displayLanguage, "cancel")}
              </button>
              <button className="primary-button" disabled={isImporting}>
                {isImporting ? chapterCreateT(displayLanguage, "creating") : chapterCreateT(displayLanguage, "create")}
              </button>
            </div>
          </form>
        </FloatingWindow>
      )}
    </div>
  );
}
function EmptyState({
  icon,
  text,
  detail,
}: {
  icon?: React.ReactNode;
  text: string;
  detail?: string;
}) {
  return (
    <div className="empty-state">
      {icon}
      <p>{text}</p>
      {detail && <span>{detail}</span>}
    </div>
  );
}
