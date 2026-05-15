cask "coco-visualizer" do
  version "1.7.3"
  sha256 :no_check

  # 须与 GitHub Release 资源名一致：release.yml 打 v{version} 标签时上传的 DMG
  url "https://github.com/algo-boost/COCOVisualizer/releases/download/v#{version}/COCO-Visualizer-mac-#{version}.dmg",
      verified: "github.com/algo-boost/"

  name "COCO Visualizer"
  desc "Local COCO dataset visualization, annotation, and EDA"
  homepage "https://github.com/algo-boost/COCOVisualizer"

  depends_on macos: ">= :big_sur"

  app "COCO-Visualizer.app"

  caveats <<~EOS
    若系统提示无法验证开发者：对「应用程序」中的 COCO Visualizer 图标右键 → 打开 → 仍要打开。

    本 Cask 的 version 与下载 URL 需与 GitHub 上以 v#{version} 发布的 DMG 一致；发新版后请执行 brew update 再 brew upgrade --cask coco-visualizer。
    若尚未发布对应 v#{version} 的正式包，可改用「pip install -e .」从源码安装（见 README）。
  EOS
end
