param([switch]$KeepSed)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$sourceDir = Join-Path $root 'packaging\client'
$distDir = Join-Path $root 'dist'
$releaseDir = Join-Path $distDir 'release'
$target = Join-Path $releaseDir 'VINA-Client-Setup-2026-10-14.4.exe'
$tempTarget = Join-Path $env:TEMP ('VINA-Client-Build-' + [guid]::NewGuid().ToString('N') + '.exe')
$iexpress = Join-Path $env:WINDIR 'System32\iexpress.exe'
if (-not (Test-Path -LiteralPath $iexpress)) { throw 'Khong tim thay IExpress cua Windows.' }
New-Item -ItemType Directory -Path $distDir -Force | Out-Null
New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null

$sed = Join-Path $env:TEMP ('vina-client-' + [guid]::NewGuid().ToString('N') + '.sed')
$sourceWithSlash = $sourceDir.TrimEnd('\') + '\'
$content = @"
[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=1
HideExtractAnimation=0
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=
DisplayLicense=
FinishMessage=
TargetName=%TargetName%
FriendlyName=%FriendlyName%
AppLaunched=%AppLaunched%
PostInstallCmd=%PostInstallCmd%
AdminQuietInstCmd=%AdminQuietInstCmd%
UserQuietInstCmd=%UserQuietInstCmd%
SourceFiles=SourceFiles
[Strings]
TargetName="$tempTarget"
FriendlyName="VINA-SUPERVISION Client"
AppLaunched="powershell.exe -NoProfile -ExecutionPolicy Bypass -File install-client.ps1"
PostInstallCmd="<None>"
AdminQuietInstCmd=
UserQuietInstCmd=
FILE0="install-client.ps1"
FILE1="uninstall-client.ps1"
FILE2="app-icon.ico"
FILE3="launch-client.ps1"
[SourceFiles]
SourceFiles0=$sourceWithSlash
[SourceFiles0]
%FILE0%=
%FILE1%=
%FILE2%=
%FILE3%=
"@
try {
  Set-Content -LiteralPath $sed -Value $content -Encoding ASCII
  Remove-Item -LiteralPath $tempTarget -Force -ErrorAction SilentlyContinue
  $process = Start-Process -FilePath $iexpress -ArgumentList @('/N', '/Q', $sed) -Wait -PassThru
  for ($attempt = 0; $attempt -lt 30 -and -not (Test-Path -LiteralPath $tempTarget); $attempt++) { Start-Sleep -Milliseconds 500 }
  if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $tempTarget)) {
    $KeepSed = $true
    Write-Host "SED debug: $sed"
    throw "IExpress khong tao duoc bo cai (exit=$($process.ExitCode))."
  }
  Start-Sleep -Seconds 2
  Copy-Item -LiteralPath $tempTarget -Destination $target -Force
  Remove-Item -LiteralPath $tempTarget -Force -ErrorAction SilentlyContinue
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $target).Hash
  Set-Content -LiteralPath (Join-Path $releaseDir 'SHA256.txt') -Value ((Split-Path $target -Leaf) + '  ' + $hash) -Encoding ASCII
  Write-Host "Da tao: $target"
  Write-Host "SHA256: $hash"
} finally {
  if (-not $KeepSed) { Remove-Item -LiteralPath $sed -Force -ErrorAction SilentlyContinue }
}
