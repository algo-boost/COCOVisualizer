; COCO Visualizer - Inno Setup 安装脚本
; 需要先运行 packaging/build.ps1 完成 PyInstaller 打包，再执行此脚本
; 或直接运行: .\packaging\build.ps1 -CreateInstaller

#define MyAppName "COCO Visualizer"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "COCO Visualizer"
#define MyAppURL "https://github.com"
#define MyAppExeName "COCO-Visualizer.exe"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
SetupIconFile=logo.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..\..\dist
OutputBaseFilename=COCO-Visualizer-Setup-{#MyAppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

[Languages]
; 仅使用英文，避免缺失 ChineseSimplified.isl 导致编译失败
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; 使用 PyInstaller 输出的 COCO-Visualizer 目录（exe 及 _internal 等）
Source: "..\..\dist\COCO-Visualizer\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
