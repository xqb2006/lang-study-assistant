# 当前项目交接（2026-08-16）

> 这是当前权威交接文档。旧的 `SESSION_HANDOFF.md`、`PROJECT_STATUS.md` 和 `DEVELOPMENT_GUIDE.md` 保存历史决策；如有冲突，以本文为准。

## 产品与发布文件

- 主程序：`F:\英语阅读助手\阅读学习助手.exe`
- 独立转换器：`F:\英语阅读助手\阅读内容转换器.exe`
- 主程序产品名与窗口标题：`阅读学习助手`
- 源码工作区：`F:\英语阅读助手\reading-agent`
- Tauri 编译中间产物仍为 `src-tauri\target\release\reading-agent.exe`，这是内部构建名，不是对用户发布的文件名。

## 2026-08-27 学习模式可见性修复

- 根因：学习模式的组件状态可正常打开，但学习区渲染在整篇双语正文之后；长文章中点击入口后，视口不会自动移动，因此表现为“打不开”。
- 修复：`src/App.tsx` 为学习区增加可聚焦引用；`learningOpen` 变为开启状态后，使用 `scrollIntoView` 自动平滑定位并聚焦学习区。
- 验证：`npm.cmd run test:ui` 通过（27 个测试文件、97 个测试）；`npm.cmd run build` 通过；`npm.cmd run tauri build -- --bundles nsis` 通过，并生成 NSIS 安装包。
- 发布流程：不要用 `cargo build --release` 直接覆盖正式 EXE；它会遗漏 Tauri CLI 注入的正式前端资源配置，程序会错误请求开发服务器 `127.0.0.1`。必须通过 `npm.cmd run tauri build -- --bundles nsis` 打包后，使用 `src-tauri\target\release\reading-agent.exe` 覆盖正式文件。
- 正式主程序已更新：`F:\英语阅读助手\阅读学习助手.exe`，SHA-256 为 `797FAE6005BF75A0809A0E8CAE41EE90AC68DED48912DBF365F33C203EACEFC6`；已启动确认窗口响应正常。

## 2026-08-16 桌宠精灵图形象包

- 已移除面向用户的“皮肤 / 性格 / 语气”拆分设置；它们不再作为桌宠外观配置。
- 桌宠外观现在支持导入单张精灵图：PNG、WebP、GIF、JPG、JPEG，最大 15 MB。导入后会复制到应用本地数据目录的 `companion-appearances`，不依赖原文件位置。
- 用户可设定精灵图横向、纵向格数（各 1 至 8），并为待机、开心、思考、困倦、说话、拖动六种状态逐格映射。运行时按坐标裁切同一张大图，不生成多份图片。
- 删除当前形象会要求二次确认，并删除应用保存的图片副本；旧版 Emoji 配置仍可作为未导入形象时的回退。
- 已移除“自定义学习提示词”及前端 `persona/tone` 请求字段。AI 阅读助手的教学规则改由 `src-tauri/src/ai_workflows.rs` 固定维护：中文作答、先结论后依据、词汇/语法/文章理解的说明标准、信息不足处理和防编造边界均不允许被用户配置覆盖。
- 阅读页在已导入自定义形象时只显示裁切后的桌宠本体：无白色卡片、无名称、无聊天图标、无头像框；仍保留点击打开和拖动。未导入时才回退为基础图标桌宠。
- AI 对话中，选中词、短语或句子后会自动附带对应完整句子；界面显示“已引用当前句”，用户可点击移除。选中内容变化时会自动恢复引用，不再提供“附带当前选句”复选框。
- 点击“助手设置”后会进入独立的桌宠设置页：仅显示形象、状态映射和称呼配置；聊天记录、文章问题输入框、发送和清空对话控件都会隐藏。点击“返回聊天”后恢复聊天页。
- 本轮验证：`npm.cmd run test:ui` 通过，22 个测试文件、81 个测试；`npm.cmd run build` 与 NSIS 打包通过。
- 正式主程序已更新：`F:\英语阅读助手\阅读学习助手.exe`，SHA-256 为 `600DCEDF994DD3231C940D280BA8FEC500F9E7332BBFAFC0B999481D618F73C4`。
- 沙箱内无法写入已有用户数据库会导致退出码 `101`，属于沙箱权限限制；已在用户账户环境启动新版主程序并确认进程响应。当前正式主程序正在运行，未强制结束。
## 两个程序的职责边界

### 阅读学习助手

保留：书架、书籍/章节管理、`.readingbook` 导入、阅读与译文、选词查词、AI 深度解析、题目作答、词卡复习、词典资源、备份迁移、PDF/Word/词表导出。

不再保留：TXT/EPUB/Word/HTML/PDF 的整书原始文件解析、扫描件的跨章节整理、批量章节 AI 整理。保留当前新建单章节中的图片/PDF 识别。书架和创建书籍窗口只提供“导入阅读包”。

主程序导入入口：`src/features/chapters/BookContentPackageModal.tsx`。导入模式只允许选择 `.readingbook`；导出模式仍支持 `.readingbook` 和 EPUB。

### 阅读内容转换器

负责原始材料到 `.readingbook` 的转换：TXT、Markdown、HTML、DOCX、EPUB、可提取文本 PDF，以及图片和扫描 PDF。

主要入口：

- `src/converter/ConverterApp.tsx`
- `src/converter/main.tsx`
- `vite.converter.config.ts`
- `src-tauri/tauri.converter.conf.json`

转换器使用独立 Tauri identifier `com.readingagent.converter`，AI 配置与主程序当前是独立存储的。图片/扫描 PDF 必须使用转换器自身配置的视觉 AI。

## 转换器分类策略

核心模块：`src/features/chapters/contentClassification.ts`。

1. 本地先逐块分类：页码、选项、答案、解析、题干、已有译文、标题、原文、未知。
2. 选项、答案、解析和页码为锁定块，绝不进入阅读正文或译文。
3. 文件内已有译文优先保留，AI 不得重写。
4. 只有 `unknown` 与低置信度标题候选会调用 `classify_import_blocks`。
5. Rust 接口 `src-tauri/src/ai_workflows.rs` 仅允许 AI 返回 `id`、`blockType`、`confidence`；不得改写、翻译、合并、删除或补写文字。
6. 视觉识别的多页结果先合并为连续材料，再进入统一分类，不能将每页或每段自动视为独立文章。
7. 文本型 PDF 导入会先保留逐页文字，并在前 15 页中寻找目录行；目录标题会优先与正文页首标题匹配，再生成可编辑的 PDF 章节起始页与页段。未匹配到正文标题的页段标为“待确认”，不得静默视为已验证。用户应用页段修正时只重新组装本地文本，不调用 AI，也不改写已有译文。
8. 图片与扫描 PDF 的视觉识别必须忽略手写批注、圈画、箭头、下划线、涂鸦与荧光标记，不得将其转写进正文、译文或题目。手写遮挡印刷文字时，AI 返回受影响页码并标记段落待复核；当前不执行自动擦除，避免损伤正文。
9. 图片与扫描 PDF 的视觉识别会把目录、封面、版权页和索引与正文隔离：目录仅返回 `tocEntries` 作为后续批次上下文，不能混入正文。AI 仅在实际页面出现章节标题时返回 `chapterStarts`；转换器按其真实页面范围组装多个章节，不得仅凭目录页码猜测切章。
10. 扫描 PDF 视觉导入按每批最多 30 页渲染；超过 30 页时，用户须完成当前批识别后点击“读取下一批 PDF 页面”。页面始终携带原始 PDF 页号，供目录上下文、章节起页和手写复核使用。
11. 扫描 PDF 读取下一批页面前，已完成批次的图片会从队列释放，仅保留 `UnifiedImportResult` 中的正文、题目、目录、章节起页和复核页信息；不得因释放图片丢失跨批目录上下文或最终章节组装结果。
12. 扫描 PDF 导入界面应显示已归档页数、当前页段与总页数，明确图片区释放后识别文本仍在本次导入结果中；不得只显示当前队列页数而误导用户。

相关测试：`src/features/chapters/contentClassification.test.ts`。

## `.readingbook` 协议

- `src/features/chapters/bookContentPackage.ts`
- 兼容 v1 与 v2。
- v2 可保存书籍信息、组装章节、文章边界与 `sourceBlocks`。
- `.readingbook` 不包含主程序内高亮、词卡、笔记、学习进度或答题记录；这些属于本地学习数据库和 `.readingbackup` 迁移包。

## 验证状态（2026-08-15）

### 阅读学习体验与 AI 查询修复

- 已修复默认语言标点、图片识别顺序确认、双击首词误选段落号、词典字面 `\n` 换行、题目翻译和已存词卡跳转定位。
- 选词语境精析提供浏览器本地 LRU 缓存、可配置容量和“重新生成”；未保存的查询结果不会被新的已完成结果覆盖。
- AI 查询支持多个选词并发执行：每个请求按文章位置、选词和上下文独立归档；当前选词只显示自己的结果，切回已完成选词可恢复结果。已展示但未保存的结果仍必须保存或关闭后才能切换。
- 本地词典支持短语与常见 `-ing` / `-ed` 还原；AI 语境精析会优先采用 AI 结果，并压缩重复上下文与输出预算以控制调用成本。
- 已新增阅读页 AI 小助手：默认不发送文章内容，用户可主动附带当前选句；支持本机自定义外观、名称、语气、学习偏好，以及按文章保存和清空最近 40 条会话。
- AI 小助手仅保留阅读页桌宠入口；已移除正文标题右侧的机器人图标。桌宠可随意拖动，位置会保存在本机 `localStorage`，点击未拖动的桌宠可打开小助手。
- 已新增浏览器朗读按钮，使用系统英语语音，不依赖网络。
- 图片识别、本地 OCR、语境精析和导出在发起重任务前都会先让浏览器绘制加载状态；本地 OCR 按页顺序执行并在页间让出界面，避免并发 OCR 挤占前端。PDF 导出继续由 Rust 后台线程处理，Word 与单词表导出会先显示生成状态。

### 当前发布状态

- 主程序已发布到 `F:\英语阅读助手\阅读学习助手.exe`，本轮更新于 2026-08-15。
- 当前发布 EXE 已完成启动检查且正在运行；SHA-256 为 `EC9FA94B4BF63989BCB22C30C00614CF735B4E23F01F0526FCBE78F11FAFBAFA`，与 `src-tauri\target\release\reading-agent.exe` 一致。
- 主程序 NSIS 安装包：`src-tauri\target\release\bundle\nsis\阅读学习助手_0.1.1_x64-setup.exe`。

### 本轮验证基线

- `npm.cmd run test:ui`：21 个测试文件、77 个测试通过。
- `npm.cmd run build`：通过。
- `cargo test --manifest-path src-tauri\Cargo.toml`：22 个测试通过。
- `npm.cmd run tauri build -- --bundles nsis`：通过。

本轮主程序清理后已通过：

- `npm.cmd run test:ui`：16 个测试文件、61 个测试通过。
- `npm.cmd run build`：通过。
- 之前新增转换器分类链路时：Rust `cargo test` 20 项通过，转换器 `npm.cmd run build:converter` 通过。

后续同时修改转换器前端和 Rust 时，至少执行：

```powershell
Set-Location 'F:\英语阅读助手\reading-agent'
npm.cmd run test:ui
npm.cmd run build
npm.cmd run build:converter
cargo test --manifest-path src-tauri\Cargo.toml
```

## 打包顺序

转换器和主程序共用同一个 Rust release EXE，必须按以下顺序发布：

1. `npm.cmd run tauri build -- --config src-tauri\tauri.converter.conf.json --bundles nsis`
2. 将 `src-tauri\target\release\reading-agent.exe` 复制为 `F:\英语阅读助手\阅读内容转换器.exe`
3. `npm.cmd run tauri build -- --bundles nsis`
4. 将 `src-tauri\target\release\reading-agent.exe` 复制为 `F:\英语阅读助手\阅读学习助手.exe`

覆盖文件前必须确认对应程序已关闭，不要强制结束用户进程。

## 2026-08-17：阅读辅助浮窗

- 新增 `src/components/FloatingWindow.tsx`，用于不应阻塞阅读的辅助编辑界面：无全屏遮罩、标题栏可拖动、按 `Esc` 可关闭，并会限制拖动位置不超出主窗口可视范围。
- AI 阅读小助手（含桌宠设置页）、词卡编辑、词卡上下文编辑和章节编辑已迁移到浮窗；打开后可以继续查看和滚动下方阅读页面。
- 删除确认、导入确认及其他可能造成数据丢失的窗口继续使用原有 `Modal` 与遮罩，不得迁移为非阻塞浮窗。
- 已新增 `src/components/FloatingWindow.ui.test.tsx`，验证无背景遮罩、可拖动和 `Esc` 关闭。
- 本轮前端验证：`npm.cmd run test:ui` 通过（23 个测试文件、83 项测试）；`npm.cmd run build` 通过。
- 正式主程序已更新：`F:\英语阅读助手\阅读学习助手.exe`，更新时间为 2026-08-17，SHA-256 为 `A7E69294DA572F0E9FB55A59153E90A9B567F477FB83E17CE182365168FD4694`。本轮未更新转换器 EXE。

## 2026-08-17：第二批辅助浮窗源码

- 本地词典资源中心外层已改为可拖动浮窗；其中导入预览和自定义词典删除确认仍使用高层级阻塞式 `Modal`。
- 导出选项已改为可拖动浮窗。
- 第二批修改已通过 `npm.cmd run test:ui`（23 个测试文件、83 项测试）和 `npm.cmd run build`。
- 正式主程序已重新打包并更新：`F:\英语阅读助手\阅读学习助手.exe`，SHA-256 为 `863999EF4DB44FBE82C88DA73FAD3F574D1A84A9441C9709A6E678873D86967D`。启动验证进程 PID 为 `27032`，响应正常；本轮未更新转换器 EXE。

## 2026-08-17：第三批普通窗口浮动化

- 书籍编辑、新建书籍、阅读包导入/导出、显示语言选择、应用设置和新建章节窗口已迁移到 `FloatingWindow`。
- 单章节图片/PDF 识别窗口仍保留原有阻塞式 `Modal`，删除确认和导入预览确认逻辑不变。
- 本轮 `npm.cmd run test:ui` 通过（23 个测试文件、83 项测试），`npm.cmd run build` 通过。
- 正式主程序已重新打包并更新：`F:\英语阅读助手\阅读学习助手.exe`，SHA-256 为 `C9BF12EB344E74D021E84062437E3DA033052DD1F1317FD4C03A45F309FA1E0A`。正式转换器也已更新：`F:\英语阅读助手\阅读内容转换器.exe`，SHA-256 为 `EE32C9670B9D1CBDF3B754A64ABC7B1C73FE0E8995B35AB478869BBC6D1B6411`。启动验证进程：转换器 PID `17324`、主程序 PID `35800`，均响应正常。

## 2026-08-17：识别窗口浮动化源码

- 单章节图片/PDF 识别与转换器批量识别窗口已改为宽型 `FloatingWindow`，不再使用全屏遮罩；识别、排序、目录确认和保存流程保持不变。
- 删除确认、词典导入预览和其他不可逆操作仍使用阻塞式 `Modal`。
- 本轮 `npm.cmd run test:ui` 通过（23 个测试文件、83 项测试），`npm.cmd run build` 通过。
- 该阶段源码尚未覆盖正式 EXE；后续 Windows 工作区适配阶段已完成两个正式 EXE 的重新打包和发布，最新状态以本节后的 Windows 适配记录为准。

## 2026-08-17：Windows 工作区与任务栏适配

- 新增 `src/services/viewportHeight.ts`，根据 `innerHeight` / `visualViewport.height` 同步 `--app-viewport-height`，窗口缩放和可视区域变化时自动更新。
- 主程序、转换器、阅读工作区、浮窗和模态窗口改用动态视口高度，不再依赖固定 `100vh` 计算。
- 两个 Tauri 窗口初始尺寸调整为 `1200×760`，最小尺寸调整为 `960×560`，降低小屏幕和任务栏工作区被撑破的概率。
- 本轮验证：`npm.cmd run test:ui` 通过（24 个测试文件、84 项测试）；`npm.cmd run build`、`npm.cmd run build:converter`、`cargo check --manifest-path src-tauri\Cargo.toml` 均通过。
- 正式转换器已更新：`F:\英语阅读助手\阅读内容转换器.exe`，SHA-256 为 `22E2540A79B8B50E78AF5B37E0EFE0BFA5D4F4A49B15A1421C7A87FF72FCFE1C`。
- 正式主程序已更新：`F:\英语阅读助手\阅读学习助手.exe`，SHA-256 为 `30C893B8F292456335F1CB5699C9859A9C5E4DB55870B55C7FAE84E16B01C970`。
- 启动验证进程：转换器 PID `13408`、主程序 PID `25692`，均响应正常。
- 后续回归：`cargo test --manifest-path src-tauri\Cargo.toml` 通过，22 项测试全部通过；2026-08-17 再次核对两个正式 EXE 哈希一致，当前无遗留运行进程。

## 2026-08-17：桌宠按问题自动选择阅读上下文

- 新增 `src/features/assistant/assistantContext.ts`：本地先判断问题属于选句、当前段落、当前章节或非正文学习问题，不额外调用 AI 做分类。
- 阅读页通过 `IntersectionObserver` 跟踪当前可见段落；桌宠请求会携带 `contextScope`，并只发送必要范围的正文。
- 词汇/翻译/语法问题优先发送当前选句；段落理解问题发送当前段落及译文；章节总结问题发送受限长度的当前章节；学习方法问题不发送正文。
- 桌宠界面会显示“已引用当前句”或“本次将引用：当前段落/当前章节”。
- `AssistantChatInput` 已支持上下文范围标签和更大的受限正文上下文；已有 AI 固定教学规则未改变。
- 本轮 `npm.cmd run test:ui` 通过（25 个测试文件、89 项测试）；`npm.cmd run build`、`npm.cmd run build:converter`、`cargo test --manifest-path src-tauri\Cargo.toml` 均通过，Rust 测试 22 项全部通过。
- 正式转换器已更新：`F:\英语阅读助手\阅读内容转换器.exe`，SHA-256 为 `8FCAAF1F9ADC1C0A94C0BF9532BC1161BFE650B9D9B04627BD649B6CA4FC5C54`。
- 正式主程序已更新：`F:\英语阅读助手\阅读学习助手.exe`，SHA-256 为 `3738B07DC53468290507132DBF3FEFEF229E86832CB3F5A6ED285399BD63ED0D`。
- 启动验证进程：转换器 PID `30548`、主程序 PID `13444`，均响应正常。

## 推荐新对话提示词

```text
请先阅读 F:\英语阅读助手\reading-agent\CURRENT_HANDOFF.md，严格遵守其中的主程序/转换器职责边界。先检查当前源码与测试状态，再开始修改；不要把原始文件识别和批量 AI 转换重新放回阅读学习助手主程序。
```

## 2026-08-10：扫描 PDF 的 Windows 本地 OCR 缓存

- 扫描 PDF 每批渲染页现在会写入转换器 `AppLocalData\\resource-import-cache` 下独立的 `pdf-ocr-*` 会话目录，并把缓存图片路径提供给 Windows 本地 OCR。
- Windows 本地 OCR 现支持直接导入图片和扫描 PDF，且不再要求配置视觉 AI。
- 读取下一批 PDF 页前会删除上一批页缓存；关闭导入窗口或组件卸载时会删除当前会话缓存。
- Tauri capability 已增加 `fs:allow-remove`，用于受限地清理上述会话目录。

## 2026-08-10：本地 OCR 文章边界修正

- Windows 本地 OCR 不再把每个视觉行当作独立段落；现在按原始页面保留换行并输出一个结构化页面块。
- 本地规则会从页面前几行识别明确章节标题、Title Case 标题或全大写标题，并生成文章起点；连续重复页眉会合并，避免按页拆成重复文章。
- 视觉 AI 识别链路保持不变；本地规则无法确认的边界仍保留在转换器中供用户校对。

## 2026-08-10：扫描 PDF 目录确认阶段

- 扫描 PDF 导入先只渲染前 15 页作为目录预览；正文页不会在目录确认前进入识别流程。
- 用户可提取、增删和编辑目录标题及印刷页码，点击“确认目录并读取正文”后才会重新加载首批正文页并开始识别。
- 已确认目录会作为后续视觉识别的 `tocContext`；Windows 本地 OCR 也会从目录页的引导点与页码行提取候选目录条目。

## 2026-08-10：本地 OCR 高质量输入第一阶段

- PDF 页面仍生成轻量 JPEG 用于界面预览和视觉 AI；同时额外以 2.2 倍缩放渲染无损 PNG，仅写入 Windows 本地 OCR 的会话缓存。
- 这样避免 JPEG 压缩与低分辨率直接损失扫描文字笔画，同时不会增大视觉 AI 请求负载。
- 本地 OCR 调用已抽到 `src/features/import/localOcr.ts`；当前默认 Windows 引擎，后续可在该适配层接入 PaddleOCR 或基于评测数据的微调模型。
- 本阶段尚未训练或捆绑新模型；请用真实错误页建立评测集后再决定模型与微调范围。


## 2026-08-17 桌宠多助手与用户人设

- 桌宠现在支持保存多个用户助手配置，可在聊天栏或设置页随时切换。
- 首次使用只创建一个空人设的默认助手，不由系统预设性格。
- 用户可直接输入最多 8000 字的人设提示词，与形象、精灵图和桌宠称呼分别保存。
- 人设只控制表达方式；开发者固定的学习规则、中文回答、事实边界和上下文策略始终优先。
- 旧版单桌宠设置会自动迁移到默认助手，现有聊天记录仍按文章保存。
- 本轮正式主程序 SHA-256：`1B32AAE5697B80C977F3DB1C898AFCA6849CE66477DE0963B870412020DA9D7E`。


## 2026-08-17 默认人设边界修正

- 将固定学习提示中的默认语气从“温和”改为中性的“清晰、准确、直接”，保证空人设不预设人格。
- 全量前端 89 项、Rust 22 项测试通过。
- 最新正式主程序 SHA-256：`08D9D5E0696DA33CE06D6027D3796D339B31A6BB67F8F6FF17CB6FE20E4E4A28`。

## 2026-08-18：词卡朗读入口与朗读状态

- 新增 `src/features/cards/PronunciationButton.tsx`，统一提供“朗读 / 停止朗读”按钮，并显示当前朗读状态。
- `src/features/cards/pronunciation.ts` 现在维护全局朗读状态；开始朗读新单词前会取消上一个单词，朗读结束或失败后自动恢复为空闲状态。
- 阅读页已建立词卡、复习页词卡详情均可直接朗读，原有选词学习面板入口保留。
- 新增 `src/features/cards/pronunciation.test.ts`，全量前端测试 26 个测试文件、92 项全部通过；`npm.cmd run build` 通过。
- 正式主程序已更新：`F:\英语阅读助手\阅读学习助手.exe`，SHA-256 为 `EF99773634C57A18BC8AD9DDAA051A4E7CE3BFAC440EA4050E023B7A92A2FB35`。
- 转换器未改动：`F:\英语阅读助手\阅读内容转换器.exe`，SHA-256 仍为 `8FCAAF1F9ADC1C0A94C0BF9532BC1161BFE650B9D9B04627BD649B6CA4FC5C54`。
- 构建仍有既有的大 chunk 警告，不影响本次功能；尚未替代 Windows 系统语音引擎。

## 2026-08-18：朗读音量与英语语音选择优化

- `src/features/cards/pronunciation.ts` 显式设置 `utterance.volume = 1`，并从 Windows 可用语音中优先选择匹配的英语语音。
- 语音选择顺序为：精确匹配 `en-US`，其次匹配同语言族，最后回退到任意 `en-*` 语音。
- 朗读测试已覆盖最大音量和英语语音选择；定向测试 2 项通过，生产构建通过。
- 正式主程序已更新：`F:\英语阅读助手\阅读学习助手.exe`，SHA-256 为 `3EAF43D19C7AD5D0AA37BCD2C591A3FDC1B58B48E1B0A7ACF0143521E4138F4C`。
- 转换器未改动：`F:\英语阅读助手\阅读内容转换器.exe`，SHA-256 仍为 `8FCAAF1F9ADC1C0A94C0BF9532BC1161BFE650B9D9B04627BD649B6CA4FC5C54`。
- 音量仍受 Windows 系统音量、应用音量和扬声器硬件上限影响，软件不会突破系统音量上限。

## 2026-08-23：桌宠消息 Markdown 渲染

- 桌宠消息不再直接以纯文本段落输出；新增 `src/features/assistant/MarkdownMessage.tsx`，对标题、粗体、斜体、行内代码、代码块、列表、引用、分隔线和安全链接进行本地渲染。
- 仅允许 `https://`、`http://` 和 `mailto:` 链接，拒绝 `javascript:` 等危险协议；未接入 `dangerouslySetInnerHTML`，不依赖新增 Markdown 网络包。
- `ReadingAssistantModal` 的历史消息、用户消息、AI 消息和“正在思考”状态均经过 Markdown 渲染。
- 新增 `src/features/assistant/MarkdownMessage.ui.test.tsx`，覆盖常见 Markdown 语义元素和危险链接拒绝。
- 全量前端测试：27 个测试文件、94 项全部通过；`npm.cmd run build` 通过。
- 正式主程序已更新：`F:\英语阅读助手\阅读学习助手.exe`，SHA-256 为 `B2902450F668C8E03155BA7A2C404034497E932630328C8971A34318A6AB2DC1`。
- 转换器未改动：`F:\英语阅读助手\阅读内容转换器.exe`，SHA-256 仍为 `8FCAAF1F9ADC1C0A94C0BF9532BC1161BFE650B9D9B04627BD649B6CA4FC5C54`。
- 构建仍有既有的大 chunk 警告，不影响本次功能。

## 2026-08-23：桌宠大小调整与设置页优化

- `AssistantSettings` 新增每个助手独立保存的 `size` 配置，默认 `92px`，有效范围 `56px` 到 `220px`；旧配置自动回退到默认值。
- 桌宠本体根据当前助手尺寸实时调整自定义精灵图大小，尺寸变化后自动重新限制位置，避免放大后被窗口边界遮挡。
- 桌宠设置页新增大小滑块、像素值显示和实时预览；设置页的信息区分为助手配置、人设提示词、形象导入/精灵图映射、尺寸预览和称呼配置。
- 新增尺寸持久化与范围校验测试；全量前端测试：27 个测试文件、95 项全部通过；`npm.cmd run build` 通过。
- 正式主程序已更新：`F:\英语阅读助手\阅读学习助手.exe`，SHA-256 为 `357869822974CADB6C0E33BC292EA47545C30D94BE9F419D959413EB3702FAFC`。
- 转换器未改动：`F:\英语阅读助手\阅读内容转换器.exe`，SHA-256 仍为 `8FCAAF1F9ADC1C0A94C0BF9532BC1161BFE650B9D9B04627BD649B6CA4FC5C54`。
- 构建仍有既有的大 chunk 警告，不影响本次功能。

## 2026-08-23：桌宠角色档案增强

- `src/features/assistant/companionAppearance.ts` 为每个助手新增身份与背景、与用户的关系、表达风格、互动规则字段；保留完整人设提示词，最大长度调整为 12000 字。
- `ReadingAssistantModal` 设置页改为“角色档案”，默认助手仍为空，用户可填写结构化字段或直接粘贴整段人设；原有多助手、形象、尺寸和删除确认保留。
- 桌宠聊天历史改为按“文章 ID + 助手 ID”隔离；默认助手同时兼容旧版文章级历史键，旧数据不会丢失，自定义助手不会串台。
- `src-tauri/src/ai_workflows.rs` 新增角色档案字段，并将其组成明确的 `【当前桌宠角色档案】` 区块；角色可稳定控制身份、关系、语气、情绪和回答结构，但不能覆盖学习职责、事实边界、安全规则和中文要求。
- 验证通过：前端全量测试 27 个文件、95 项；Rust `cargo check` 通过；前端生产构建通过；NSIS 打包通过。
- 正式主程序已更新：`F:\英语阅读助手\阅读学习助手.exe`，SHA-256：`266800E55F8A23ACCB5CC99A06576BD69A82AF935C1E6888178ABE0BC827C98B`。
- 转换器未修改：`F:\英语阅读助手\阅读内容转换器.exe`，SHA-256：`8FCAAF1F9ADC1C0A94C0BF9532BC1161BFE650B9D9B04627BD649B6CA4FC5C54`。
- 已知风险：AI 是否完全遵循角色仍取决于所选模型；角色设定会被长度限制并经过边界提示约束，不能保证模型执行任何与学习职责冲突的内容。

## 2026-08-23：角色设定改为一段式输入

- 删除桌宠设置页的身份、关系、表达风格和互动规则拆分字段，只保留一个 `完整角色设定` 大文本框，支持一次性粘贴完整人设。
- `AssistantProfile` 仍按每个助手保存 `personaPrompt`；旧配置中遗留的结构化字段会被忽略，不影响原有整段人设和多助手数据。
- 前端请求和 Rust `AssistantChatInput` 已移除结构化角色字段；后端继续将整段人设放入 `【当前桌宠角色设定】` 区块，并保留学习职责、事实边界和安全约束。
- 验证通过：前端全量测试 27 个文件、95 项；前端生产构建通过；Rust `cargo check` 通过；NSIS 打包通过。
- 正式主程序已更新：`F:\英语阅读助手\阅读学习助手.exe`，SHA-256：`D153A967A9AF0A8FE134D5DE8EA991D7E14295EECDD75ECEE43E083A2329A081`。
- 转换器未修改，仍为 `F:\英语阅读助手\阅读内容转换器.exe`。

## 2026-08-24：修复对话未稳定应用角色设定

- 确认前端发送链路会携带当前助手的 `personaPrompt`；新增真实发送测试，验证 `ask_reading_assistant` 请求包含完整角色设定。
- Rust 后端不再把角色设定拼接在固定长系统提示词末尾，而是作为独立的第二条 `system` 消息发送，明确要求每次回复持续遵循身份、称呼、语气、情绪和互动习惯。
- 固定学习规则仍作为第一条 `system` 消息，角色设定不能覆盖学习职责、事实边界、安全规则和中文回答要求。
- 验证通过：桌宠相关前端测试 4 项；Rust 测试 22 项；前端生产构建和 Rust 检查通过；NSIS 打包通过。
- 正式主程序已更新：`F:\英语阅读助手\阅读学习助手.exe`，SHA-256：`A7E2E0DA59035A9AC2BDB6851E67D09F1698864ED1BAC82450904FDA58869C89`。
- 转换器未修改：`F:\英语阅读助手\阅读内容转换器.exe`，SHA-256：`8FCAAF1F9ADC1C0A94C0BF9532BC1161BFE650B9D9B04627BD649B6CA4FC5C54`。

## 2026-08-23：弹窗比例适配与桌宠意图策略

- `src/services/viewportHeight.ts` 同步主窗口实际可视宽度和高度到 `--app-viewport-width`、`--app-viewport-height`，兼容 `visualViewport`。
- `FloatingWindow` 与普通 `Modal` 改为按主窗口比例设置宽高：普通窗口约占 72% 视口宽度，宽型窗口约占 86%，同时设置最小边距、最大高度和窄窗口适配；窗口拖动后在视口变化时自动重新夹回可视范围，减少任务栏或边缘遮挡。
- `src/features/assistant/assistantContext.ts` 新增意图判断：词汇、句子、段落、章节、学习方法和闲聊；修正“这句话是什么意思”优先识别为句子理解，而不是查词。
- 阅读助手请求新增 `contextIntent`；Rust 后端按意图生成本次回答策略：词汇先讲当前句词义，句子先讲自然译文和结构，段落/章节先讲中心与逻辑，学习方法给可执行建议，闲聊不强行套文章模板。
- 验证通过：前端全量测试 27 个文件、97 项；Rust 全量测试 22 项；前端生产构建、Rust 检查和 NSIS 打包通过。
- 正式主程序已更新：`F:\英语阅读助手\阅读学习助手.exe`，SHA-256：`60A84882F3D9630B3BF4C8E574C3889ECE2DC232AD6A239F129665DC4535E080`。
- 转换器未修改：`F:\英语阅读助手\阅读内容转换器.exe`，SHA-256：`8FCAAF1F9ADC1C0A94C0BF9532BC1161BFE650B9D9B04627BD649B6CA4FC5C54`。
- 已知限制：窗口比例基于 Tauri WebView 可视区，系统级任务栏位置由 Windows 工作区决定；AI 回答贴切程度仍受模型能力影响，但当前已将任务意图明确传入后端。
