> 历史记录：当前开发请优先阅读 CURRENT_HANDOFF.md；本文保留过往决策，若与当前交接冲突，以当前交接为准。

# 新会话交接说明

## 给下一位开发助手的首条指令

请先阅读以下文件，再开始修改代码：

```text
README.md
SESSION_HANDOFF.md
ARCHITECTURE.md
PROJECT_STATUS.md
DEVELOPMENT_GUIDE.md
```

项目根目录是：

```text
F:\英语阅读助手\reading-agent
```

## 项目目标

这是一个本地优先的英语阅读学习桌面软件。用户重视：中文界面一致性、词卡语境准确、本地词典优先、AI 只做补充、导出可打印、删除不误触、修改后立即刷新，以及唯一正式 EXE 的稳定更新。

## 当前代码状态

- 核心重构已完成；Rust 业务不再集中在 `src-tauri/src/lib.rs`。
- `lib.rs` 只处理模块装配、命令注册、应用启动和回归测试。
- 不要为了“继续重构”重新把逻辑塞回 `lib.rs`；新功能应放入对应领域模块。
- 前端业务 Hook 已在 `src/features/` 下按领域拆分。

## 必须遵守的约束

- 使用中文与用户沟通，直接执行，少重复提问。
- API Key 保持明文配置；不要改成密文显示或强制加密流程。
- UI 不要出现特定模型厂商名称，应使用通用的“AI”“模型”“智能文件导入”等表述。
- 删除书籍、章节、词卡、自定义词典等必须有确认；取消是默认安全操作。
- 本地词典的基础释义与 AI 句中释义必须分开保存。
- AI 深度解析要参考文章已有译文；只有目标原句精确匹配段落句子时才能复用该译文。
- 词卡和语境必须按文章位置而不是创建时间排序。
- 修改数据后前端应即时刷新，不应要求用户重启。

## 常用命令

```powershell
cd F:\英语阅读助手\reading-agent
npm.cmd run build
cargo test --manifest-path src-tauri\Cargo.toml
cargo check --manifest-path src-tauri\Cargo.toml
npm.cmd run tauri build -- --bundles nsis
```

## 正式程序更新

唯一正式程序是：

```text
F:\英语阅读助手\阅读学习助手.exe
```

更新前必须执行：

```powershell
Get-Process -Name '英语阅读助手' -ErrorAction SilentlyContinue
```

如果正在运行，不能强制结束，也不能覆盖。程序已关闭后，用以下文件覆盖：

```text
src-tauri\target\release\reading-agent.exe
```

## 交接时优先检查

- 有无新的用户 bug 反馈；先复现再改。
- 修改的模块是否已有对应的 Rust 回归测试。
- 是否需要同时更新 `ARCHITECTURE.md`、`PROJECT_STATUS.md` 或本文件。
- 是否执行了构建、测试和正式 EXE 更新。
## 2026-08-05 系统性稳定性修复

- 章节重命名会同步更新当前阅读标题、文章列表与书架刷新版本；书籍、章节删除/移动/修改会触发书架重新聚合，避免数量必须重启才更新。
- `Modal` 统一分为普通、优先与确认层级；确认删除弹窗使用最高层级，避免被本地词典中心等父弹窗遮挡。
- 自定义词典支持改名（保留原 ID 与词条），删除仍须输入当前词典名确认。
- 快捷键录制改为优先事件流：录制期间暂停全局快捷键、忽略输入法组合、使用 `event.code` 规范化字母/数字，避免录制触发阅读操作。
- AI 连接测试返回模型名、耗时和响应摘要；503、限流等非 JSON 兼容性错误不再额外重试普通模式，避免单次操作重复六次请求。
- API Key 输入框按当前产品策略为明文显示。

验证：`cargo check`、`cargo test`（9/9）和 `npm.cmd run build` 已通过；2026-08-05 15:11 已更新 `F:\英语阅读助手\阅读学习助手.exe`，NSIS 安装包位于 `src-tauri\target\release\bundle\nsis`。
## 2026-08-05 第二轮稳定性与性能修复

- `ConfirmDeleteModal` 会等待异步删除完成并在执行期间锁定取消/确认按钮；模型配置和单词卡片删除已接入该机制。
- 书架删除与自定义词典删除均增加执行中锁定和失败反馈，避免重复点击造成重复请求或界面状态不一致。
- Vite 使用按功能拆包：主界面、PDF、Word、图标和 React 依赖分别输出。主界面 JS 已由约 502 kB 降至约 273 kB；Word 导出依赖按需加载，仍较大但不影响首屏。
- 2026-08-05 15:21 已更新 `F:\英语阅读助手\阅读学习助手.exe`；NSIS 安装包仍位于 `src-tauri\target\release\bundle\nsis`。
## 2026-08-05 第三轮异步竞态修复

- `useArticleWorkspace` 为文章加载和文章列表刷新增加请求序号，快速切换文章时旧请求不会覆盖当前阅读内容、标记或词卡。
- 书架的书籍和章节请求在依赖变化/组件卸载后会忽略过期结果；当当前展开书籍已被删除时自动回退到有效书籍或空状态。
- 自动补译完成后仅当该章节仍为当前阅读项时才重新加载，避免用户已切换章节却被强制跳回。
- 2026-08-05 15:27 已更新 `F:\英语阅读助手\阅读学习助手.exe`。
## 2026-08-05 第四轮题目导入事务修复

- 新增后端 `save_questions` 命令：同一批题目、选项和答案在一个 SQLite 事务内保存，任一题不合法或写入失败时整批回滚。
- 章节创建时的题目文本解析、以及阅读页的题目导入面板均改为单次批量调用，避免网络/数据库异常后出现“部分保存、重试重复”的状态。
- 2026-08-05 15:36 已更新 `F:\英语阅读助手\阅读学习助手.exe`。
## 2026-08-05 第五轮练习、选词与快捷键修复

- 阅读练习使用稳定的题目/选项 ID、独立单选分组、提交锁定和请求序号；快速切换章节或重复提交不会使题目、选项和作答状态错乱。
- 题干、选项、解析中的选词入口统一命名为“词典查询”和“语境精析”。
- 语境精析会在单词选中时先执行本地词典查询，再调用 AI；最终在同一结果面板中显示并保留基础词典信息。
- “创建单词卡片”和“保存 AI 解析到语境”合并为“保存学习卡片”，会创建/合并词卡，并在有 AI 结果时保存该语境精析。
- 快捷键录制改为同步更新全局录制状态，防止快速按键被阅读快捷键抢占；录制页显示状态反馈，恢复默认使用 `Ctrl+Shift` 组合。
- 2026-08-05 16:21 已更新 `F:\英语阅读助手\阅读学习助手.exe`。
## 2026-08-05 第六轮常驻学习面板与快捷键直达

- 将“词典查询 / 语境精析”结果迁移到阅读区右侧的常驻“当前选词”面板，快捷键不再自动打开选词工具弹窗。
- 正文选词、阅读操作栏、全局快捷键、练习题选词均会自动展开右侧面板并写入同一份选择与查询结果。
- 右侧面板展示词典基础释义、AI 本句义、整句翻译、用法提示；单一“保存学习卡片”入口仍遵循本地词典优先、AI 只补充语境的规则。
- 练习题选词保持仅查询限制，界面不会提供高亮或保存词卡，避免将题目文本误写入正文卡片。
- 移除了不再使用的“选词工具”模态框状态与调用链，减少重复 UI 与快捷键弹窗干扰。
- 验证：`npm.cmd run build`、`cargo check --manifest-path src-tauri\\Cargo.toml`、`cargo test --manifest-path src-tauri\\Cargo.toml` 全部通过；Rust 9/9 测试通过。
## 2026-08-05 第七轮快捷键录制稳定性修复

- 根因：快捷键设置页在非阅读视图中有一个依赖 `cancelRecording` 的副作用；该回调此前每次渲染都会重新创建，点击“录制”后的状态更新会触发副作用并立即取消录制。
- 修复：`cancelRecording` 改为稳定回调，只有实际在录制时才修改状态；设置页面不再因正常渲染取消录制。
- 交互调整：再次点击同一项“录制”会继续保持录制状态，不再作为取消操作；新增明确的“取消录制”按钮，`Esc` 仍可取消。
- 验证：`npm.cmd run build`、`cargo check --manifest-path src-tauri\\Cargo.toml`、`cargo test --manifest-path src-tauri\\Cargo.toml` 全部通过；Rust 9/9 测试通过。
## 2026-08-05 第八轮学习卡片保存修复

- 修复“仅高亮”后再保存学习卡片被 `This text is already marked` 阻断的问题：已有高亮会直接复用，再创建或合并对应词卡。
- 保存流程改为逐步确认：词卡创建失败时不再继续保存 AI 语境，也不会清空当前选词和查询结果；用户可修正后直接重试。
- AI 语境保存失败时同样保留当前内容，并提示“词卡尚未保存成功，请检查当前选词后重试”。
- 保存按钮在查询进行中禁用，避免未完成查询时出现并发保存。
- 验证：`npm.cmd run build`、`cargo check --manifest-path src-tauri\\Cargo.toml`、`cargo test --manifest-path src-tauri\\Cargo.toml` 全部通过；Rust 9/9 测试通过。
## 2026-08-05 第九轮选词入口精简与小屏适配

- 移除了阅读标题区和悬浮操作栏中重复的“选词工具”按钮，避免用户误以为仍存在旧弹窗流程。
- 正文划词后自动更新当前选词、清空旧查询结果并展开右侧学习面板；词典查询、语境精析和保存卡片均从该面板完成。
- 当窗口宽度不超过 1120px 时，右侧面板不可见；已新增固定底部的当前选词学习面板，确保小屏/窄窗口仍可完成查询和保存。
- 验证：`npm.cmd run build`、`cargo check --manifest-path src-tauri\\Cargo.toml`、`cargo test --manifest-path src-tauri\\Cargo.toml` 全部通过；Rust 9/9 测试通过。
## 2026-08-05 第十轮阅读练习稳定性修复

- 修复全局 `article` 正文排版规则污染阅读练习题卡的问题；正文排版规则已限制在 `.reader article` 内，练习卡、题目导入卡等不再继承正文的字号、字体、宽度和边距。
- 阅读练习的作答状态改为按 `question.id + option.id` 保存，不再使用选项文字作为状态键，避免重复文本或重新加载时的选项错位。
- 选项补充了独立的卡片样式、已选状态、提交禁用状态和正确/错误结果状态；题目按钮不会再与选项布局互相影响。
- 结果区域将正确答案显示为实际选项文本，而不是仅显示 A/B/C/D 标签。
- 验证：`npm.cmd run build`、`cargo check --manifest-path src-tauri\\Cargo.toml`、`cargo test --manifest-path src-tauri\\Cargo.toml` 全部通过；Rust 9/9 测试通过。
## 2026-08-05 第十一轮阅读练习单选控件可见性修复

- 根因确认：阅读学习工作区运行在 `.backdrop` 弹窗中，通用 `.backdrop input` 规则给所有输入框设置了 `width: 100%`、内边距、边框与背景，导致 `radio` 被错误渲染为普通输入框，选择圆点不可见。
- 修复：为 `.backdrop .question-option input[type="radio"]` 显式重置尺寸、内边距、外观、边框、背景和焦点样式，使用稳定的圆形单选控件；选中时显示明确的紫色实心圆点。
- 每个选项新增 A/B/C/D 标识，整行均可点击选择，避免用户找不到可选择位置。
- 验证：`npm.cmd run build`、`cargo check --manifest-path src-tauri\\Cargo.toml`、`cargo test --manifest-path src-tauri\\Cargo.toml` 全部通过；Rust 9/9 测试通过。
## 2026-08-05 第十二轮历史阅读题目选项兼容

- 根据实际界面截图确认：部分历史题目的 `question_options` 为空，A/B/C/D 选项仍嵌在 `questions.prompt` 题干文本中，因此页面没有选项可渲染；这不是单选控件本身的可见性问题。
- `LearningWorkspace` 现会自动识别并拆分题干中的 `A) / B) / C) / D)`（兼容至 H），将其渲染为独立可点击选项；不需要重新导入文章或题目。
- 对历史内嵌选项，提交时使用其字母标签进行判题，保持与旧数据库中答案字段的兼容；题干、正确答案显示和题目选词均使用拆分后的内容。
- 验证：`npm.cmd run build`、`cargo check --manifest-path src-tauri\\Cargo.toml`、`cargo test --manifest-path src-tauri\\Cargo.toml` 全部通过；Rust 9/9 测试通过。
## 2026-08-05 第十三轮稳定性基础建设（进行中）

- 后端新增历史题目自动迁移：读取章节题目时，会识别题干内嵌的 `A) / B) / C) / D)` 选项并写入 `question_options`，同时清理题干为纯题目文本；前端保留兼容兜底。
- 新增 Rust 回归测试覆盖内嵌选择题解析与非选择题排除，当前 Rust 测试数量从 9 增至 11。
- 前端将题目兼容解析抽离为 `src/features/learning/questionCompatibility.ts`，降低 `LearningWorkspace` 的数据兼容职责。
- 新增“版本与诊断”页面及 `get_app_diagnostics` 命令：可查看程序版本、书籍/章节/词卡/题目数量和仍待规范的旧题数量。
- 当前构建与测试通过；因正式程序仍在运行，尚未覆盖发布。
## 2026-08-05 第十三轮稳定性基础建设（完成）

- 历史阅读题会在首次读取时自动把题干中内嵌的 `A) / B) / C) / D)` 选项迁移到 `question_options`，前端仍保留兼容兜底；用户无需重新导入原有文章或题目。
- 阅读练习的请求、作答、状态清理和过期请求隔离已移入 `src/features/learning/useLearningSession.ts`；界面组件仅负责渲染、选择与选词交互，快速切换章节时旧请求不会覆盖新章节结果。
- 新增 `npm.cmd run test:learning`，覆盖结构化选项、旧题内嵌选项、普通文本排除、中文顿号选项及旧题答案提交格式，共 4 条回归测试。
- 修复诊断页后端命令未注册的问题；“版本与诊断”现在可读取书籍、章节、词卡、题目及待迁移旧题数量。
- 正式版本升级为 `0.1.1`；验证通过：学习兼容测试 4/4、前端构建、Rust 编译和 Rust 测试 11/11。
- 待执行：在正式程序未运行时构建 NSIS 安装包并覆盖唯一发布文件 `F:\英语阅读助手\阅读学习助手.exe`。
### 2026-08-05 发布记录

- 已生成并覆盖唯一正式程序：`F:\英语阅读助手\阅读学习助手.exe`（`v0.1.1`）。
- 已生成 NSIS 安装包：`src-tauri\target\release\bundle\nsis\阅读学习助手_0.1.1_x64-setup.exe`。
- 构建提示：Word 导出按需块仍超过 500 kB，属于后续首屏性能优化项；Tauri 标识符以 `.app` 结尾仅影响 macOS 命名建议，不影响当前 Windows 程序。
### 2026-08-05 组件回归测试补充

- 新增 Vitest + Testing Library 开发期测试环境与 `npm.cmd run test:ui`。
- `LearningWorkspace` 组件回归覆盖：历史内嵌选项渲染与字母提交、结构化选项文本提交、无选项禁用提示、快速切换章节时忽略过期请求，共 4/4 通过。
- 这次仅新增测试与开发依赖，未改动已发布的运行时代码；根目录 `F:\英语阅读助手\阅读学习助手.exe` 保持为已发布的 `v0.1.1` 正式程序。
## 2026-08-05 第十四轮阅读选词工作区拆分

- 新增 `src/features/cards/useReaderSelectionWorkspace.ts`：集中管理正文选词、清空选词、词典/AI 查询、学习卡片操作和阅读快捷键协调。
- `App.tsx` 不再直接持有 `selected`、`lookup`、`isLookingUp` 及全局阅读快捷键编排；桌面右侧和窄窗口底部面板共用同一个清空与查询流程，减少状态分叉。
- 新增 `src/features/cards/useReaderSelectionWorkspace.ui.test.tsx`，覆盖正文选词后的快捷键复用、无选词提示、清空选词状态；组件 UI 回归测试总计 7/7 通过。
- 验证：学习兼容测试 4/4、Vitest UI 测试 7/7、`npm.cmd run build`、`cargo check`、`cargo test`（11/11）全部通过。
- 已重新构建并覆盖 `F:\英语阅读助手\阅读学习助手.exe`；NSIS 安装包已同步更新为 `src-tauri\target\release\bundle\nsis\阅读学习助手_0.1.1_x64-setup.exe`。
## 2026-08-05 第十五轮应用壳层拆分

- 新增 `src/features/shell/AppSidebar.tsx`，将书架、单词复习、工具、偏好导航及状态计数从 `App.tsx` 拆出；界面结构、文案和入口保持不变。
- 共享 `ShellView` 类型由侧边栏模块提供，页面层只保留当前视图状态和对应的业务回调。
- 新增 `src/features/shell/AppSidebar.ui.test.tsx`，覆盖活动导航、高亮状态、数据计数和各按钮的回调委托；UI 回归测试总计 9/9 通过。
- 验证：学习兼容测试 4/4、UI 测试 9/9、`npm.cmd run build`、`cargo test`（11/11）全部通过。
- 已重新构建并覆盖 `F:\英语阅读助手\阅读学习助手.exe`；NSIS 安装包同步位于 `src-tauri\target\release\bundle\nsis\阅读学习助手_0.1.1_x64-setup.exe`。
## 2026-08-05 第十六轮书籍创建弹窗拆分

- 新增 `src/features/chapters/BookCreationModal.tsx`，将“创建阅读内容 / 新建书籍”表单从 `App.tsx` 抽离，保留书名、作者、简介、提交中状态及所有现有文案。
- `BookDraft` 作为明确类型导出，避免创建弹窗与导入钩子之间依赖对象推断；右上角关闭仍会重置草稿，取消仍仅关闭弹窗。
- 新增 `src/features/chapters/BookCreationModal.ui.test.tsx`，覆盖字段更新、提交/关闭/取消回调以及提交中禁用状态；UI 回归测试总计 11/11 通过。
- 验证：学习兼容测试 4/4、UI 测试 11/11、`npm.cmd run build`、`cargo check`、`cargo test`（11/11）全部通过。
- 已重新构建并覆盖 `F:\英语阅读助手\阅读学习助手.exe`；NSIS 安装包同步位于 `src-tauri\target\release\bundle\nsis\阅读学习助手_0.1.1_x64-setup.exe`。
## 2026-08-05 第十七轮翻译与 AI 设置拆分

- 新增 `src/features/settings/SettingsModal.tsx`，从 `App.tsx` 抽离设置弹窗，并集中管理 AI 配置档案、URL/Key、模型获取、连接测试、模型删除与保存流程。
- 设置弹窗内部保持原有两类关闭语义：右上角仅关闭；AI 表单“关闭”会恢复已保存的当前配置后关闭。
- 新增 `src/features/settings/SettingsModal.ui.test.tsx`，覆盖词典和 AI 字段回调、右上角关闭、放弃 AI 草稿入口；UI 回归测试总计 13/13 通过。
- 验证：学习兼容测试 4/4、UI 测试 13/13、`npm.cmd run build`、`cargo check`、`cargo test`（11/11）全部通过。
- 已重新构建并覆盖 `F:\英语阅读助手\阅读学习助手.exe`；NSIS 安装包同步位于 `src-tauri\target\release\bundle\nsis\阅读学习助手_0.1.1_x64-setup.exe`。
## 2026-08-06 精简清理：移除有道与浏览器降级层

- 已彻底删除有道在线词典：前端凭据表单、后端 `online_dictionary.rs`、Tauri 命令注册以及仅供其使用的 `sha2` 依赖均已移除；基础释义统一由用户导入的本地语言资源提供。
- 已删除浏览器 `localStorage` 降级实现 `src/browserStorage.ts`。非桌面环境现在会明确提示使用 `阅读学习助手.exe`，不再提供功能不完整的伪预览模式。
- 已移除没有前端调用的旧命令：`save_article`、`delete_article`、`import_book`、`import_book_chapters`、`recognize_import_image`、`recognize_reading_image`，同时保留 `recognize_import_document`、题目识别、本地词典与所有 SQLite 数据迁移兼容逻辑。
- 删除未接入的 `ChapterCreationModal` 临时组件和测试，避免形成死代码。
- 验证基线：`npm.cmd run build`、`cargo check --manifest-path src-tauri\Cargo.toml`、`cargo test --manifest-path src-tauri\Cargo.toml`（11/11）和 `npm.cmd run test:ui`。
## 2026-08-06 第二轮精简：依赖、权限与旧单项命令

- 已移除无前端调用的旧单项写入命令：`save_chapter`、`save_paragraph`、`save_question`；章节创建、章节批量编辑和题目批量保存分别继续使用 `create_chapter`、`save_article_paragraphs`、`save_questions`。
- 已移除未使用的 `tauri-plugin-opener` 依赖、启动注册和 `opener:default` 权限，缩小桌面端权限与依赖面。
- 已从前端依赖中移除未使用的 `jspdf`、`jspdf-autotable`、`zustand`；`mammoth` 经构建验证仍用于 Word 文本导入，已保留。
- 已清理 Vite 中对旧 PDF 库的手动分包配置，PDF 导出继续走 Rust `printpdf`，PDF 读取继续使用 `pdfjs-dist`。
- 验证：`npm.cmd run build`、`cargo check --manifest-path src-tauri\\Cargo.toml`、`cargo test --manifest-path src-tauri\\Cargo.toml`（11/11）和 `npm.cmd run test:ui`（13/13）全部通过。
## 2026-08-06 语言资源中心第一阶段

- “本地词典中心”已改为“语言资源中心”：当前统一通过本机导入创建用户资源，可标注语言（英语、日语、韩语、法语、德语、西班牙语、其他）和类型（词典、词表、术语表、例句资源）。
- `dictionary_packages` 增加兼容字段：`language`、`resource_type`、`enabled`、`priority`。已有自定义词典自动迁移为“英语 / 词典 / 已启用”，不会要求重新导入。
- 自定义资源支持按语言分组展示、改名、删除确认和启用/停用。当前词典查询仍是英语专用：仅查询已启用、语言为 `en` 的自定义资源，以免将英语词形还原错误应用于其他语言。
- 后续跨语言阅读需要单独接入文章语言识别、分词、词形还原/变位规则与对应查询路由；在完成这些能力前，非英语资源只负责安全管理和保存，不会伪装为已可查词。
## 2026-08-06 多语言阅读与资源查询第一阶段

- 阅读内容现在有明确语言：数据库为 `books.language` 与 `articles.language` 增加了兼容迁移；所有已有书籍、章节默认迁移为英语（`en`），不需要重新导入。
- 新建书籍时可选择英语、日语、韩语、法语、德语、西班牙语或其他语言；新建章节自动继承所属书籍的语言。书架编辑书籍时也可修改语言，已存在章节会同步更新。
- 选词本地查询和创建词卡时会读取当前文章语言，只查询对应语言且已启用的自定义资源；非英语查询使用精确匹配，不会错误套用英语词形还原。
- 英语保留基础的复数、时态、词形变化候选匹配；日语保留常见助词和词尾候选；其他语言以原词精确查询为主，后续应按语言逐步接入 `LanguageProcessor`。
- 新增共享语言定义：`src/features/languages.ts`；关键后端逻辑位于 `src-tauri/src/content_library.rs`、`src-tauri/src/local_dictionary.rs`、`src-tauri/src/card_service.rs`。
- 验证：`npm.cmd run build`、`cargo test --manifest-path src-tauri\\Cargo.toml`（11/11）及 `npm.cmd run test:ui`（13/13）均通过。
## 2026-08-06 多语言第二阶段：导入识别与 AI 语言路由

- 新增 `src/features/languages.ts` 的轻量本地语言检测：日语假名、韩文字符和高置信英语可自动识别；拉丁语系无法可靠区分时明确标为“其他语言”，要求用户在书籍设置中确认，不会误判为英语。
- 智能文件导入在完成识别后会显示正文语言与检测依据；若识别语言与当前书籍语言不同，会提示用户先校对，并在书架中修改书籍语言。导入结果仍必须由用户确认后才写入章节。
- AI 图片导入、缺失段落补译和语境精析均改为按文章语言生成提示词，不再硬编码英语。文章已有中文译文仍优先作为整句翻译依据。
- 非英语本地查询允许查询词语或短语，使用当前语言已启用自定义资源的精确匹配；英语继续保留单词词形还原策略。
- 统一把“英文原文”等界面文案改为“正文原文”，避免把多语言内容误标为英语。
- 验证：`npm.cmd run build`、`cargo test --manifest-path src-tauri\\Cargo.toml`（11/11）及 `npm.cmd run test:ui`（13/13）均通过。
## 2026-08-06 多语言第三阶段：项目默认语言与书籍编辑

- 新增持久化项目偏好 `app_preferences`，保存 `default_learning_language`。项目默认学习语言会作为“新建书籍”的初始语言；每本书仍可独立覆盖，避免同一项目中不同语言材料互相影响。
- 新建书籍弹窗显示当前项目默认语言，并提供“设为项目默认”操作；保存后后续新建书籍立即使用新默认值。
- 书架的书籍编辑已从连续 `prompt` 输入改为正式编辑弹窗，支持一次性修改书名、阅读语言、作者与简介，并对异步保存失败显示明确提示。修改语言会同步更新本书既有章节的查询和 AI 语言路由。
- 日语本地资源查询新增安全候选预处理：保留原词，并尝试去除常见助词、将部分礼貌体/进行体映射为可查询候选。该规则只作为候选补充，不会覆盖原词或伪装成完整日语形态分析。
- 验证：`npm.cmd run build`、`cargo test --manifest-path src-tauri\\Cargo.toml`（11/11）和 `npm.cmd run test:ui`（13/13）通过；已重新构建根目录唯一正式 EXE。
## 2026-08-06 界面显示语言基础架构

- 项目偏好新增 `display_language`，可保存并恢复 8 种界面显示语言：简体中文、繁体中文、英语、日语、韩语、法语、德语、西班牙语；非法或历史值安全回退为简体中文。
- 新增 `src/i18n/ui.ts` 作为可扩展语言包入口，未翻译键统一回退简体中文，避免界面出现空白、键名或乱码。
- 左侧“偏好”区域新增“界面语言”入口；选择后立即保存并切换侧边导航等核心壳层文案。界面显示语言与项目默认学习语言、书籍学习语言相互独立。
- 当前轮完成的是国际化底座与核心导航；阅读器、导出、词卡、AI 设置等历史页面仍保留简体中文回退，后续应以同一语言包逐页迁移，而不是继续散落硬编码文案。
- 验证：`npm.cmd run build`、`npm.cmd run test:ui`（13/13）与 `cargo test --manifest-path src-tauri\\Cargo.toml`（11/11）均通过。
## 2026-08-06 界面国际化第二轮：书籍工作流

- `src/i18n/ui.ts` 增加书籍工作流语言包，覆盖简体中文、繁体中文、英语、日语、韩语、法语、德语、西班牙语。
- 新建书籍与编辑书籍弹窗已迁移：标题、书名、学习语言、作者、简介、项目默认语言、保存/取消、进行中状态、校验错误和说明文字均随界面显示语言切换。
- 书架会将当前显示语言传递给编辑弹窗；新建书籍弹窗由 `App.tsx` 传入当前显示语言，保留原有项目默认学习语言逻辑。
- 验证：`npm.cmd run build`、`npm.cmd run test:ui`（13/13）和 `cargo test --manifest-path src-tauri\\Cargo.toml`（11/11）通过。
## 2026-08-06 界面国际化第三轮：阅读工作区高频操作

- `src/i18n/ui.ts` 新增阅读工作区语言包，覆盖编辑章节、学习模式、导出 PDF/Word、当前选词、词典查询、语境精析、高亮、取消查询、保存学习卡片和导出选项等高频文案。
- `ReaderActionDock`、`SelectionLearningPanel`、`ExportOptionsModal` 已接入当前界面显示语言；移动端选词面板和桌面端选词面板共用同一套语言键。
- 详细词典释义、文章原文、中文译文和 AI 生成内容保持原始内容，不会被界面语言错误翻译。
- 验证：`npm.cmd run build`、`npm.cmd run test:ui`（13/13）和 `cargo test --manifest-path src-tauri\\Cargo.toml`（11/11）均通过。

## 2026-08-06：界面国际化第四轮（AI 配置、阅读练习、单词复习）

### 本轮完成
- `src/i18n/ui.ts` 增加 AI 配置、阅读练习与单词复习的独立文案域：`settingsT`、`learningT`、`vocabularyT`。
- `SettingsModal`、`AiModelEditor`、`AiProfileControls` 已接收并使用 `displayLanguage`，覆盖配置名称、模型操作、测试状态及连接反馈。
- `LearningWorkspace` 已支持界面语言切换，覆盖题目数量、作答、结果、选词查询和无选项提示；题干、选项、解析等学习数据保持原文。
- `VocabularyReview` 已支持界面语言切换，覆盖导出、搜索、空状态、表头与语境信息；词卡原文和释义保持不被 UI 翻译层改写。
- `App.tsx` 已将项目显示语言传递至上述页面与阅读练习弹窗标题。

### 兼容与验证
- 保持 `zh-CN` 默认值，既有调用与测试无需改造。
- 修复了 PowerShell 写入非 ASCII 文案时的编码风险；本轮新增源码均为 UTF-8 无 BOM。
- 已通过：`npm.cmd run build`、`npm.cmd run test:ui`（13/13）、`cargo test --manifest-path src-tauri\Cargo.toml`（11/11）。

### 后续国际化顺序
1. 语言资源中心与导入识别页面。
2. 快捷键、诊断与词卡编辑弹窗。
3. 继续补齐日语、韩语、法语、德语、西班牙语在新增页面的专业本地化文案；当前英文回退可安全使用。


### 发布产物（2026-08-06 15:35）
- NSIS 安装包：`src-tauri/target/release/bundle/nsis/阅读学习助手_0.1.1_x64-setup.exe`。
- 根目录唯一正式程序：`F:/英语阅读助手/阅读学习助手.exe`，已由 `src-tauri/target/release/reading-agent.exe` 覆盖，大小 `19,057,664` bytes。
- 注意：根目录不放安装包；安装包仅保留在构建输出目录。


## 2026-08-06：界面国际化第五轮（语言资源与智能导入）

### 本轮完成
- `src/i18n/ui.ts` 新增 `resourceT` 与 `importT` 两个文案域，集中处理语言资源管理和智能导入界面的显示文案与插值。
- 语言资源中心、基础词典与扩展释义安装状态、自定义资源的语言/类型、启停、改名、删除确认已接收 `displayLanguage`。
- 智能文件导入主弹窗、文件队列、识别控制、校对区域已接收 `displayLanguage`，覆盖文件状态、进度、页面操作、校对和确认导入操作。
- 阅读题导入面板已接收 `displayLanguage`，覆盖文件导入、图片识别、粘贴识别、题目校对和保存操作。
- 保持识别出的文章、题干、选项、解析、译文和服务返回错误为原始学习数据，不通过 UI 翻译层改写。

### 验证
- 已通过 `npm.cmd run build`。
- 已通过 `npm.cmd run test:ui`（13/13）。
- 已通过 `cargo test --manifest-path src-tauri\Cargo.toml`（11/11）。

### 后续国际化顺序
1. 快捷键、诊断与词卡编辑弹窗。
2. 细化资源安装、识别过程中的运行时成功/失败提示。
3. 补齐日语、韩语、法语、德语、西班牙语在新迁移页面的专业本地化；当前安全回退为英文。


## 2026-08-06：界面国际化第六轮（快捷键、诊断、词卡编辑）

### 本轮完成
- `src/i18n/ui.ts` 新增 `preferenceT` 与 `cardEditorT`，覆盖偏好设置、诊断和词卡编辑界面的独立文案。
- `ShortcutSettingsPage` 已接收 `displayLanguage`，覆盖录制说明、表格标题、操作状态与快捷键用途。
- `DiagnosticsPage` 已接收 `displayLanguage`，覆盖刷新、数据指标、旧题规范提示与错误前缀。
- `CardEditorModal`、`ContextEditorModal` 已接收 `displayLanguage`，覆盖语境解析、整句译文、词卡字段和保存操作。
- `App.tsx` 已将项目显示语言传递至以上页面和弹窗。

### 验证
- 已通过 `npm.cmd run build`。
- 已通过 `npm.cmd run test:ui`（13/13）。
- 已通过 `cargo test --manifest-path src-tauri\Cargo.toml`（11/11）。

### 后续
- 当前高频设置、导入、资源、阅读和词卡编辑页面均具备界面语言入口。
- 后续优先补齐更细粒度的运行时成功/失败提示，以及日语、韩语、法语、德语、西班牙语在新增页面的专业本地化；目前安全回退为英文。


## 2026-08-06：界面国际化第七轮（书架、章节编辑、阅读正文）

### 本轮完成
- `src/i18n/ui.ts` 新增 `chapterT`、`shelfT`、`articleT`，覆盖章节编辑、书架和阅读正文状态的集中翻译与插值。
- `ChapterEditorModal` 现按界面语言显示加载/保存反馈、段落表头、正文与译文字段、AI 补译占位提示。
- `Bookshelf` 现按界面语言显示书籍与章节操作、空状态、作者/章节信息、删除警告及删除失败提示。
- `BilingualArticle` 现按界面语言显示高亮提示、待补译状态和未导入译文状态。
- `ReaderActionDock` 会将当前显示语言传入章节编辑器；通用 `ConfirmDeleteModal` 已支持语言参数的取消按钮。

### 验证
- 已通过 `npm.cmd run build`。
- 已通过 `npm.cmd run test:ui`（13/13）。
- 已通过 `cargo test --manifest-path src-tauri\Cargo.toml`（11/11）。

### 后续
- 剩余硬编码主要是 `App.tsx` 中的阅读页标题、通知文本及少量本地资源/导入的运行时成功与失败提示。
- 后续优先将这些应用级状态消息纳入统一的界面文案域，再补齐各非中文显示语言的专业本地化。


## 2026-08-06：界面国际化第八轮（应用级阅读与通知）

### 本轮完成
- `src/i18n/ui.ts` 新增 `workspaceT` 与 `appNoticeT`，统一处理阅读工作区、单词卡片区、删除确认和应用级通知。
- `App.tsx` 的工具栏、搜索、当前阅读摘要、阅读空状态、词卡侧栏、语境字段、卡片操作及移动端选词面板已按 `displayLanguage` 显示。
- AI 模型配置删除和单词卡片删除确认已使用本地化标题与动态消息。
- 章节保存、智能识别填入和阅读题空状态等应用级高频通知已迁移。

### 验证
- 已通过 `npm.cmd run build`。
- 已通过 `npm.cmd run test:ui`（13/13）。
- 已通过 `cargo test --manifest-path src-tauri\Cargo.toml`（11/11）。

### 后续
- 剩余应用级硬编码主要集中在“新建章节”表单与少量智能识别过程提示。
- 后续可将该表单迁移为独立组件，并补齐日语、韩语、法语、德语、西班牙语的专业本地化词条；当前仍安全回退为英文。

## 2026-08-06：界面国际化第九轮（新建章节与导入运行时提示）

- 新建章节表单已接入 `chapterCreateT`：覆盖标题、正文、译文、题目、智能文件导入、自动补译、创建/取消等文案；题目示例中的换行已统一使用安全转义，避免 TypeScript 字符串中断。
- 智能文件导入与题目导入的运行时反馈已接入 `importRuntimeT`：包含文件读取、桌面端限制、图片处理、连续页识别进度、AI 配置提示、题目解析、保存和错误反馈。
- 当前语言覆盖继续采用“核心语言完整翻译、其余显示语言安全回退英文”的策略，避免出现空白或损坏文案。

### 验证
- 已通过 `npm.cmd run build`。
- 已通过 `npm.cmd run test:ui`（13/13）。
- 已通过 `cargo test --manifest-path src-tauri\\Cargo.toml`（11/11）。

### 后续
- 仍可继续统一通用 `Modal` 的关闭标签、少量本地资源运行时提示，并逐步补齐日语、韩语、法语、德语、西班牙语的专业翻译。
## 2026-08-07：界面国际化第十轮（语言资源运行时反馈）

- 语言资源中心的安装、导入、状态刷新、改名、启停与删除反馈已接入 `resourceT`，不再在该流程中直接输出固定中文提示。
- 自定义资源名称的导入/改名提示与默认名称已支持当前显示语言；本机桌面端限制与导入准备进度也已统一处理。
- 通用 `Modal` 新增可选 `closeLabel`，资源中心会传入当前语言的关闭标签；为保持现有中文页面和既有测试兼容，未传入时仍默认“关闭”。

### 验证
- 已通过 `npm.cmd run build`。
- 已通过 `npm.cmd run test:ui`（13/13）。
- 已通过 `cargo test --manifest-path src-tauri\\Cargo.toml`（11/11）。

### 后续
- 剩余工作以专业翻译完善为主：逐步补齐日语、韩语、法语、德语、西班牙语的非核心页面文案，并继续按页面传入 `Modal.closeLabel`。
## 2026-08-07：界面国际化第十一轮（语言资源中心专业翻译）

- 补齐语言资源中心在日语、韩语、法语、德语、西班牙语下的主要页面文案，不再整页回退英文。
- 覆盖资源名称、词典说明、安装/导入动作、资源类型、启停状态、删除确认、错误反馈和动态数量占位符。
- 保留英文作为未覆盖字段的安全回退，避免新增语言键缺失时出现空白。

### 验证
- 已通过 `npm.cmd run build`。
- 已通过 `npm.cmd run test:ui`（13/13）。
- 已通过 `cargo test --manifest-path src-tauri\\Cargo.toml`（11/11）。
## 2026-08-07：界面国际化第十二轮（导入运行时提示）

- 智能文件导入与阅读题导入的运行时提示已补齐日语、韩语、法语、德语、西班牙语。
- 覆盖桌面端限制、PDF 读取、页面加入、图片旋转/裁剪、连续页组识别、停止与完成、正文校对、题目文件/图片识别、题目保存及错误反馈。
- 动态占位符（页码、页组、段落数、题目数、错误信息）保持与英文键一致，避免切换显示语言后数据缺失。

### 验证
- 已通过 `npm.cmd run build`。
- 已通过 `npm.cmd run test:ui`（13/13）。
- 已通过 `cargo test --manifest-path src-tauri\\Cargo.toml`（11/11）。
## 2026-08-07：界面国际化第十三轮（新建章节表单）

- 新建章节表单已补齐日语、韩语、法语、德语、西班牙语文案。
- 覆盖章节标题、正文导入、译文、阅读题、智能导入、自动补译、创建状态及示例占位符。
- 修复本轮示例题目换行转义问题，避免语言包生成实际换行导致 TypeScript 语法错误。

### 验证
- 已通过 `npm.cmd run build`。
- 已通过 `npm.cmd run test:ui`（13/13）。
- 已通过 `cargo test --manifest-path src-tauri\\Cargo.toml`（11/11）。
## 2026-08-07：界面国际化第十四轮（阅读练习与单词复习）

- 补齐阅读练习页面的日语、韩语、法语、德语、西班牙语文案。
- 覆盖题目数量、选项选择、提交状态、正误反馈、正确答案、原文定位与选词定位失败提示。
- 补齐单词复习页面的五语文案，覆盖检索、加载/空状态、导出、音标、释义与按文章位置排序的语境行。

### 验证
- 已通过 `npm.cmd run build`。
- 已通过 `npm.cmd run test:ui`（13/13）。
- 已通过 `cargo test --manifest-path src-tauri\\Cargo.toml`（11/11）。
## 2026-08-07：界面国际化第十五轮（阅读工作区与通知）

- 补齐阅读工作区的日语、韩语、法语、德语、西班牙语文案。
- 覆盖文章检索、当前阅读摘要、单词卡片、词典语境、句中义、整句译文、用法笔记、选词面板及空状态。
- 补齐应用级关键通知的五语文案，包含模型配置/单词卡删除确认、章节更新、识别填入与阅读题空状态。

### 验证
- 已通过 `npm.cmd run build`。
- 已通过 `npm.cmd run test:ui`（13/13）。
- 已通过 `cargo test --manifest-path src-tauri\\Cargo.toml`（11/11）。
## 2026-08-07：界面国际化第十六轮（AI 模型配置）

- 补齐 AI 模型配置页面的法语、德语、西班牙语文案。
- 覆盖配置名称、保存列表、启用/删除、模型获取、连接测试、后台请求提示、模型增删和默认聊天模型设置。

### 验证
- 已通过 `npm.cmd run build`。
- 已通过 `npm.cmd run test:ui`（13/13）。
- 已通过 `cargo test --manifest-path src-tauri\\Cargo.toml`（11/11）。
## 2026-08-07：界面国际化第十七轮（偏好、快捷键与诊断）

- 补齐偏好、快捷键设置和项目诊断页面的日语、韩语、法语、德语、西班牙语文案。
- 覆盖快捷键录制规则、阅读选词操作、恢复默认、诊断刷新、数据健康、程序版本与旧题规范提示。

### 验证
- 已通过 `npm.cmd run build`。
- 已通过 `npm.cmd run test:ui`（13/13）。
- 已通过 `cargo test --manifest-path src-tauri\\Cargo.toml`（11/11）。

## 2026-08-07：界面国际化第十八轮（词卡、语境与章节编辑）

- 补齐词卡编辑、语境编辑、章节编辑及正文译文状态的日语、韩语、法语、德语、西班牙语文案。
- 已通过 npm 构建、UI 测试（13/13）与 Rust 测试（11/11）。


## 2026-08-07：界面国际化第十九轮（智能文件导入主界面）

- 补齐智能文件导入与阅读题校对主界面的日语、韩语、法语、德语、西班牙语文案。
- 已通过 npm 构建、UI 测试（13/13）与 Rust 测试（11/11）；正式 EXE 已于 2026-08-07 19:13 更新。


## 2026-08-07：API Key DPAPI 保存修复

- AI 配置保存时，Windows 现在使用 DPAPI 保护 API Key 后再写入配置文件；界面读取时仍在内存中解密，因此可明文查看和修改。
- 修复已加密 Key 在读取时被解密回写为明文的问题。
- 验证：cargo test 11/11，
pm.cmd run build，
pm.cmd run test:ui 13/13。

## 2026-08-07 API key storage verification

- Windows configuration writes now protect every provider API key with DPAPI before persisting `ai-provider.json`; stored values use the `dpapi:` prefix and are bound to the current Windows user.
- Runtime configuration is decrypted only in memory, so the settings page can still show and edit API keys as requested. The decrypted configuration is never written back to disk during reads.
- Added the Windows-only `ai_config::tests::dpapi_round_trip_preserves_plaintext_for_runtime` regression test. It verifies the persisted form is protected and every profile/legacy key survives a full encrypt/decrypt round trip.
- Audited frontend storage, diagnostics, PDF/Word export, and backend serialization paths. API keys are not written to browser storage, diagnostic data, or exported files.
- Verification: `cargo test --manifest-path src-tauri\Cargo.toml` (12 passed), `npm.cmd run build`, and `npm.cmd run test:ui` (13 passed).
- Remaining security work: optional user-exportable redacted diagnostic bundles and true cancellation for in-flight AI HTTP requests. Both are separate features; the existing timeout/retry behavior remains unchanged.
## 2026-08-07 Redacted diagnostic export

- Added a Version & Diagnostics action that exports a compact UTF-8 `.txt` report through the desktop save dialog; browser preview uses a local download fallback.
- The report uses an explicit whitelist: app version and aggregate counts for books, chapters, articles, vocabulary cards, reading questions, and legacy questions only.
- It intentionally excludes API keys, service URLs, model names, article text, translations, dictionary entries, and vocabulary-card details. This keeps reports safe to attach to bug reports.
- Added `diagnosticReport.ui.test.tsx` to the default UI test suite to guard the report format and privacy boundary.
- Verification: `npm.cmd run test:ui` (14 passed), `npm.cmd run build`, and `cargo test --manifest-path src-tauri\Cargo.toml` (12 passed).
## 2026-08-07：跨设备学习数据迁移与整书导入

### 跨设备迁移

- 桌面端“项目诊断 → 数据备份与迁移”支持导出、预检和恢复 `.readingbackup` 迁移包。
- 迁移包默认包含主学习数据库（书籍、章节、文章、译文、高亮、词卡、题目等）与当前已导入本地词典资源的 SQLite 在线快照；用户可关闭词典快照导出轻量学习数据包，恢复时会保留目标设备词典。
- 迁移包明确不包含 AI 配置、服务地址、模型名称、API Key、诊断报告或文章诊断内容。
- 每个包均包含数据大小与校验值；读取时会拒绝缺失、篡改或词典清单不一致的包。
- 恢复主学习数据库前会自动生成本机回滚包；词典恢复使用临时文件 + 指针切换，不直接覆盖正在被 Windows 占用的词典文件，因此可规避 `os error 32`。
- 恢复词典失败时，学习数据仍已恢复，错误会提示用户通过自动回滚包找回原本状态。

### 整书 / 多章节导入

- 新建书籍弹窗可进入“导入整本书或多章节”。支持连续粘贴文本、TXT、Markdown、Word，以及图片 / PDF 识别结果。
- 连续内容按 `Chapter`、`Unit`、`Lesson`、`第 X 章` 等标题自动拆分；用户可逐章编辑标题、正文与译文，再以单个事务写入书籍和章节。
- 图片 / PDF 的连续页面会保留跨页段落和原文-译文配对；识别出的题目可指定所属章节，保存后在阅读练习中继续校对。

### 近期验证

```text
cargo test --manifest-path src-tauri\\Cargo.toml  -> 18 passed
npm.cmd run build                                  -> passed
npm.cmd run test:ui                                -> 14 passed
```

### 后续建议

- 当前支持完整 SQLite 词典快照与不含词典的轻量学习数据包；“仅自定义词典资源”仍不应直接切换替换，未来需要采用合并导入策略，避免丢失目标设备内置词典。
- 根目录唯一正式 EXE 已于 2026-08-08 08:28 更新；安装包已生成。后续发布前仍需确认 `阅读学习助手.exe` 未运行，再进行 NSIS 构建与替换。

## 2026-08-08：可选本地词典迁移

- 数据备份页新增“同时备份本地词典资源”选项，默认开启，维持跨设备完整可用的迁移行为。
- 关闭该选项会导出轻量学习数据包；恢复这类包时，目标设备现有本地词典保持不变。
- 自动生成的恢复前回滚包始终包含当前本地词典，保证可完整回退。
- 没有直接上线“仅自定义词典并替换”的方案：当前查询链仍依赖内置 `entries` 表，直接切换精简库会让目标设备失去内置词典。后续若要做，仅应使用合并导入策略。
- 验证：`cargo test --manifest-path src-tauri\\Cargo.toml`（18 passed）、`npm.cmd run build`、`npm.cmd run test:ui`（14 passed）。

## 2026-08-08：正式发布构建

- 构建前已确认 `阅读学习助手.exe` 与 `reading-agent.exe` 均未运行。
- 已使用 `npm.cmd run tauri build -- --bundles nsis` 完成发布构建。
- 根目录唯一正式程序已替换：`F:\英语阅读助手\阅读学习助手.exe`，生成时间为 2026-08-08 08:28:46，大小为 19,158,528 字节。
- NSIS 安装包：`src-tauri\target\release\bundle\nsis\阅读学习助手_0.1.1_x64-setup.exe`，生成时间为 2026-08-08 08:28:44。
## 2026-08-08：语言资源中心泛化

- 移除了资源中心中的英语预设词典安装卡与对应的后端命令，不再将英语资源作为产品前提。
- 语言资源中心统一保留“从本机导入”：可选择资源语言和类型（词典、词表、术语表、例句资源），支持 CSV、TSV、TXT。
- 首次导入任意语言时自动创建本地资源库，并以临时库写入后切换，避免文件占用造成半成品；所有新导入资源默认启用。
- 不会删除用户已存在的本地词典数据库或资源文件；本轮仅清理预设安装入口和未使用组件。
- 验证：`cargo test --manifest-path src-tauri\Cargo.toml`（18 passed）、`cargo check --manifest-path src-tauri\Cargo.toml`、`npm.cmd run build`、`npm.cmd run test:ui`（14 passed）。
- 已于 2026-08-08 09:05 完成 NSIS 发布构建，并更新唯一正式程序 `F:\英语阅读助手\阅读学习助手.exe`（19,020,288 bytes）；安装包位于 `src-tauri\target\release\bundle\nsis\阅读学习助手_0.1.1_x64-setup.exe`。
## 2026-08-08：语言资源方向与自动识别

- 修复资源启停反馈重复拼接状态的问题：资源名称与“已启用 / 已停用”状态分离，提示统一为“资源名：状态”。
- 自定义资源新增 `查询语言 → 释义语言` 元数据；旧资源首次读取时自动补全，历史英语资源默认迁移为“英语 → 中文”。
- 导入流程调整为“选择 CSV/TSV/TXT → 本地抽样分析 → 确认导入”：自动识别资源类型、查询语言、释义语言、建议名称与置信度，用户可在保存前修改。
- 自动分析只读取本地文件的表头和前 50 条有效记录，不调用 AI，不上传资源文件。
- 资源列表按查询语言分组，展示方向、类型、词条数和单一启停状态；支持中文、英语、日语、韩语、法语、德语、西班牙语、意大利语、葡萄牙语、俄语、阿拉伯语及其他语言。
- 验证：`cargo test --manifest-path src-tauri\Cargo.toml`（18 passed）、`cargo check --manifest-path src-tauri\Cargo.toml`、`npm.cmd run build`、`npm.cmd run test:ui`（14 passed）。
- 已于 2026-08-08 09:27 更新正式程序 `F:\英语阅读助手\阅读学习助手.exe`（19,013,120 bytes）及 NSIS 安装包。

## 2026-08-08：WordNet 导入故障排查记录

### 正确目录

```text
F:\英语阅读助手\词典资料\dict
```

必须能看到：

```text
data.noun
data.verb
data.adj
data.adv
```

`dict\dbfiles` 不包含上述主数据文件；当前解析器会在误选 `dbfiles` 时自动回退到上级目录。

### 缓存与权限

WordNet 原始文本不会直接写回用户词典目录。前端本地解析后会生成：

```text
%LOCALAPPDATA%\com.readingagent.app\resource-import-cache\wordnet-*.csv
```

相关权限配置位于 `src-tauri\capabilities\default.json`，需要同时保留：

- `fs:default`
- `fs:scope-applocaldata-recursive`
- `fs:allow-mkdir`
- `fs:allow-write-text-file`

如果再次出现 `forbidden path` 或 `not allowed by ACL`，优先确认用户打开的是根目录最新 EXE，而不是旧副本或旧进程。

### 最新发布信息

- 正式程序：`F:\英语阅读助手\阅读学习助手.exe`
- 更新时间：`2026-08-08 11:11:29`
- 文件大小：`19,243,520 bytes`
- NSIS 安装包：`src-tauri\target\release\bundle\nsis\阅读学习助手_0.1.1_x64-setup.exe`
- 更新 EXE 前必须确认程序已完全退出，不得强制结束进程。

### 下一次验收

1. 启动根目录正式 EXE。
2. 打开语言资源中心。
3. 选择 WordNet 根目录并确认导入预览。
4. 验证名称、方向、类型和词条数量。
5. 导入后查询 `announce`、`animal`、`rapid`、`go`。

## 2026-08-08：第一轮稳定性重构完成

### 本轮改动

- 本地缓存逻辑集中到 `src/services/localFileService.ts`。
- WordNet 和其他资源格式共用 `writeAppResourceCacheFile`，避免各模块重复调用 `appLocalDataDir`、`mkdir` 和 `writeTextFile`。
- `appResourceCachePath` 负责统一处理目录末尾分隔符。
- 新增路径回归测试，防止再次生成 `com.readingagent.appresource-import-cache` 这类错误路径。

### 验证结果

```text
npm.cmd run test:ui                                -> 14 passed
npm.cmd run build                                  -> passed
cargo check --manifest-path src-tauri\\Cargo.toml -> passed
```

### 最新程序

```text
F:\英语阅读助手\阅读学习助手.exe
```

生成时间：`2026-08-08 11:28:02`；大小：`19,243,520 bytes`。

本轮尚未完成真实 GUI 的 WordNet 端到端导入验收，下一步应使用真实目录完成一次导入、查词和重复导入测试。

## 2026-08-08：第二轮稳定性重构完成

- `resourceFileConversion.ts` 的 WordNet 解析已拆为可测试的 `parseWordNetEntries`。
- 新增 `resourceFileConversion.test.ts`，后续修改 WordNet 解析规则必须先更新该测试。
- 最新 EXE：`F:\英语阅读助手\阅读学习助手.exe`，时间 `2026-08-08 11:38:44`，大小 `19,243,520 bytes`。
- 自动验证保持：UI 14/14、前端构建通过、Rust 检查通过。
- 发布后第一项人工任务：选择 `F:\英语阅读助手\词典资料\dict` 导入 WordNet，并查询 `announce`、`animal`、`rapid`、`go`。

## 测试命令更新

`npm.cmd run test:ui` 现在包含 UI 测试、WordNet 解析测试和本地文件服务测试，共 8 个测试文件、20 个测试；`questionCompatibility.test.ts` 仍由 `npm.cmd run test:learning` 使用 Node 原生测试运行器执行。

## 2026-08-08：第三轮 WordNet 导入预检

- `wordNetDirectoryCandidates` 处理 `dict` 与 `dict\dbfiles` 两种用户选择。
- `normalizeWordNetDirectory` 会先确认 `data.noun`，再逐项读取 `data.verb`、`data.adj`、`data.adv`。
- 新的报错优先给出可操作中文说明：目录不对、缺少哪个主数据文件、或未解析到有效词条。
- 自动测试更新为 8 个文件、23 个测试全部通过。
- 最新正式程序时间：`2026-08-08 13:05:36`。

## 2026-08-08：WordNet `.exc` 词形映射

- 导入时读取 `.exc` 文件，将不规则词形追加为可查询词条，并复用原形的释义与词性。
- 这一步增强 WordNet 资源的查词命中率，不改变词典优先、AI 辅助的业务边界。
- 资料包若没有 `.exc` 文件会自动跳过，不视为导入失败。
- 验收建议：导入后查询 `announced`、`children`、`went`，确认能返回对应 WordNet 释义。
- 最新正式 EXE 时间：`2026-08-08 13:12:53`；自动测试：8 个文件、25 个测试通过。

## 2026-08-08：WordNet 大文件导入体验优化

- `parseWordNetEntriesInBatches` 每处理 1,500 行主动让出事件循环，避免 `data.noun` 等大文件长时间阻塞界面。
- `normalizeWordNetDirectory` 接受进度回调；资源中心会展示解析哪个 `data.*` 文件以及完成进度。
- 同步解析和分批解析必须保持结果一致，已有回归测试覆盖。
- 最新正式 EXE：`F:\英语阅读助手\阅读学习助手.exe`，时间 `2026-08-08 13:21:38`；自动测试 8 个文件、26 个测试通过。

## 2026-08-08：WordNet 文件内实时进度

- `parseWordNetEntriesInBatches` 回调返回已处理/总行数。
- 资源中心将行级进度换算为四个主数据文件整体进度，并显示例如“正在解析 data.noun（42%）”。
- 当前自动测试：8 个文件、27 个测试通过；最新 EXE 时间：`2026-08-08 13:31:07`。

<!-- gzip-resource-import-20260808 -->
## 最近完成：单文件 gzip 资源导入（2026-08-08）

- 已完成 `resourceFormatForPath()`：常规资源返回自身后缀，`*.csv.gz`、`*.json.gz` 等返回内部资源后缀；`*.tar.gz` 保持识别为 `tar`。
- `normalizeResourceImportFile()` 仅解压单文件 gzip 文本/表格资源；对 `tar.gz` 与压缩后的二进制/归档格式给出“先解压”的中文提示，不宣称支持全部压缩包。
- 回归测试位于 `src/features/localDictionary/resourceFileConversion.test.ts`，覆盖 `csv.gz`、`tsv.gz`、`tar.gz`、普通 JSON 与文件选择器扩展名。
- 最新验证：UI 测试 31/31 通过；前端生产构建和 Rust 检查通过；正式 EXE 已更新到项目根目录。

下一步如继续优化，应优先基于真实用户词典样本补充格式兼容性，而不是放宽压缩包支持边界。

<!-- word-docx-chunk-split-20260808 -->
## 最近完成：Word 导入与导出依赖独立按需加载（2026-08-08）

- `vite.config.ts` 的 `manualChunks` 已从合并的 `word` 改为独立 `docx`、`mammoth` 包。
- 不要将二者重新合并：`.docx` 导入使用 `mammoth`，Word 导出使用 `docx`，两条操作路径不应互相增加网络/磁盘加载与解析成本。
- 当前构建仅有 `mammoth` 约 501.70 KB 的体积提示；该包已由动态导入触发，优先保留真实性能边界，不要仅为消除警告而调高 `chunkSizeWarningLimit`。
- 最新验证：`npm.cmd run test:ui`（31 passed）、`npm.cmd run test:learning`（4 passed）、`npm.cmd run build`、`cargo check --manifest-path src-tauri\\Cargo.toml`、NSIS 构建均通过；正式 EXE 已更新。

<!-- resource-center-localization-20260808 -->
## 最近完成：语言资源中心本地化补齐（2026-08-08）

- 新增 `src/features/localDictionary/wordNetUi.ts`，集中管理 WordNet 专用操作、进度、失败提示和文件选择器名称的 8 种界面语言文案。
- `resourceLanguageLabel()` 使用 `Intl.DisplayNames` 以当前 `displayLanguage` 显示资源语言；不支持的代码使用调用方提供的“其他语言”回退值。
- `CustomDictionaryPanel.tsx` 与 `LocalDictionaryCenterModal.tsx` 已移除相关硬编码中文。新增 `wordNetUi.test.ts` 覆盖插值、语言名称和安全回退。
- 发布验证：UI 34/34、学习题 4/4、生产构建、Rust 检查和 NSIS 构建均通过；正式 EXE 已更新。

后续本地化工作应继续扫描各功能模块的直接中文字符串，优先处理用户可见的按钮、对话框标题、进度与错误提示，并为每个独立翻译工具增加最小回归测试。

<!-- resource-import-error-codes-20260808 -->
## 最近完成：资源导入结构化错误与多语言提示（2026-08-08）

- 新增 `src/features/localDictionary/resourceImportErrors.ts`：`ResourceImportError`、稳定错误码、创建与类型守卫函数。
- `resourceFileConversion.ts` 对所有可预期的格式/内容失败抛出错误码；不要再在该文件中为这些场景写用户可见自然语言错误。
- `wordNetUi.ts` 新增 `resourceImportErrorMessage()`，按 `displayLanguage` 将已知错误码本地化；未知异常保留 `String(error)`，以便 ACL、路径或磁盘问题仍可被识别。
- `LocalDictionaryCenterModal.tsx` 的 WordNet 与通用资源导入 catch 均已使用该格式化函数。`wordNetUi.test.ts` 覆盖错误插值、本地化与未知错误回退。
- 最新验证：UI 35/35、学习题 4/4、生产构建、Rust 检查和 NSIS 构建通过；正式 EXE 已更新。

后续若增加新的可预期导入失败，必须先在 `resourceImportErrors.ts` 加错误码，再补齐 `wordNetUi.ts` 的 8 种翻译和单测；不要把翻译文本重新散落在解析器内。

<!-- wordnet-progress-structure-20260808 -->
## 最近完成：WordNet 进度语义化（2026-08-08）

- `normalizeWordNetDirectory()` 的回调参数改为 `WordNetImportProgress`，包含 `stage`、`file`、`percent`、`completed`、`total`，不再包含用户可见的自然语言 `detail`。
- 当前调用方只有 `LocalDictionaryCenterModal.tsx`，并使用 `wordNetProgressText(progress, displayLanguage)` 显示进度。
- 新增测试覆盖“检查目录”和“解析具体文件”两种本地化进度。若新增阶段，先扩展 `WordNetImportProgress` 与 `wordNetProgressText()`，禁止回退为解析器内的硬编码文案。
- 最新验证：UI 36/36、学习题 4/4、生产构建、Rust 检查和 NSIS 构建通过；正式 EXE 已更新。

<!-- batch-book-import-entry-fix-20260808 -->
## 最近修复：整书/多章节导入入口无响应（2026-08-08）

- 根因：`BookCreationModal` 有“导入整本书或多章节”按钮，但 `App.tsx` 没有传入 `onOpenBatchImport`，而该属性以前提供了空函数默认值，因此点击无异常也无动作。
- 已在 `App.tsx` 传入状态切换回调：先 `closeBookCreation()`，后 `setBatchBookImportOpen(true)`；`BookCreationModal` 将该回调改为必填。
- `BookCreationModal.ui.test.tsx` 增加点击入口必须调用应用状态回调的测试。后续不要为应用级导航/弹窗开关保留静默空函数默认值；必须使关键回调必填或给出显式错误处理。
- 最新验证：UI 37/37、学习题 4/4、生产构建、Rust 检查与 NSIS 构建通过；正式 EXE 已更新。

<!-- append-batch-chapters-existing-book-20260808 -->
## 最近完成：向已有书籍批量追加章节（2026-08-08）

- 书架展开后的“导入多个章节”会将目标书籍的 `id`、`title`、`language` 传入 `BatchBookImportModal`。
- `BatchBookImportModal` 的 `targetBook` 存在时进入追加模式：隐藏书籍元数据输入，提交时携带 `bookId`；图片/PDF 识别仍以目标书名和语言作为上下文。
- Rust `BatchBookImportInput.book_id` 为可选字段。使用已有 `bookId` 时必须查询目标书并读取其持久化语言，章节 `position` 从 `MAX(position) + 1` 开始；没有 `bookId` 时保留创建书籍的原有分支。
- 新增 `BatchBookImportModal.ui.test.tsx`，验证追加模式标题、说明、隐藏书籍字段与章节正文输入。若以后扩展导入目标，继续以显式 `targetBook` / `bookId` 区分新建和追加，不要靠书名匹配。
- 最新验证：UI 38/38、学习题 4/4、Rust 18/18、生产构建与 NSIS 构建通过；正式 EXE 已更新。
<!-- clear-stale-current-reading-20260808 -->
## 2026-08-08：当前阅读残留修复已发布

### 用户问题

删除全部章节后，右侧当前阅读仍显示已经删除的文章。

### 修复实现

- `src/features/chapters/useArticleWorkspace.ts`：`refresh()` 获取文章列表后检查当前文章是否存在；不存在时使在途加载失效，并清空 `article`、`marks` 与 `cards`。
- `src/App.tsx`：书架 `onLibraryChanged` 同时调用 `refreshBookshelf()` 和文章工作区 `refresh()`，使删除后的阅读状态立即同步。
- `src/features/chapters/useArticleWorkspace.test.ts`：覆盖“文章列表变为空时清空当前文章、标记、词卡”的回归场景。

### 验证与发布

- `npm.cmd run test:ui`：39 项通过。
- `npm.cmd run test:learning`：4 项通过。
- `npm.cmd run build` 与 `cargo check --manifest-path src-tauri\Cargo.toml`：通过。
- 已构建 NSIS，并覆盖 `F:\英语阅读助手\阅读学习助手.exe`；更新时间 2026-08-08 16:23:34，大小 19,295,232 bytes。
<!-- local-book-content-package-20260808 -->
## 2026-08-08：本地书籍内容导入导出已发布

### 已实现

- `src/features/chapters/BookContentPackageModal.tsx`：书架的本地书籍导入与单书导出弹窗。
- `src/features/chapters/bookContentPackage.ts`：`.readingbook` 的版本化 JSON 格式校验，以及 EPUB 的本地解析。
- `src-tauri/src/content_library.rs`：新增 `export_book_content`，只读取书籍、章节、正文与已保存译文。
- `src/features/chapters/Bookshelf.tsx`：书架顶部可新建本地导入；书籍操作区可追加导入或导出本书。

### 内容边界

- `.readingbook` 是内容流通格式，不是全量迁移格式。
- 不包含高亮、选词、词卡、笔记、进度、答题记录、词典或 AI 配置；完整个人学习数据仍使用“数据备份 / 恢复”。
- EPUB 仅进行本地文字解析；扫描 PDF、图片和无法提取文字的文件仍应使用智能文件导入，并由用户主动决定是否调用 AI。

### 验证与发布

- `npm.cmd run test:ui`：42 项通过。
- `npm.cmd run test:learning`：4 项通过。
- `cargo test --manifest-path src-tauri\Cargo.toml`：18 项通过。
- `npm.cmd run build`、`cargo check --manifest-path src-tauri\Cargo.toml`：通过。
- 正式程序已更新：`F:\英语阅读助手\阅读学习助手.exe`，2026-08-08 16:52:31，19,342,848 bytes。
<!-- unified-local-book-text-import-20260808 -->
## 2026-08-08：统一文本书籍导入第二阶段已发布

### 新增能力

- `BookContentPackageModal` 现支持选择 `.readingbook`、EPUB、TXT、Markdown、HTML、HTM 和 DOCX。
- 导入预览允许勾选章节、取消不需要的章节并直接修改章节标题；提交时仅写入已勾选的章节。
- `bookContentPackage.ts` 新增 `readLocalBookFile` 与 `splitBookText`；HTML 会先本地提取标题和段落，DOCX 复用已有本地文本提取器。

### 规则与边界

- 本轮全部采用确定性本地规则，不调用 AI，不消耗 Token。
- 标题无法可靠识别时导入为单章节，不做语义猜测。
- 本地书籍内容包继续排除个人标记、词卡、笔记、进度和答题数据。

### 验证与发布

- `npm.cmd run test:ui`：44 项通过。
- `npm.cmd run build` 与 `cargo check --manifest-path src-tauri\Cargo.toml`：通过。
- 正式程序已更新：`F:\英语阅读助手\阅读学习助手.exe`，2026-08-08 16:59:00，19,342,848 bytes。
<!-- local-pdf-import-epub-export-20260808 -->
## 2026-08-08：本地 PDF / EPUB 第三阶段已发布

### 已实现

- `src/documentTools.ts` 新增 `extractPdfText`：本地提取文本型 PDF，支持最多 800 页，并在每 8 页让出一次主线程。
- `bookContentPackage.ts` 的 `readLocalBookFile` 已接入 PDF；扫描件或文字过少会返回清晰的“转到智能文件导入”提示。
- `createEpubBytes` 使用 JSZip 生成 EPUB 3 所需的 `mimetype`、容器、OPF 元数据、导航、样式和章节 XHTML。
- `BookContentPackageModal` 的导出弹窗现在可导出 `.readingbook` 或 EPUB，并可勾选“附带已保存译文”。

### 数据边界

- 文本 PDF 与 EPUB 流程都在本地完成，不调用 AI，不消耗 Token。
- EPUB 仅导出书籍结构、正文与可选译文；个人学习数据继续仅通过全量数据备份迁移。
- 导入扫描 PDF、照片或无可提取文字 PDF 时，不自动 OCR，必须由用户主动进入智能文件导入。

### 验证与发布

- `npm.cmd run test:ui`：45 项通过。
- `npm.cmd run test:learning`：4 项通过。
- `cargo test --manifest-path src-tauri\Cargo.toml`：18 项通过。
- `npm.cmd run build`、`cargo check --manifest-path src-tauri\Cargo.toml` 与 NSIS 发布构建：通过。
- 正式程序已更新：`F:\英语阅读助手\阅读学习助手.exe`，2026-08-08 17:06:09，19,346,944 bytes。
<!-- local-book-import-progress-cancel-20260808 -->
## 2026-08-08：本地书籍导入稳定性第四阶段已发布

### 已实现

- `BookContentPackageModal`：新增解析进度文本和“取消解析”按钮；解析中会禁用重复选择文件和提交导入。
- `bookContentPackage.ts`：新增 `LocalBookImportOptions`、`LocalBookImportCancelledError` 和取消识别函数；EPUB 与通用本地文本读取均接收取消/进度回调。
- `documentTools.extractPdfText`：改为选项对象，支持页级进度、取消信号，并每 8 页让出一次浏览器主线程。

### 行为约束

- 取消发生在本地解析阶段，尚未调用 `import_book_chapters`，因此不会生成半成品书籍或章节。
- `.readingbook` 读取非常短，仍可直接完成；大耗时格式 EPUB、PDF、DOCX 才显示明显进度。
- 扫描件 PDF 的分流策略保持不变：只给提示，不自动调用 AI。

### 验证与发布

- `npm.cmd run test:ui`：46 项通过。
- `npm.cmd run test:learning`：4 项通过。
- `cargo test --manifest-path src-tauri\Cargo.toml`：18 项通过。
- `npm.cmd run build`、`cargo check --manifest-path src-tauri\Cargo.toml` 与 NSIS 发布构建：通过。
- 正式程序已更新：`F:\英语阅读助手\阅读学习助手.exe`，2026-08-08 17:11:05，19,346,944 bytes。
<!-- append-book-duplicate-precheck-20260808 -->
## 2026-08-08：追加书籍重复章节保护已发布

### 已实现

- `content_library::preview_book_chapter_duplicates`：接收目标书籍与导入章节，在后端对现有章节做“标题 + 正文”规范化精确比对，并返回命中的导入章节索引。
- `BookContentPackageModal`：仅在 `targetBook`（追加模式）下调用预检；命中的章节以黄色提示，并默认从已选择集合中移除。
- `chapter_duplicate_key` 会忽略大小写和任意空白差异，但会保留标题和正文两个条件，降低同名不同内容的误判。

### 行为边界

- 预检不删除、修改或覆盖已有章节。
- 用户可手动重新勾选“疑似重复”项后继续导入，保持用户最终决定权。
- 新建书籍不会进行此预检，因为目标书内不存在可比较章节。

### 验证与发布

- `npm.cmd run test:ui`：46 项通过。
- `npm.cmd run test:learning`：4 项通过。
- `cargo test --manifest-path src-tauri\Cargo.toml`：19 项通过。
- `npm.cmd run build`、`cargo check --manifest-path src-tauri\Cargo.toml` 与 NSIS 发布构建：通过。
- 正式程序已更新：`F:\英语阅读助手\阅读学习助手.exe`，2026-08-08 17:17:28，19,365,376 bytes。
<!-- local-book-import-metadata-edit-20260808 -->
## 2026-08-08：本地书籍导入前元数据编辑已发布

### 已实现

- `BookContentPackageModal` 在“新建书籍”导入预览中显示书名、学习语言、作者和书籍简介字段。
- 字段直接更新 `packageDraft.book`，最终复用既有 `import_book_chapters` 写入新书籍。
- 书名为空时在提交前阻止导入；语言选项复用 `supportedLanguages`。

### 行为边界

- 有 `targetBook` 的追加模式不显示元数据编辑区，书名、语言、作者和简介全部沿用已有书籍。
- 这不会改动 `.readingbook` 原文件或导入源文件；仅影响本次创建到本地书架的书籍信息。

### 验证与发布

- `npm.cmd run test:ui`：46 项通过。
- `npm.cmd run test:learning`：4 项通过。
- `cargo test --manifest-path src-tauri\Cargo.toml`：19 项通过。
- `npm.cmd run build`、`cargo check --manifest-path src-tauri\Cargo.toml` 与 NSIS 发布构建：通过。
- 正式程序已更新：`F:\英语阅读助手\阅读学习助手.exe`，2026-08-08 17:24:39，19,365,376 bytes。

<!-- local-book-import-language-mapping-20260808 -->
## 2026-08-08：本地书籍导入语言自动映射已发布

### 本轮改动

- src/features/chapters/bookContentPackage.ts 新增 esolveImportLanguage(metadataLanguage, sourceText)，供 EPUB 与本地文本导入共用。
- 先规范化 EPUB 语言标签（小写、_ 转 -、取基础语言），支持 ISO 常见三字母和英文语言名称；无法映射时才使用正文识别。
- 无元数据正文的英文兜底依赖拉丁字符占比与多个常见英文功能词，避免现有通用检测器返回 other 时丢失学习语言。
- src/features/chapters/bookContentPackage.test.ts 已覆盖地区标签、下划线标签和英文无元数据回退。

### 验证与发布

- 
pm.cmd run test:ui：47/47 通过。
- 
pm.cmd run test:learning：4/4 通过。
- cargo test --manifest-path src-tauri\Cargo.toml：19/19 通过。
- 
pm.cmd run build、cargo check --manifest-path src-tauri\Cargo.toml 与 NSIS 发布构建：通过。
- 正式程序已更新：F:\英语阅读助手\阅读学习助手.exe，2026-08-08 18:30:10，19,365,376 bytes。

### 后续注意

- 导入语言识别必须保持本地、可撤销，不能触发 AI 请求；导入预览中的手动语言选择优先级最高。
<!-- docx-local-parser-performance-20260808 -->
## 2026-08-08：DOCX 本地解析与前端体积优化已发布

### 本轮改动

- src/documentTools.ts 的 extractDocxText 改为通过 jszip 读取 word/document.xml，按 WordprocessingML 节点顺序恢复段落、	ab、r/cr 文本。
- src/documentTools.test.ts 新增 DOCX XML 回归样例，覆盖实体字符、段落、制表符、换行及正文缺失提示。
- 删除 mammoth 依赖，并移除 ite.config.ts 中的旧分包配置；DOCX 导入仍为本地离线处理。

### 验证与发布

- 
pm.cmd run test:ui：49/49 通过。
- 
pm.cmd run test:learning：4/4 通过。
- cargo test --manifest-path src-tauri\Cargo.toml：19/19 通过。
- 
pm.cmd run build、cargo check --manifest-path src-tauri\Cargo.toml 与 NSIS 发布构建：通过。
- 构建结果不再包含 mammoth chunk；唯一正式程序：F:\英语阅读助手\阅读学习助手.exe，2026-08-08 19:29:14，19,275,264 bytes。

### 后续注意

- DOCX 提取只读取可见正文文本，不应恢复批注、修订、图片或用户学习数据；复杂版式仍以导入后校对区为准。
<!-- smart-import-retry-progress-20260808 -->
## 2026-08-08：智能导入失败重试与进度同步已发布

### 本轮改动

- src/features/import/PhotoImportModal.tsx 新增统一草稿回填函数；首次识别与单页重试均通过它同步正文、译文、题目与自动章节标题。
- 重试失败页时会显示进行中、成功或失败的明确状态，不再吞掉异常；成功后立刻刷新校对区。
- 批量继续识别时先剔除 done 页面，避免对已成功页面重复调用模型；失败批次数会显示在最终提示中。
- 停止任务后的进度改为真实已处理页组数，而非错误地显示全部完成。

### 验证与发布

- 
pm.cmd run test:ui：49/49 通过。
- 
pm.cmd run build 与 NSIS 发布构建：通过。
- 正式程序已更新：F:\英语阅读助手\阅读学习助手.exe，2026-08-08 19:34:33，19,275,264 bytes。

### 后续注意

- 单页重试适用于异常页面修复；跨页连续文本的首次识别仍使用 8 页页组与 1 页重叠策略，以保证段落衔接。
<!-- bookshelf-error-retention-20260808 -->
## 2026-08-08：书架失败保留与操作反馈已发布

### 本轮改动

- src/features/chapters/Bookshelf.tsx 在获取书籍或章节失败时保留当前状态，并展示错误信息；不再把失败结果写成空数组。
- 章节改名、排序、书籍编辑均加入错误捕获和可见反馈；书籍编辑失败继续抛出错误以保留编辑弹窗和表单内容。
- src/features/chapters/Bookshelf.ui.test.tsx 覆盖书架加载失败后仍可看到书架入口和错误提示。

### 验证与发布

- 
pm.cmd run test:ui：50/50 通过。
- 
pm.cmd run build 与 NSIS 发布构建：通过。
- 正式程序已更新：F:\英语阅读助手\阅读学习助手.exe，2026-08-08 19:40:53，19,275,264 bytes。

### 后续注意

- 书架刷新失败时，保留旧数据优先于清空 UI；任何真正删除均只能由成功的后端删除命令触发。
<!-- book-import-entry-i18n-20260808 -->
## 2026-08-08：新建书籍导入入口多语言化已发布

### 本轮改动

- src/i18n/ui.ts 为 ookT 新增 importBookOrChapters，八种显示语言均有对应文本。
- src/features/chapters/BookCreationModal.tsx 使用该语言包键显示整书/多章节导入入口，并移除中文默认语言兜底。
- src/features/chapters/BookCreationModal.ui.test.tsx 新增英文界面回归断言。

### 验证与发布

- 
pm.cmd run test:ui：51/51 通过。
- 
pm.cmd run build 与 NSIS 发布构建：通过。
- 正式程序已更新：F:\英语阅读助手\阅读学习助手.exe，2026-08-08 19:48:53，19,275,264 bytes。

### 后续注意

- 新增书籍相关可见文案必须优先进入 ookMessages，不要在组件中直接写某一种语言文本。
<!-- bookshelf-actions-i18n-20260808 -->
## 2026-08-08：书架操作入口多语言化已发布

### 本轮改动

- src/i18n/ui.ts 扩展 ShelfUiKey，新增本地书籍导入、书籍内容导入、书籍导出、多章节导入四个语言键，八种显示语言均已补齐。
- src/features/chapters/Bookshelf.tsx 移除书架标题和四个操作入口的中文硬编码。
- src/features/chapters/Bookshelf.ui.test.tsx 新增英语界面断言。

### 验证与发布

- 
pm.cmd run test:ui：52/52 通过。
- 
pm.cmd run build 与 NSIS 发布构建：通过。
- 正式程序已更新：F:\英语阅读助手\阅读学习助手.exe，2026-08-08 21:19:20，19,275,264 bytes。

### 后续注意

- 书架新增按钮或标题必须复用 shelfT，不能在组件中直接写单一语言文案。
<!-- deleted-reading-request-invalidation-20260808 -->
## 2026-08-08：删除后旧阅读内容复现修复已发布

### 根因与改动

- 原先书架删除当前章节时直接调用 setArticle(null)；这不会递增 loadRequestId，因此已经发出的 get_article 请求仍可能在稍后回写已删除文章。
- src/features/chapters/useArticleWorkspace.ts 新增 clearCurrentArticle()：同步使旧加载失效、清空当前文章、标记和词卡。
- src/App.tsx 的删除回调改为使用该统一方法。
- src/features/chapters/useArticleWorkspace.test.ts 新增延迟请求回归：先开始读取、再清空、后返回旧文章时，阅读区必须保持为空。

### 验证与发布

- 
pm.cmd run test:ui：53/53 通过。
- 
pm.cmd run build 与 NSIS 发布构建：通过。
- 正式程序已更新：F:\英语阅读助手\阅读学习助手.exe，2026-08-08 21:54:15，19,275,264 bytes。

### 后续注意

- 任何离开、删除或替换当前文章的入口必须调用 clearCurrentArticle()，不能直接调用 React 的 setArticle(null)。

## 2026-08-08 交接补充：已删除文章残留
- 现象：书架显示为空，但阅读区继续显示已删除文章。
- 处理：后端文章列表和单篇读取均要求有效书籍+有效章节；数据库升级 version 4 清理孤立文章。
- 前端已有的请求失效逻辑继续保留，用于处理删除后的异步回写竞态。
- 测试：`npm.cmd run test:ui` 通过（54/54）；`cargo test --manifest-path src-tauri\Cargo.toml` 通过（20/20）。
