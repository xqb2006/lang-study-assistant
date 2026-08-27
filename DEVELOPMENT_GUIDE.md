> 历史记录：当前开发请优先阅读 CURRENT_HANDOFF.md；本文保留过往决策，若与当前交接冲突，以当前交接为准。

# 阅读学习助手开发指南

最后更新：2026-08-02

## 项目定位

阅读学习助手是一个本地优先的英语阅读学习桌面应用。核心流程是：导入阅读材料 → 校对原文和译文 → 阅读、查词、做题 → 沉淀单词卡片和学习记录。

## 技术栈

- 前端：React + TypeScript + Vite
- 桌面容器：Tauri 2
- 本地数据：SQLite + rusqlite
- 文档处理：DOCX 文本提取、PDF 页面渲染
- AI 接口：OpenAI 兼容的视觉/聊天接口，由用户在设置中配置

## 目录职责

- `src/App.tsx`：主界面、书架、导入流程、阅读交互和设置入口。
- `src/components/BilingualArticle.tsx`：双语段落展示和原文编辑。
- `src/components/LearningWorkspace.tsx`：题目练习、提交答案和答案解析展示。
- `src/documentTools.ts`：DOCX 处理、PDF 页面渲染和导出文档。
- `src-tauri/src/lib.rs`：SQLite 数据访问、Tauri 命令、AI 请求、词典和导出。
- `src/App.css`：阅读、书架、弹窗和导出相关样式。
- `PROJECT_STATUS.md`：当前实现、验证结果和遗留问题。

## 核心数据边界

### 书籍元数据

书籍保存 `title`、`author`、`description`。作者和简介是书籍级信息，不属于章节正文；书架必须展示摘要，编辑入口必须能修改并刷新。

### 译文优先级

必须遵守以下顺序：

```text
用户提供的译文 > 文件原译文 > 手动校对译文 > AI 补译 > 空白
```

AI 只能填充空白译文，不能覆盖已有译文。没有译文时，自动补译默认关闭，由用户主动开启。

### 题目答案边界

题目数据可以保存答案和解析，但练习界面默认隐藏它们。用户提交答案后才显示正确答案、判定结果和解析。导入校对区允许编辑答案，但不能把答案直接暴露在正式做题状态。

### 单词卡片

本地词典负责词头、音标和主释义；AI 负责本句语义、整句翻译和用法提示；文章中的每次出现保存为独立语境。

## 文件识别协议

统一导入入口支持 JPG、JPEG、PNG、WEBP 和 PDF。PDF 先转换为页面图片，随后每页调用一次视觉模型并返回结构化结果：

- `documentType`：`reading`、`questions`、`mixed` 或 `unknown`；
- `title`：页面或文档标题；
- `paragraphs`：英文段落、原有译文、校对标记；
- `questions`：题干、选项、答案和解析。

识别结果必须先进入校对区，再写入书籍和章节。模型不应补写图片中不存在的内容；不确定字段要留空或标记待校对。

## 扩展规则

1. 新增 Tauri 命令时，同时更新前端类型、命令注册、浏览器回退策略和文档。
2. 修改 SQLite 表结构时，必须提供兼容旧数据库的迁移逻辑。
3. 不把 API Key、Provider URL、用户文章正文写入日志、测试快照或导出诊断包。
4. 普通界面不绑定具体模型厂商名称，使用“视觉模型”“聊天模型”“文件内容识别”等通用名称。
5. 重型功能优先使用动态导入，避免继续扩大主包体积。
6. 所有破坏性操作必须使用应用内确认弹窗，并在确认后刷新相关列表和缓存。
7. 生产交付只保留一个根目录正式 EXE，覆盖前必须确认程序已经关闭。

## 推荐创新方向

- 将识别结果拆成可编辑的页面区块，支持拖拽调整段落和题目归属。
- 增加译文对齐质量提示，帮助用户快速发现中英文段落错位。
- 增加题目标签、错题复习和间隔重复计划。
- 为单词卡片增加来源页码、复习历史和例句质量评分。
- 将 AI 任务改造成可取消、可重试、可查看进度的后台队列。
- 增加无敏感信息的诊断导出，方便定位模型失败和本地导入问题。

## 验证命令

```powershell
npm.cmd run build
cargo test --manifest-path src-tauri\Cargo.toml
npm.cmd run tauri build -- --bundles nsis
```

## 多页导入实现约定（2026-08-03）

智能文件导入在“新建章节”场景下只读取当前书籍名称，不提供书名编辑。视觉模型识别的标题仅作为章节标题建议。

识别不再按单页独立拼接：

- 单次视觉请求最多包含 8 个连续页面；
- 超过 8 页时，前端按 8 页一组、相邻组重叠 1 页的方式提交；
- 模型必须返回段落起止页码、是否承接前页/后页和译文来源；
- 前端依据跨页标记合并续段，并去除重叠页产生的重复段落和重复题目；
- 页面已有译文标记为 `document`，模型补译标记为 `ai`，没有译文标记为 `missing`。

后端命令：`recognize_import_document`。它接收带页码的图片数组，负责同一页组内的整体理解；新功能必须复用这一连续页面组识别链路。

## 安全弹窗与书籍创建约定（2026-08-03）

- 所有 `Modal` 遮罩层只阻止点击穿透，不再因点击弹窗外空白区域自动关闭。
- 删除书籍、删除章节、删除模型配置和删除单词卡片必须使用应用内确认弹窗；取消是默认安全操作。
- 删除确认必须明确说明影响范围和“删除后无法恢复”。
- “创建阅读内容”只创建书籍元数据，不自动创建或打开第一章；章节由用户在书架中按需新建。
- 数据库迁移会仅清理完全匹配的旧系统简介文案 `豆包视觉识别导入` 和 `豆包识图导入`，不会模糊匹配或改动其他用户简介。

## 导入性能、题目选词与导出约定（2026-08-03）

- 前端上传图片和 PDF 页面应在进入 React 队列前压缩，识别图最长边保持在约 1800 像素；渲染多页 PDF 时必须分页面让出事件循环，避免阻塞窗口。
- 长文档仍使用“8 页页组 + 1 页重叠”。停止识别只在当前页组返回后生效，已完成页组结果必须保留，后续识别只继续未完成页组。
- 阅读题目选词仅用于查询：本地词典接收单个英文单词，AI 接收题干与选项上下文。提交答案前不得将正确答案或解析提供给 AI 上下文。
- 导出逻辑不得调用 AI。PDF 与 Word 使用同一组选项：高亮、文章译文、题目、答案解析和当前文章标记生词；“答案与解析”必须依赖“导出题目”启用。
- 本地词典的基础释义只能写入词卡释义字段，不能写入 `contextualMeaning`。AI 解析必须使用共享的句子定位结果；只有文章段落与目标原句完全一致时，才可复用导入译文，否则保留 AI 返回的整句翻译。
- AI 深度解析需要携带目标原句、所属英文段落及已有中文译文作为参考。若目标句只是段落的一部分，模型必须只输出目标句翻译，同时沿用文章译文的术语和表达，不得复制整段译文。
- 单词卡片的归并继续使用词典原形；当前文章中的卡片标题必须显示标记时的实际词形，并按 `markings.start_index` 升序排列，而不是按创建或更新时间排列。
- PDF 与 Word 必须共用相同的导出内容开关和词卡语境数据。PDF 高亮必须传递真实范围并以背景色渲染，不能使用 `【词语】` 等文字替代；PDF 生词条目至少输出原句、整句翻译、句中释义、用法提示和学习笔记（如存在）。

## PDF 讲义排版约定（2026-08-03）

- PDF 导出采用 A4 讲义版式：正文左右边距为 20mm，避免因固定字符数换行产生右侧大面积留白。
- 英文原文优先嵌入 Georgia，依次回退 Times New Roman、Cambria；中文内容优先嵌入微软雅黑，依次回退宋体、黑体。不得把英文正文渲染为中文黑体。
- 换行必须基于字体的实际字形宽度：英文按单词边界换行，中文按字符换行；普通段落的非末行应按空白宽度两端对齐。
- 导出标题必须居中，英文原文、译文、生词和练习使用清晰层级；译文采用较小字号和缩进，避免与原文混淆。
- 每页都应保留简洁页眉和页码。新增页面时必须重新绘制页眉、页脚，且正文不得进入页眉页脚保留区。
- PDF 导出测试至少验证：文件可生成、标题/原文/译文/生词/练习文本均存在，以及高亮与词卡语境字段仍会输出。视觉排版应在具备 PDF 转图工具的环境中额外人工确认。

## 单词表导出约定（2026-08-03）

- 单词表使用当前文章已保存的单词卡片作为数据源；同一张词卡在当前文章中只导出一次，保留文章内首次标记时的实际词形和排序。
- 单词表只输出单词、音标和基础释义。基础释义优先采用用户已保存的词卡释义，其次使用本地词典释义；不得输出原句、整句翻译、AI 解析、题目或答案。
- 导出入口有两个：文章导出可在文末附加“本文单词表”；单词卡片面板可独立导出当前文章单词表。两者必须复用同一词条整理逻辑。
- PDF 单词表采用 A4 双栏紧凑排版、连续编号、细分隔线和页码；Word 使用可编辑的双栏表格。两种格式均应显示词条总数，并在没有可导出词条时给出提示而非生成空文件。

## 单词复习模块约定（2026-08-03）

- “单词复习”是与书架、工具同级的一级导航，不再把独立词表导出放在当前文章右侧词卡面板中。右侧面板只保留当前文章的快捷查看和编辑。
- 复习模块读取全部已保存词卡，支持搜索、词条表格、基础释义、语境数量和语境展开；点击语境可返回对应文章位置。
- 词卡语境排序必须使用书籍、章节、文章和标记在正文中的位置：`book_id/chapters.position/articles.position/markings.start_index`。创建时间和语境记录 ID 只能作为最终兜底排序。
- 文章附加词表与单词复习模块独立导出的 PDF/Word 必须使用相同的四列表格字段：序号、单词、音标、基础释义。

## WordNet 导入排错（2026-08-08）

### 目录选择

推荐选择：

```text
F:\英语阅读助手\词典资料\dict
```

如果错误指向 `dict\dbfiles\data.noun`，说明使用了旧版程序或旧路径逻辑；最新版本会自动回退到 `dict` 根目录。

### ACL 错误对应关系

- `fs|mkdir not allowed by ACL`：缺少 `fs:allow-mkdir`。
- `forbidden path` 指向 `com.readingagent.appresource-import-cache`：缓存路径缺少目录分隔符，应使用最新构建。
- `forbidden path` 指向 `...com.readingagent.app\resource-import-cache`：缺少 `fs:scope-applocaldata-recursive`。
- `fs|write_text_file not allowed by ACL`：缺少 `fs:allow-write-text-file`。

### 发布前检查

```powershell
Set-Location 'F:\英语阅读助手\reading-agent'
npm.cmd run build
cargo check --manifest-path src-tauri\Cargo.toml
npm.cmd run tauri build -- --bundles nsis
```

构建后用 `src-tauri\target\release\reading-agent.exe` 更新根目录唯一正式程序；若 EXE 被占用，先让用户正常退出程序，不要强制结束。

## 稳定性重构约定（2026-08-08）

- 任何应用内部缓存文件必须通过 `src/services/localFileService.ts` 写入，不要在业务模块中重复拼接 `appLocalDataDir`。
- 用户选择的原始文件保持只读；转换结果写入应用本地 `resource-import-cache`，不得写回原始目录。
- 新增本地文件功能时，必须同时覆盖路径末尾有无分隔符的测试，并确认 `default.json` 具备对应 ACL。
- 正式发布前至少运行 UI 测试、前端生产构建和 Rust 检查；WordNet 等桌面导入功能还需要真实 GUI 验收。

## WordNet 解析测试约定（2026-08-08）

- WordNet 行格式的 `w_cnt` 位于字段索引 3，使用十六进制解析。
- 词条从字段索引 4 开始，每个词条占用“单词 + lex_id”两个字段。
- 下划线必须转换为空格；没有 gloss 的行不进入资源。
- 注释行以两个空格开头，必须跳过；坏行不得导致整次导入失败。
- 修改解析器后运行 `npm.cmd run test:ui`，确保 `resourceFileConversion.test.ts` 一并通过。

## WordNet 目录预检约定（2026-08-08）

- WordNet 目录必须包含 `data.noun`、`data.verb`、`data.adj`、`data.adv` 四个主数据文件。
- `dbfiles` 不是可独立导入的根目录；可以兼容用户误选，但不得把它当作有效 WordNet 根目录。
- 导入失败提示必须说明“缺哪个文件/应该选择什么目录”，不要直接展示底层 `os error` 或 Tauri 文件路径异常。
- 修改目录候选规则时必须更新 `wordNetDirectoryCandidates` 对应测试。

## WordNet 词形映射约定（2026-08-08）

- `.exc` 中每行的第一个字段为实际词形，后续字段为一个或多个原形。
- 仅当原形已从 `data.*` 解析出释义时，才为该词形创建可查询条目。
- 词形映射只增强查词命中，不得用于覆盖词卡标记时的实际词形或替换用户原文。
- `.exc` 文件是可选增强资源，缺失时必须继续完成主数据导入。

## WordNet 大文件解析约定（2026-08-08）

- 解析大型 WordNet 文本时不得长时间同步占用浏览器主线程；应按有限行数批次让出事件循环。
- 进度回调必须按主数据文件阶段报告，不能只在导入开始和结束时显示静态文案。
- 分批解析的返回结果必须与同步解析完全一致，并有单元测试验证。

## WordNet 进度回调约定（2026-08-08）

- 批处理函数若接收进度回调，必须在每个批次后上报已处理数量，并在结束时上报完整总量。
- UI 进度应使用阶段 + 阶段内比例，避免长任务显示静态“正在处理中”。
- 进度变化不得影响解析结果；必须保留同步/分批等价性测试和进度测试。

<!-- gzip-resource-import-20260808 -->
## 单文件 gzip 资源导入约定（2026-08-08）

- 文件选择器可接受 `.gz`，但只支持“一个可直接解析的资源文件”被 gzip 压缩的情况，例如 `words.csv.gz`、`terms.tsv.gz`、`dictionary.json.gz`。
- 判断格式时必须使用 `resourceFormatForPath(path)`，不要直接以最外层 `.gz` 作为资源类型。
- 对 `csv.gz` / `tsv.gz`，解压缓存文件必须继续使用 `.csv` / `.tsv` 后缀；否则 Rust 导入端会丢失分隔符判断。
- 不要将 `.tar.gz`、`.zip` 等归档包伪装成可直接导入资源。WordNet 官方归档应先解压，再选择含 `data.noun`、`data.verb`、`data.adj`、`data.adv` 的目录。
- 新增格式时同步更新 `resourceImportExtensions`、`normalizeResourceImportFile()` 与 `resourceFileConversion.test.ts`，并运行 `npm.cmd run test:ui`、`npm.cmd run build`、`cargo check --manifest-path src-tauri\\Cargo.toml`。

<!-- word-docx-chunk-split-20260808 -->
## 文档处理依赖拆包约定（2026-08-08）

- `docx` 与 `mammoth` 必须在 `vite.config.ts` 中保持独立 `manualChunks`：前者服务 Word 导出，后者服务 Word 导入。
- 保持 `documentTools.ts` 内的动态 `import()`；不要在应用启动路径静态导入文档处理库。
- 构建体积提示应先判断依赖是否已经按需加载。单个按需依赖略高于 500 KB 时，不得只靠提高警告阈值掩盖问题。
- 修改打包分块后至少运行 UI 测试、学习题兼容测试、生产构建和 Rust 检查；发布前仍需生成 NSIS 并确认根目录正式 EXE 未被运行进程占用。

<!-- resource-center-localization-20260808 -->
## 资源中心本地化约定（2026-08-08）

- 语言资源中心的 WordNet 专用文案统一通过 `wordNetT()` 获取，不要在组件中直接写某一种自然语言的按钮、进度或错误字符串。
- 资源语言显示统一通过 `resourceLanguageLabel()` 获取；它使用 `Intl.DisplayNames`，因此不得重新引入固定中文语言名称表。
- 对不在支持表中的资源语言代码，必须传入并返回本地化的“其他语言”回退值，避免向用户显示内部代码。
- 修改 `wordNetUi.ts` 后更新 `wordNetUi.test.ts`，至少覆盖参数插值、一个非中文显示语言及未知代码回退。

<!-- resource-import-error-codes-20260808 -->
## 资源导入错误处理约定（2026-08-08）

- 对用户可恢复、可预期的资源格式问题，解析层必须抛出 `resourceImportError(code, details)`，不得直接抛出面向用户的自然语言 `Error`。
- 错误码及参数定义集中在 `resourceImportErrors.ts`；界面显示统一使用 `resourceImportErrorMessage(error, displayLanguage)`。
- `details` 仅存放安全、简短、可操作的信息，例如缺失文件名或扩展名；不得放入文章内容、API Key、完整本地路径或其他隐私数据。
- 操作系统、权限、文件占用等未知错误应原样保留给上层诊断，不得误归类为资源格式错误。

<!-- wordnet-progress-structure-20260808 -->
## WordNet 进度回调约定（2026-08-08）

- `normalizeWordNetDirectory()` 只能上报 `WordNetImportProgress` 等语义数据，解析模块不得生成任何界面自然语言文本。
- UI 层必须用 `wordNetProgressText()` 根据 `displayLanguage` 将进度数据渲染成文案。
- `completed` 允许为小数，供批处理阶段映射连续进度；`percent` 仅表示当前文件内进度，范围应为 0–100。
- 增加新进度阶段时同步更新联合类型、8 种本地化文案和 `wordNetUi.test.ts`。

<!-- batch-book-import-entry-fix-20260808 -->
## 关键弹窗入口回调约定（2026-08-08）

- 能改变应用视图或打开核心弹窗的组件回调必须是必填属性，禁止使用静默空函数作为默认值。
- 从一个同层标准弹窗跳转到另一个标准弹窗时，先关闭当前弹窗再打开目标弹窗，避免同层遮挡和点击穿透。
- 新增关键入口时应在组件测试中验证点击已委托回调；若状态在 `App.tsx`，还需保证 TypeScript 属性必填来阻止漏接。

<!-- append-batch-chapters-existing-book-20260808 -->
## 批量章节导入目标约定（2026-08-08）

- `BatchBookImportModal` 无 `targetBook` 时创建新书；有 `targetBook` 时只追加章节，禁止显示或修改书籍元数据。
- 前端调用 `import_book_chapters` 时，已有书籍必须传递 `bookId`；后端不得依据标题推断目标书籍。
- 后端追加前必须确认目标书籍存在，并以数据库中的书籍语言和最后章节位置为准，防止前端陈旧状态覆盖书籍语言或重用章节位置。
- 追加流程与新建流程共用文本、文件、图片/PDF 识别、自动拆章、译文和题目保存逻辑；只在最终保存目标上分支。
<!-- clear-stale-current-reading-20260808 -->
## 当前文章失效同步（2026-08-08）

书架数据改变后，必须同时刷新文章工作区，而不仅刷新书架显示。`useArticleWorkspace.refresh()` 负责校验当前文章 ID 是否仍存在于 `get_articles` 结果中：若不存在，应使当前加载请求失效，并清空当前文章、标记和卡片状态。

这个约束用于防止删除章节后旧阅读界面残留，也避免网络或数据库请求较晚返回时把已删除文章重新写回界面。涉及书籍或章节增删改的入口，应复用 `onLibraryChanged` 触发该同步流程。

当前回归验证：`npm.cmd run test:ui`（39/39）、`npm.cmd run test:learning`（4/4）、`npm.cmd run build`、`cargo check --manifest-path src-tauri\Cargo.toml`。
<!-- local-book-content-package-20260808 -->
## 本地书籍内容包（2026-08-08）

`.readingbook` 是版本化的 JSON 内容包，格式由 `src/features/chapters/bookContentPackage.ts` 维护。它只允许携带书籍元数据、章节原文和已保存译文，禁止加入高亮、词卡、笔记、学习进度、答题记录、词典或 AI 配置。解析未知个人字段时应忽略，而不能恢复到数据库。

书籍导入统一复用 `import_book_chapters`，必须传递 `autoTranslate: false`，确保本地电子书导入不会触发 AI。向已有书籍追加时传入 `bookId`，由后端以原书语言和最大章节位置继续写入。

导出通过 `export_book_content` 获取干净内容。为了不破坏段落对应关系，只有某章每一个原文段落都有译文时才导出该章译文；部分译文应保持为空，而不能压缩后错位匹配。

EPUB 解析在桌面前端使用 `JSZip` 与 `DOMParser` 本地完成。它应仅处理可提取文字的 EPUB；扫描件、图片和 PDF OCR 不得从本入口自动转入 AI。
<!-- unified-local-book-text-import-20260808 -->
## 统一文本书籍导入（2026-08-08）

`readLocalBookFile` 负责 TXT、Markdown、HTML、HTM 和 DOCX 的本地书籍读取；DOCX 必须复用 `documentTools.extractDocxText`，HTML 先抽取标题与段落，再交给 `splitBookText`。

`splitBookText` 仅使用可解释的标题规则：Markdown `#`、Chapter、Part、Unit、Lesson，以及中文“第 X 章/节/课”。不要为拆章调用 AI，也不要根据语义推断章节边界。无法识别标题时保留单章节。

`BookContentPackageModal` 的章节选择和改名必须在调用 `import_book_chapters` 前应用；只传递已勾选章节，并继续固定 `autoTranslate: false`。
<!-- local-pdf-import-epub-export-20260808 -->
## 文本 PDF 与 EPUB（2026-08-08）

文本 PDF 必须通过 `documentTools.extractPdfText` 在本地读取；它只处理可提取文字的 PDF，并限制在 800 页以内。内容过少时应报“可能为扫描件”的可操作错误，不能静默导入空书，也不能自动转入 AI OCR。

标准 EPUB 使用 `createEpubBytes` 生成二进制数据，再由 Tauri `writeFile` 写入文件。生成包必须保留 EPUB 3 的 `mimetype`、`META-INF/container.xml`、`OEBPS/content.opf`、导航和章节 XHTML；章节正文必须进行 XML 转义。

EPUB 导出中的译文是可选项。无论是否包含译文，都不得包含高亮、词卡、笔记、进度、答题记录、词典或 AI 配置。
<!-- local-book-import-progress-cancel-20260808 -->
## 本地书籍解析进度与取消（2026-08-08）

耗时本地解析必须通过 `LocalBookImportOptions` 传递 `onProgress` 和 `isCancelled`。EPUB 在每章开始和结束检查取消；文本 PDF 在每页开始检查取消，并每 8 页通过 `yieldToBrowser` 让出主线程。

取消解析不得调用 `import_book_chapters`，也不得清空已有导入草稿。`BookContentPackageModal` 对 `LocalBookImportCancelledError` 和 `PDF_TEXT_EXTRACTION_CANCELLED` 使用“已取消”反馈，而不是按文件损坏报错。

新增耗时格式时，应保持“本地解析 → 预览 → 用户确认 → 数据库写入”的顺序，保证取消和失败都不会产生半成品数据。
<!-- append-book-duplicate-precheck-20260808 -->
## 追加书籍重复章节预检（2026-08-08）

`preview_book_chapter_duplicates` 用于追加书籍的导入预览阶段，不是写入阶段的替代品。它基于 `chapter_duplicate_key(title, source_text)` 比对；该 key 会忽略 Unicode 空白和大小写，但要求标题与正文都相同。

前端只在存在 `targetBook` 时调用预检。返回的 `duplicateIndexes` 应默认从已选章节中移除并标记提示，但不得禁用复选框，用户应可明确选择继续导入。预检失败只给出警告，不能阻塞用户正常导入。
<!-- local-book-import-metadata-edit-20260808 -->
## 本地书籍导入前元数据编辑（2026-08-08）

`BookContentPackageModal` 在无 `targetBook` 时允许编辑 `packageDraft.book` 的 title、author、description、language。提交前必须检查 `title.trim()`；最终向 `import_book_chapters` 传递已编辑值。

追加模式必须保持元数据锁定：目标书籍的真实语言由后端读取，不能因导入包、EPUB 元数据或前端草稿而被覆盖。这个约束与批量章节追加逻辑一致。

<!-- local-book-import-language-mapping-20260808 -->
## 本地书籍导入语言自动映射（2026-08-08）

导入层统一通过 esolveImportLanguage(metadataLanguage, sourceText) 生成学习语言。EPUB 必须优先使用其语言元数据，并接受地区后缀和下划线写法，例如 en-US、r_CA；标准代码无法识别时才进入正文识别。

无元数据的 TXT、Markdown、HTML、DOCX、文本型 PDF 应根据正文调用通用语言检测。英文需要保留导入层兜底：当拉丁字母占比足够高且命中多个常见英文功能词时，返回 en，避免通用检测器对短文本或简单文本返回 other。

该能力仅用于导入预填。导入预览的用户手动选择必须覆盖自动结果；实现不得调用 AI、不得上传文本、不得消耗 Token。修改时同步维护 ookContentPackage.test.ts 的 EPUB 标签与正文回归样例。
<!-- docx-local-parser-performance-20260808 -->
## DOCX 本地正文提取（2026-08-08）

extractDocxText 必须保持离线：使用 jszip 打开 DOCX，并读取 word/document.xml。按 WordprocessingML 文档顺序提取 w:p 段落，保留 w:t 的文本、w:tab 的制表符、w:br/w:cr 的换行；缺少正文、XML 无法解析或正文为空时必须给出可读错误。

不得重新引入 mammoth 作为 Word 导入依赖。文档工具模块只允许由实际导入或导出路径动态加载，避免影响阅读器首屏。修改该逻辑时同步维护 src/documentTools.test.ts 的标准正文和异常文件回归样例。
<!-- smart-import-retry-progress-20260808 -->
## 智能导入失败重试与进度（2026-08-08）

图片/扫描 PDF 导入中，批量识别异常必须将对应页面标记为 ailed 并保留错误，不得使用空 catch 静默吞掉。用户点击单页重试后，结果必须通过统一草稿回填逻辑同步到正文、译文、题目和章节标题；只改变队列状态属于功能缺陷。

继续识别时应仅发送状态不是 done 的页面，避免重复消耗模型调用。停止识别后的进度显示必须反映实际已处理页组数。首次多页识别仍应保持现有的 8 页页组与 1 页重叠，以处理跨页正文。
<!-- bookshelf-error-retention-20260808 -->
## 书架加载失败保留（2026-08-08）

Bookshelf 获取书籍或章节失败时必须保留当前成功状态，不得用空数组覆盖；同时显示可见错误反馈。章节改名、排序、书籍保存等用户主动操作必须捕获调用失败，避免产生未处理 Promise 或让用户误以为修改已完成。

修改该流程时维护 Bookshelf.ui.test.tsx：至少验证加载失败后书架入口仍在且错误可见。删除当前阅读内容只能发生在后端删除操作成功以后。
<!-- book-import-entry-i18n-20260808 -->
## 新建书籍入口国际化（2026-08-08）

新建书籍弹窗中所有用户可见文案应通过 ookT(displayLanguage, key) 获取。新增键时必须同时补齐八种 ookMessages 语言条目，并为至少一个非中文显示语言增加 UI 回归断言。默认语言展示找不到标签时使用语言代码，不得回退为硬编码中文。
<!-- bookshelf-actions-i18n-20260808 -->
## 书架操作入口国际化（2026-08-08）

书架可见标题和操作入口必须通过 shelfT(displayLanguage, key) 获取。新增书架文案时，同时在八种语言资源中补齐 ShelfUiKey，并添加至少一条非中文 UI 回归测试；导入、导出按钮的 ria-label 与 	itle 也必须使用同一语言资源。
<!-- deleted-reading-request-invalidation-20260808 -->
## 删除后异步文章请求失效（2026-08-08）

清空当前阅读必须使用 useArticleWorkspace 的 clearCurrentArticle()。该方法递增加载请求编号、同步清空 rticleRef、文章、标记和词卡，防止先前启动的异步读取在删除完成后回写已失效内容。不得在外部直接用 setArticle(null) 代替。

修改文章加载链路时维护 useArticleWorkspace.test.ts：至少覆盖“启动加载 → 清空/删除 → 旧请求返回”的顺序，结果必须保持空阅读状态。

## 数据一致性约束（2026-08-08）
- 阅读列表的有效来源是 `books -> chapters -> articles`，不得直接查询全部 `articles`。
- 删除书籍/章节后，界面需刷新书架、文章列表并失效当前文章请求。
- 数据迁移新增 version 4，仅执行一次，清理无书籍或无有效章节关联的历史文章。
- 新增或修改阅读查询时，必须同步检查孤立记录、异步请求回写和空状态。
