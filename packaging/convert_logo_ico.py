#!/usr/bin/env python3
"""Convert logo.png to logo.ico for Inno Setup."""
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow not installed. Run: pip install Pillow")
    sys.exit(1)

script_dir = Path(__file__).resolve().parent
installer_dir = script_dir / "installer"
png_path = installer_dir / "logo.png"
ico_path = installer_dir / "logo.ico"

if not png_path.exists():
    # Fallback: copy from static
    static_logo = script_dir.parent / "static" / "logo.png"
    if static_logo.exists():
        import shutil
        shutil.copy(static_logo, png_path)
    else:
        print(f"Error: {png_path} not found")
        sys.exit(1)

img = Image.open(png_path).convert("RGBA")
# ICO needs multiple sizes for Windows
sizes = [(256, 256), (48, 48), (32, 32), (16, 16)]
img.save(ico_path, format="ICO", sizes=sizes)
print(f"Created: {ico_path}")
