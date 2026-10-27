> 历史记录：当前开发请优先阅读 CURRENT_HANDOFF.md；本文保留过往决策，若与当前交接冲突，以当前交接为准。

# 架构说明

## 命名与标识（改动前必读）

项目对外名为 **lang-study-assistant**（中文产品名仍为「阅读学习助手」），
但下列标识**必须保持不变**，改动会导致用户数据丢失或文件无法打开：

| 标识 | 当前值 | 位置 | 不能改的原因 |
| --- | --- | --- | --- |
| `identifier` | `com.readingagent.app` | `src-tauri/tauri.conf.json`、`tauri.converter.conf.json` | 决定用户数据目录 `%APPDATA%\com.readingagent.app\`。一旦改动，已安装用户的书架、词卡、复习记录会因路径变化而「消失」。 |
| 书籍包格式标识 | `reading-agent-book` | `src/features/chapters/bookContentPackage.ts` | 已导出的 `.readingbook` 文件内嵌此值，改动会导致旧文件无法导入。 |
| 备份格式标识 | `reading-agent-backup` | `src-tauri/src/migration_service.rs` | 已导出的备份包内嵌此值，改动会导致旧备份无法恢复。 |

可以随项目名调整的部分：`package.json` 的 `name`、`Cargo.toml` 的 crate 名与 `[lib] name`、
`bundle.publisher`、文档标题、GitHub 仓库名。这些不影响用户数据。

## 技术栈

- 桌面端：Tauri 2。
- 前端：React 19、TypeScript、Vite、Zustand。
- 后端：Rust、Rusqlite、Reqwest、PrintPDF。
- 数据：本地 SQLite，应用数据目录由 `paths.rs` 统一管理。

## 前端模块

`src/features/` 按业务划分：

| 模块 | 责任 |
| --- | --- |
| `chapters` | 文章工作区、书籍/章节导入、阅读布局。 |
| `cards` | 选区定位、词卡动作、AI 解析结果保存。 |
| `export` | PDF/Word、文章导出、单词表导出。 |
| `settings` | AI 模型配置工作区。 |
| `shortcuts` | 快捷键读取、校验、录制和监听。 |
| `shell` | 弹窗、确认框和覆盖层状态。 |
| `ai`、`import`、`learning`、`localDictionary` | 对应业务页面与组件。 |

`src/App.tsx` 负责页面编排和跨模块协调，不应重新吸收业务实现。

## Rust 后端模块

| 文件 | 责任 |
| --- | --- |
| `database.rs` | SQLite 连接、表结构迁移、旧数据兼容和迁移前备份。 |
| `content_library.rs` | 书籍、章节、文章、段落和导入保存。 |
| `card_service.rs` | 高亮、词卡、词卡语境、复习列表和语境译文复用。 |
| `question_service.rs` | 题目、选项、作答判定和作答记录。 |
| `local_dictionary.rs` | 语言资源元数据、ECDICT、WordNet、自定义资源、启停过滤、本地查询和英语词形规范化。 |
| `ai_config.rs` | AI 配置读写、模型配置增删改启用和兼容旧配置。 |
| `ai_client.rs` | AI 请求重试、错误处理、JSON 对象和数组解析。 |
| `ai_workflows.rs` | 模型探测、连接测试、识图、文件识别、翻译和深度解析。 |
| `pdf_export.rs` | A4 PDF、字体选择、文字排版、高亮和单词表导出。 |
| `sentence_context.rs` | 选区的句子边界定位，处理缩略词、小数和 Unicode。 |
| `paths.rs` | 应用数据目录、词典临时文件和配置路径。 |
| `lib.rs` | 模块声明、Tauri 命令注册、应用启动和回归测试。 |

## 关键业务规则

### 词卡与语境

- 词卡归并键使用词典原形，但当前文章展示标记时的实际词形。
- 当前文章的词卡和语境按正文 `markings.start_index` 排列，不能按创建时间排列。
- 本地词典仅提供基础释义，不能写入 AI 的句中释义字段。
- AI 保存语境前，若文章存在与目标原句完全匹配的人工/导入译文，必须优先复用该译文。
- 用户手动修改的语境不能被 AI 静默覆盖；必须尊重覆盖确认。

### AI 与导入

- AI 使用 OpenAI 兼容 Chat Completions 接口，配置由用户维护。
- 所有 AI 请求经过 `ai_client.rs`，保留网络重试、503/限流提示和 JSON 模式回退。
- 文件识别先形成连续的页面组结果；跨页正文需保留连接信息，不能逐页孤立处理。
- 阅读题目在提交答案前不得把正确答案或解析传入选词/AI 上下文。

### 词典与删除

- 本地词典支持在线安装和本机文件导入；自定义词典必须使用明确删除确认。
- API Key 目前遵从产品决定以明文配置保存；不要自行恢复加密 UI 或修改用户现有配置。
- 所有删除操作优先使用确认弹窗，取消为默认安全行为。

### 导出

- PDF 与 Word 必须使用同一组选项：高亮、译文、题目、答案解析、生词。
- 导出逻辑不得调用 AI。
- 单词表保持紧凑，仅输出序号、单词、音标和基础释义，不输出语境。

## 数据库兼容性

涉及 SQLite 表、字段、迁移或词卡关系时：

1. 修改 `database.rs` 的迁移逻辑，而不是假设用户数据库为空。
2. 保留旧卡片、旧高亮和已有译文；迁移不得无提示丢失用户数据。
3. 修改后必须运行 Rust 测试，并用已有数据库副本进行手工验证。

## 发布流程

1. 确认 `阅读学习助手.exe` 已关闭。
2. 在 `reading-agent` 下运行构建、测试和 NSIS 打包。
3. 用 `src-tauri\target\release\lang-study-assistant.exe` 覆盖 `F:\英语阅读助手\阅读学习助手.exe`。
4. 不要生成多个“正式版”可执行文件；根目录只保留这一份正式程序。

## WordNet 与通用资源导入

- `resourceFileConversion.ts` 负责本地格式转换和 WordNet 原始目录解析，不调用 AI，也不上传词典内容。
- WordNet 解析读取 `data.noun`、`data.verb`、`data.adj`、`data.adv`，抽取词条、英文释义和词性，去重后生成临时 CSV。
- 导入确认仍复用通用资源链路，因此资源名称、查询语言、释义语言、资源类型和启用状态保持一致。
- 临时 CSV 写入应用本地数据目录的 `resource-import-cache`，不修改用户提供的原始 WordNet 文件。
- Tauri ACL 必须同时允许应用本地数据递归作用域、目录创建和文本文件写入；仅添加 `fs:allow-mkdir` 不足以访问子目录。

## 本地文件服务

- `src/services/localFileService.ts` 是前端应用缓存文件的统一入口。
- `appResourceCachePath` 负责规范化 `AppLocalData` 路径并生成 `resource-import-cache` 子目录。
- `writeAppResourceCacheFile` 统一执行目录创建和 UTF-8 文本写入。
- 资源解析器只负责格式转换，不再直接管理缓存目录；这样可以集中处理 Tauri ACL 和路径兼容性。
## 当前程序边界（2026-08-09）

- `阅读学习助手.exe` 只负责接收 `.readingbook`、阅读学习和本地数据管理。
- `阅读内容转换器.exe` 负责所有原始材料解析、图片/扫描 PDF 识别、内容分类与阅读包导出。
- 主程序中已移除 `BatchBookImportModal`；保留 `PhotoImportModal` 仅用于当前新建单章节的图片/PDF 识别。不要重新引入整书批量/视觉导入链路。
- 需要调整转换识别时，优先修改 `ConverterApp.tsx`、`contentClassification.ts` 和 `ai_workflows.rs` 中的 `classify_import_blocks`，并更新 `CURRENT_HANDOFF.md`。
