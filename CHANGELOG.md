# 更新记录

发版时 GitHub Actions 会按 `version.txt` 截取本节中对应 `## [x.y.z]` 写入 Release 说明。

## [1.6.0] - 2026-05-11

### 修复

- **Windows / CI**：Inno Setup 使用 `ISCC /DMyAppVersion=<version.txt>`，安装包文件名与版本号一致；编译失败或未安装 Inno 时 **build.ps1 非零退出**，避免静默失败导致无 Release。
- **Windows**：在运行 PyInstaller **之前** 生成 `logo.ico`，安装包与 `.exe` 恢复自定义图标（此前仅在 Inno 步骤才生成 ico，导致可执行文件为默认图标）。
- **macOS**：由 `static/logo.png` 生成 `logo.icns`，写入 `.app` / DMG；保留 `LSBackgroundOnly=false`，避免双击无前台反应。
- **依赖**：`numpy` / `pandas` 版本范围兼容 Python 3.12，CI 与本机打包可稳定安装。
- **打包**：关闭 UPX 压缩，降低个别环境下可执行文件异常的概率。

### 说明

- macOS 未做 Apple 公证，若被拦截请对 `.app` **右键 → 打开**，或对已拷贝的 `.app` 执行 `xattr -cr`。

## [1.4.7] 及更早

见该版本标签时的提交说明与历史记录。
