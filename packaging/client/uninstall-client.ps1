$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName PresentationFramework
$expected = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Programs\VINA-SUPERVISION'))
$installDir = [IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
if ($installDir -ne $expected) { throw 'Tu choi go cai dat ngoai thu muc VINA-SUPERVISION du kien.' }

Remove-Item -LiteralPath (Join-Path ([Environment]::GetFolderPath('Desktop')) 'VINA-SUPERVISION.lnk') -Force
Remove-Item -LiteralPath (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\VINA-SUPERVISION.lnk') -Force
Remove-Item -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\VINA-SUPERVISION' -Recurse -Force
Start-Process cmd.exe -WindowStyle Hidden -ArgumentList ('/c timeout /t 2 /nobreak >nul & rmdir /s /q "' + $installDir + '"')
[System.Windows.MessageBox]::Show('Da go VINA-SUPERVISION khoi may tinh. Tailscale duoc giu lai de khong anh huong ung dung khac.', 'VINA-SUPERVISION', 'OK', 'Information') | Out-Null
