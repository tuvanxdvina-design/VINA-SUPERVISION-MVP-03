$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationFramework

$appName = 'VINA-SUPERVISION'
$appUrl = 'https://desktop-e9suj00.tailc548b7.ts.net/'

function Find-Edge {
  $paths = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')
  )
  return $paths | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
}

function Find-TailscaleGui {
  $paths = @(
    (Join-Path $env:ProgramFiles 'Tailscale\tailscale-ipn.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Tailscale\tailscale-ipn.exe')
  )
  return $paths | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
}

$edge = Find-Edge
if (-not $edge) {
  [System.Windows.MessageBox]::Show('Khong tim thay Microsoft Edge. Hay cap nhat Windows/Edge.', $appName, 'OK', 'Error') | Out-Null
  exit 1
}

try {
  $response = Invoke-WebRequest -UseBasicParsing -Uri ($appUrl + 'health') -TimeoutSec 10
  if ($response.StatusCode -ne 200) { throw 'May chu khong san sang.' }
} catch {
  $tailscaleGui = Find-TailscaleGui
  if ($tailscaleGui) { Start-Process $tailscaleGui }
  $message = @'
Chua ket noi duoc may chu VINA.

1. Mo Tailscale o goc phai thanh tac vu.
2. Chon Log in/Connect va dang nhap dung mang Tailscale cua don vi.
3. Cho den khi Tailscale bao Connected, sau do mo lai VINA.

Neu Tailscale da Connected ma van loi, lien he quan tri de kiem tra quyen tham gia mang.
'@
  [System.Windows.MessageBox]::Show($message, $appName + ' - Chua ket noi', 'OK', 'Warning') | Out-Null
  exit 2
}

Start-Process $edge -ArgumentList ('--app="' + $appUrl + '" --start-maximized')
