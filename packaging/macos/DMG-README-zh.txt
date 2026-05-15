COCO Visualizer — macOS 首次安装（未做 Apple 公证时的推荐方式）

【推荐 · 最少步骤】
1. 双击打开本 DMG。
2. 双击「安装到用户应用程序.command」。
3. 等待终端窗口显示「安装完成」；应用会出现在你的「用户/应用程序」文件夹（路径：~/Applications），并已尝试去掉系统隔离标记。

若系统提示「无法打开」脚本本身：对「安装到用户应用程序.command」右键 → 打开 → 仍要打开。

【备选 · 手动拖移】
1. 把左侧 COCO-Visualizer.app 拖到右侧「应用程序」。
2. 打开「应用程序」，对 COCO Visualizer 图标右键 → 打开，首次在对话框中选「打开」。

【仍被拦截时】
打开「终端」，执行（整行复制）：

xattr -dr com.apple.quarantine "$HOME/Applications/COCO-Visualizer.app"

若你安装到了系统「应用程序」目录，把路径改为 /Applications/COCO-Visualizer.app
