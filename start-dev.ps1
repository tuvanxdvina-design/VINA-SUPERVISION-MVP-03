$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendRoot = Join-Path $projectRoot 'backend'
$webRoot = Join-Path $projectRoot 'web-public'
$logRoot = Join-Path $projectRoot 'runtime-logs'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
New-Item -ItemType Directory -Path $webRoot -Force | Out-Null
foreach ($fileName in @('index.html', 'api.js', 'favicon.ico', 'sw.js', 'assets\vicoad-logo.png', 'assets\mau-bang-tien-do.xlsx')) {
    New-Item -ItemType Directory -Path (Split-Path (Join-Path $webRoot $fileName)) -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $projectRoot $fileName) -Destination (Join-Path $webRoot $fileName) -Force
}

function Test-Http([string]$url) {
    try {
        return Invoke-RestMethod -Uri $url -TimeoutSec 2
    } catch {
        return $null
    }
}

function Wait-Http([string]$url, [int]$seconds) {
    for ($attempt = 0; $attempt -lt $seconds; $attempt++) {
        $result = Test-Http $url
        if ($result) { return $result }
        Start-Sleep -Seconds 1
    }
    return $null
}

Push-Location $projectRoot
try {
    docker compose up -d --wait postgres
    if ($LASTEXITCODE -ne 0) { throw 'Cannot start PostgreSQL with Docker Compose.' }

    # Tu dong ap dung migration CSDL moi (sao luu truoc neu co migration chua chay)
    & (Join-Path $projectRoot 'migrate-db.ps1') -AutoBackup
    if (-not $?) { throw 'Migration CSDL loi - xem thong bao phia tren. Backend chua duoc khoi dong.' }

    # Phien ban ma nguon hien tai (backend/src/build.js). Neu backend dang chay ban cu -> tu khoi dong lai.
    $buildFile = Get-Content (Join-Path $backendRoot 'src\build.js') -Raw
    $expectedBuild = if ($buildFile -match "BUILD:\s*'([^']+)'") { $Matches[1] } else { '' }
    $health = Test-Http 'http://127.0.0.1:3001/health'
    if ($health -and $expectedBuild -and $health.build -ne $expectedBuild) {
        Write-Host "Backend dang chay phien ban cu ($($health.build)) - khoi dong lai sang $expectedBuild ..."
        $owners = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($procId in $owners) {
            $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
            if ($proc -and $proc.ProcessName -eq 'node') { Stop-Process -Id $procId -Force }
            elseif ($proc) { throw "Cong 3001 dang bi chuong trinh khac chiem: $($proc.ProcessName)" }
        }
        for ($i = 0; $i -lt 10 -and (Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue); $i++) { Start-Sleep -Seconds 1 }
        $health = $null
    }
    if (-not $health) {
        if (Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue) {
            throw 'Port 3001 is already in use.'
        }
        $node = (Get-Command node -ErrorAction Stop).Source
        if (-not (Test-Path (Join-Path $backendRoot 'node_modules'))) {
            throw 'Missing backend/node_modules. Run npm ci in backend first.'
        }
        Start-Process -FilePath $node -ArgumentList 'server.js' -WorkingDirectory $backendRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot 'backend.out.log') -RedirectStandardError (Join-Path $logRoot 'backend.err.log') | Out-Null
        $health = Wait-Http 'http://127.0.0.1:3001/health' 20
    }
    if (-not $health -or $health.status -ne 'OK' -or $health.database -ne 'connected') {
        throw 'Backend is not ready or PostgreSQL is disconnected. See runtime-logs/backend.err.log.'
    }
    if ($expectedBuild -and $health.build -ne $expectedBuild) {
        throw "Backend van chay phien ban $($health.build), can $expectedBuild. Hay tat tien trinh node thu cong roi chay lai."
    }
    Write-Host "Backend phien ban $($health.build) - migration cho: $(@($health.migrations_pending).Count)" 

    $frontend = Test-Http 'http://127.0.0.1:8080/'
    if (-not $frontend) {
        if (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue) {
            throw 'Port 8080 is already in use.'
        }
        $python = (Get-Command python -ErrorAction Stop).Source
        Start-Process -FilePath $python -ArgumentList '-m','http.server','8080','--bind','127.0.0.1','--directory',$webRoot -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot 'frontend.out.log') -RedirectStandardError (Join-Path $logRoot 'frontend.err.log') | Out-Null
        $frontend = Wait-Http 'http://127.0.0.1:8080/' 10
    }
    if (-not $frontend) { throw 'Frontend is not ready. See runtime-logs/frontend.err.log.' }
    if ($frontend -notmatch 'VINA-SUPERVISION MVP-02') {
        throw 'Port 8080 is serving a different application.'
    }
    try {
        $privateResponse = Invoke-WebRequest 'http://127.0.0.1:8080/backend/.env' -Method Head -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        if ($privateResponse.StatusCode -eq 200) { throw 'Port 8080 exposes private project files.' }
    } catch [System.Net.WebException] {
        if ([int]$_.Exception.Response.StatusCode -ne 404) { throw }
    }

    Write-Host 'VINA-SUPERVISION is ready:'
    Write-Host 'Frontend:  http://localhost:8080/'
    Write-Host 'Backend:   http://localhost:3001/health'
} finally {
    Pop-Location
}
