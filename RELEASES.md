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

## 发布产物

每次成功发布后，可在 [Releases](../../releases) 页面下载：

| 文件 | 说明 |
|------|------|
| `COCO-Visualizer-Windows-x64-x.x.x.zip` | 便携版，解压即用 |
| `COCO-Visualizer-Setup-x.x.x.exe` | Inno Setup 安装程序 |

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
