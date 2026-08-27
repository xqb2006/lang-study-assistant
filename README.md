# 阅读学习助手

## v1.0.0

首个正式发布版本包含阅读学习助手与阅读内容转换器两个独立桌面程序。发布包提供 Windows x64 NSIS 安装程序；源码仓库不提交用户数据、AI 配置、OCR 运行时、构建缓存和安装包本体。

本项目由两个本地桌面程序组成，均基于 Tauri 2、React、TypeScript 和 Rust：

- `阅读学习助手.exe`：阅读、查词、译文、题目、词卡、复习、导出和本地词典。
- `阅读内容转换器.exe`：TXT、EPUB、Word、HTML、PDF、图片等原始材料的解析、视觉识别、分类校对和 `.readingbook` 导出。

## 日常流程

1. 原始文件先在 `阅读内容转换器.exe` 中转换并校对。
2. 导出 `.readingbook` 阅读包。
3. 在 `阅读学习助手.exe` 的书架中点击“导入阅读包”。
4. 主程序保留“新建单章节”中的图片/PDF 识别便捷入口；原始电子书、跨章节整理与整书 AI 转换仍由转换器承担。

## 正式程序

```text
F:\英语阅读助手\阅读学习助手.exe
F:\英语阅读助手\阅读内容转换器.exe
```

两个程序都已打包前端资源，不依赖 `127.0.0.1`、`localhost` 或 Vite。

## 开发入口

开始新的开发对话前，优先阅读：

1. `CURRENT_HANDOFF.md`：当前架构、明确边界、验证状态与推荐提示词。
2. `ARCHITECTURE.md`：前后端与数据模块。
3. `CONVERTER_GUIDE.md`：转换器导入、分类和 AI 策略。
4. `DEVELOPMENT_GUIDE.md`、`SESSION_HANDOFF.md`、`PROJECT_STATUS.md`：历史决策记录；若与 `CURRENT_HANDOFF.md` 冲突，以当前交接文档为准。

## 验证与发布

```powershell
Set-Location 'F:\英语阅读助手\reading-agent'
npm.cmd run test:ui
npm.cmd run build
cargo test --manifest-path src-tauri\Cargo.toml
npm.cmd run tauri build -- --bundles nsis
```

发布主程序前确认 `阅读学习助手.exe` 已关闭；不得强制结束用户进程。
