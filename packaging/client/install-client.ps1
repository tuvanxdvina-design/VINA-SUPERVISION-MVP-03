param([switch]$ValidateOnly)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationFramework

$appName = 'VINA-SUPERVISION'
$appUrl = 'https://desktop-e9suj00.tailc548b7.ts.net/'
$installDir = Join-Path $env:LOCALAPPDATA 'Programs\VINA-SUPERVISION'
$startMenuDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
$desktopDir = [Environment]::GetFolderPath('Desktop')
$iconPath = Join-Path $installDir 'app-icon.ico'

function Show-Info([string]$message) {
  [System.Windows.MessageBox]::Show($message, $appName, 'OK', 'Information') | Out-Null
}

function Find-Edge {
  $paths = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')
  )
  return $paths | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
}

function Find-Tailscale {
  $paths = @(
    (Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Tailscale\tailscale.exe')
  )
  return $paths | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
}

function New-AppShortcut([string]$shortcutPath) {
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $launcher = Join-Path $installDir 'launch-client.ps1'
  $shortcut.Arguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $launcher + '"'
  $shortcut.WorkingDirectory = $installDir
  $shortcut.IconLocation = $iconPath + ',0'
  $shortcut.Description = 'VINA-SUPERVISION - He thong quan ly tu van giam sat'
  $shortcut.Save()
}

try {
  if ([Environment]::OSVersion.Version.Major -lt 10) {
    throw 'VINA-SUPERVISION yeu cau Windows 10 tro len.'
  }

  $edge = Find-Edge
  if (-not $edge) { throw 'Khong tim thay Microsoft Edge. Hay cap nhat Windows/Edge roi chay lai bo cai.' }

  $tailscale = Find-Tailscale
  if ($ValidateOnly) {
    if (-not $tailscale) { throw 'Khong tim thay Tailscale.' }
    $response = Invoke-WebRequest -UseBasicParsing -Uri ($appUrl + 'health') -TimeoutSec 10
    if ($response.StatusCode -ne 200) { throw 'May chu VINA khong phan hoi HTTP 200.' }
    Write-Output "CLIENT_PREREQUISITES_OK edge=$edge tailscale=$tailscale server=$($response.StatusCode)"
    exit 0
  }
  if (-not $tailscale) {
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if (-not $winget) {
      Start-Process 'https://tailscale.com/download/windows'
      throw 'May chua co Tailscale va khong co winget. Trang tai Tailscale da duoc mo; cai xong hay chay lai bo cai VINA.'
    }
    Show-Info 'Bo cai se cai Tailscale chinh thuc. Windows co the hoi quyen quan tri; hay chon Yes.'
    & $winget.Source install --id Tailscale.Tailscale --exact --silent --accept-source-agreements --accept-package-agreements --disable-interactivity
    if ($LASTEXITCODE -ne 0) { throw 'Khong cai duoc Tailscale tu Windows Package Manager.' }
    $tailscale = Find-Tailscale
    if (-not $tailscale) { throw 'Da chay bo cai Tailscale nhung chua tim thay chuong trinh.' }
  }

  New-Item -ItemType Directory -Path $installDir -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'app-icon.ico') -Destination $iconPath -Force
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'uninstall-client.ps1') -Destination (Join-Path $installDir 'uninstall-client.ps1') -Force
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'launch-client.ps1') -Destination (Join-Path $installDir 'launch-client.ps1') -Force

  New-AppShortcut (Join-Path $desktopDir 'VINA-SUPERVISION.lnk')
  New-AppShortcut (Join-Path $startMenuDir 'VINA-SUPERVISION.lnk')

  $uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\VINA-SUPERVISION'
  New-Item -Path $uninstallKey -Force | Out-Null
  Set-ItemProperty -Path $uninstallKey -Name DisplayName -Value $appName
  Set-ItemProperty -Path $uninstallKey -Name DisplayVersion -Value '2026-10-14.4'
  Set-ItemProperty -Path $uninstallKey -Name Publisher -Value 'VINA'
  Set-ItemProperty -Path $uninstallKey -Name DisplayIcon -Value $iconPath
  Set-ItemProperty -Path $uninstallKey -Name UninstallString -Value ('powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $installDir 'uninstall-client.ps1') + '"')
  Set-ItemProperty -Path $uninstallKey -Name NoModify -Value 1 -Type DWord
  Set-ItemProperty -Path $uninstallKey -Name NoRepair -Value 1 -Type DWord

  $tailscaleGui = Join-Path (Split-Path $tailscale -Parent) 'tailscale-ipn.exe'
  if (Test-Path -LiteralPath $tailscaleGui) { Start-Process $tailscaleGui }

  $reachable = $false
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri ($appUrl + 'health') -TimeoutSec 8
    $reachable = $response.StatusCode -eq 200
  } catch {}

  if ($reachable) {
    Show-Info 'Cai dat hoan tat. Bieu tuong VINA-SUPERVISION da co tren Desktop va Start Menu.'
    Start-Process $edge -ArgumentList ('--app="' + $appUrl + '" --start-maximized')
  } else {
    Show-Info 'Da cai VINA-SUPERVISION. Hay bam bieu tuong Tailscale o goc phai thanh tac vu, chon Log in va dang nhap mang cua don vi. Sau do mo bieu tuong VINA tren Desktop.'
  }
} catch {
  [System.Windows.MessageBox]::Show($_.Exception.Message, $appName + ' - Loi cai dat', 'OK', 'Error') | Out-Null
  exit 1
}
