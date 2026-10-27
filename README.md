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

一条命令完成全部校验与打包（推荐）：

```powershell
Set-Location 'F:\英语阅读助手\reading-agent'
powershell -ExecutionPolicy Bypass -File scripts\build-release.ps1
```

脚本会依次执行类型检查、前端测试、Rust 测试、版本号一致性校验，然后按正确顺序
构建两个程序并输出到 `dist-release\`。安装包位于 `src-tauri\target\release\bundle\nsis\`。

手动分步执行：

```powershell
npm.cmd run typecheck
npm.cmd run test:ui
cargo test --manifest-path src-tauri\Cargo.toml
npm.cmd run tauri build -- --config src-tauri\tauri.converter.conf.json --bundles nsis
npm.cmd run tauri build -- --bundles nsis
```

⚠️ 转换器必须先于主程序构建，且每次打包后需把 `src-tauri\target\release\lang-study-assistant.exe`
复制成对应程序名，否则后一次打包会覆盖前一次的结果。详见 `CURRENT_HANDOFF.md`。

发布前确认目标程序已关闭；不得强制结束用户进程。

## 许可证与隐私

- 本项目基于 [MIT 许可证](LICENSE) 开源。
- AI 功能会将你提交的文本发送至**你自行配置的第三方 AI 服务**，详见 [隐私说明](PRIVACY.md)。
- 不配置 AI 服务时，全部功能可离线使用，所有阅读数据仅保存在本机。

## 安装说明

Windows 安装包**未包含数字签名证书**，首次运行可能出现 SmartScreen「未知发布者」提示。
这是未购买代码签名证书所致，并非文件被篡改。如介意，可从源码自行构建。

