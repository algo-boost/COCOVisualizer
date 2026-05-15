# 安装包发布指南

本文档说明如何在 GitHub 上管理 COCO Visualizer 的安装包发布。

## 发布方式

### 方式一：通过版本标签发布（推荐）

1. **更新版本号**  
   修改 `version.txt` 中的版本号（如 `1.0.0`）。

2. **同步 Inno Setup 版本**  
   编辑 `packaging/installer/coco_visualizer.iss`，将 `#define MyAppVersion` 与 `version.txt` 保持一致。

3. **提交并推送标签**
   ```bash
   git add version.txt packaging/installer/coco_visualizer.iss
   git commit -m "chore: bump version to x.x.x"
   git push origin main
   git tag v1.0.0
   git push origin v1.0.0
   ```

4. **自动构建与发布**  
   GitHub Actions 会在推送标签后自动：
   - 构建 Windows 安装包（ZIP + Setup.exe）
   - 创建 Release 并上传安装包
   - 生成 Release Notes

### 方式二：手动触发构建

1. 打开仓库的 **Actions** 页面。
2. 选择 **Release** 工作流。
3. 点击 **Run workflow**。
4. （可选）填写版本号，留空则使用 `version.txt` 中的版本。
5. 点击 **Run workflow** 开始构建。

手动构建会生成预发布（Pre-release），标签格式为 `v1.0.0-manual.xxx`，便于区分正式发布。

### 方式三：推送到 main 自动发版

每次向 **`main` / `master`** 推送会触发 **Push build** 工作流：构建 Windows / macOS 安装包，并创建 **正式 Release**（非 Pre-release），标签形如 `v1.7.3-ci.<run_id>`，且会标记为仓库 **Latest**，便于 `/releases/latest` 与应用内「检查更新」指向最近一次 main 构建。

## 发布产物

每次成功发布后，可在 [Releases](../../releases) 页面下载：

| 文件 | 说明 |
|------|------|
| `COCO-Visualizer-mac-<版本>.dmg` | macOS 磁盘映像（内含 `.app` 与一键安装脚本） |
| `COCO-Visualizer-Windows-x64-<版本>.zip` | Windows 便携版 |
| `COCO-Visualizer-Setup-<版本>.exe` | Windows Inno Setup 安装程序 |

## Homebrew Cask（macOS）

仓库根目录 **`Casks/coco-visualizer.rb`** 供用户：

```bash
brew tap algo-boost/coco-visualizer https://github.com/algo-boost/COCOVisualizer.git
brew install --cask algo-boost/coco-visualizer/coco-visualizer
```

**发版时请同步**：`Casks/coco-visualizer.rb` 中的 **`version`** 与 **`version.txt`**、GitHub 上 **`v{version}`** Release 中的 DMG 文件名 **`COCO-Visualizer-mac-{version}.dmg`** 三者一致。可选：将 DMG 的 `shasum -a 256` 写入 Cask 的 `sha256` 字段以通过更严格的 `brew audit`。

## 本地构建

若需在本地构建安装包：

```powershell
# 仅生成 ZIP
.\packaging\build.ps1

# 生成 ZIP + Setup.exe（需安装 Inno Setup 6）
.\packaging\build.ps1 -CreateInstaller
```

## 注意事项

- 确保 `dist/` 已在 `.gitignore` 中，构建产物不纳入版本控制。
- 正式发布请使用 `v*.*.*` 形式的语义化版本标签。
- Inno Setup 6 下载：https://jrsoftware.org/isinfo.php
