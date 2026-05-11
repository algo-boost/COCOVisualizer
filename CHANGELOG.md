# 更新记录

发版时 GitHub Actions 会按 `version.txt` 截取本节中对应 `## [x.y.z]` 写入 Release 说明。

## [1.6.0] - 2026-05-11

### 修复

- **Windows / CI**：Inno Setup 使用 `ISCC /DMyAppVersion=<version.txt>`，安装包文件名与版本号一致；编译失败或未安装 Inno 时 **build.ps1 非零退出**，避免静默失败导致无 Release。
- **Windows**：在运行 PyInstaller **之前** 生成 `logo.ico`，安装包与 `.exe` 恢复自定义图标（此前仅在 Inno 步骤才生成 ico，导致可执行文件为默认图标）。
- **macOS**：由 `static/logo.png` 生成 `logo.icns`，写入 `.app` / DMG；保留 `LSBackgroundOnly=false`，避免双击无前台反应。
- **依赖**：`numpy` / `pandas` 版本范围兼容 Python 3.12，CI 与本机打包可稳定安装。
- **打包**：关闭 UPX 压缩，降低个别环境下可执行文件异常的概率。
- **macOS / 签名**：对 `.app` 递归做 ad-hoc 签名，DMG 自身也 ad-hoc 签名并清扩展属性，缓解 Gatekeeper 反复拦截问题。

### 安装说明（macOS）

1. 打开 `.dmg`，把 **COCO-Visualizer.app** 拖到 **「应用程序」**。
2. 第一次启动：在「应用程序」中**右键 `.app` → 打开 → 仍要打开**。  
   之后系统会记住这次授权，**双击直接启动**。
3. 若提示「已损坏 / 来自身份不明的开发者」无法绕过，在终端执行：

   ```bash
   xattr -cr "/Applications/COCO-Visualizer.app"
   ```

   再次双击即可。该应用未做 Apple 付费公证，但已 ad-hoc 签名，可被 Gatekeeper 校验通过。

## [1.4.7] 及更早

见该版本标签时的提交说明与历史记录。
