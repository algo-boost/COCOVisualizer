# 更新记录

发版时 GitHub Actions 会按 `version.txt` 截取本节中对应 `## [x.y.z]` 写入 Release 说明。

## [Unreleased]

### 新增

- **Homebrew Cask（macOS）**：仓库根 `Casks/coco-visualizer.rb`，`brew tap algo-boost/coco-visualizer <本仓库 URL>` 后 `brew install --cask …/coco-visualizer`；发版需同步 Cask 内 `version` 与 `v*` DMG。

### 修复

- **检查更新**：`GET .../releases/latest` 在仓库仅有 **Pre-release**（如 CI 自动发版）时 GitHub 返回 404，导致「检查失败」；现失败时回退到 **`/releases` 列表**取最新非草稿版本。默认 API 超时改为 **12s**；支持环境变量 **`COCO_VIZ_GITHUB_API_BASE`**（国内可指向 ghproxy 等 API 反代）。失败时接口返回 **`hint`** 与 **Releases 页链接**，「关于」里可手动打开。
- **使用手册与发行包一致**：应用内「❓ 帮助」改为从 **`docs/用户手册.md`** 经后端 `/api/app/user_manual_sections` 渲染，不再维护一份与 Markdown 脱节的硬编码 JSX；PyInstaller 将 **`docs/`** 打入安装包。

## [1.7.0] - 2026-05-11

### 新增

- **应用内更新提示**：启动后右上角自动检测 GitHub Releases，发现新版本时显示横幅，含 macOS / Windows 直链、Release 详情和国内镜像入口；可关闭并按版本号记忆，下一版再提示。
- **后端接口**：`GET /api/app/version`、`GET /api/app/check_update`；检查结果在内存中缓存 30 分钟，可通过 `?force=1` 强制刷新。
- **可配置环境变量**：`COCO_VIZ_UPDATE_REPO`（owner/repo）、`COCO_VIZ_UPDATE_TIMEOUT`（秒）。
- **README**：新增「下载安装包」「国内镜像加速」「应用内更新提示」三节，便于国内用户快速取得安装包。

### 打包

- `coco_visualizer.spec` 把 `version.txt` 打入 `_MEIPASS`，运行时可读取应用版本（之前 frozen 模式只能拿到 `0.0.0`）。

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
