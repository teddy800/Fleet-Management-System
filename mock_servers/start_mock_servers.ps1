# PowerShell script to start both mock servers
# Run this in PowerShell: .\start_mock_servers.ps1

Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 59) -ForegroundColor Cyan
Write-Host "🚀 Starting Mock Servers for MESSOB Fleet Management" -ForegroundColor Green
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 59) -ForegroundColor Cyan
Write-Host ""

# Check if Python is installed
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python not found. Please install Python 3.8+" -ForegroundColor Red
    exit 1
}

# Check if Flask is installed
$flaskInstalled = python -c "import flask" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Flask not found. Installing dependencies..." -ForegroundColor Yellow
    pip install -r requirements.txt
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Dependencies installed" -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting servers..." -ForegroundColor Cyan
Write-Host ""

# Start HR Mock Server in new window
Write-Host "🏢 Starting HR Mock Server on port 5000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "python hr_mock_server.py"

# Wait a bit
Start-Sleep -Seconds 2

# Start GPS Mock Server in new window
Write-Host "🛰️  Starting GPS Mock Server on port 5001..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "python gps_mock_server.py"

Write-Host ""
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 59) -ForegroundColor Cyan
Write-Host "✅ Mock Servers Started!" -ForegroundColor Green
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 59) -ForegroundColor Cyan
Write-Host ""
Write-Host "📍 HR Mock Server:  http://localhost:5000" -ForegroundColor Cyan
Write-Host "📍 GPS Mock Server: http://localhost:5001" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔧 To configure in Odoo:" -ForegroundColor Yellow
Write-Host "   Settings → Technical → System Parameters" -ForegroundColor White
Write-Host ""
Write-Host "   Key: mesob.hr_sync_url" -ForegroundColor White
Write-Host "   Value: http://localhost:5000/api/employees" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Key: mesob.gps_gateway_url" -ForegroundColor White
Write-Host "   Value: http://localhost:5001/api/vehicles" -ForegroundColor Cyan
Write-Host ""
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 59) -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to stop servers..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Stop servers (close windows)
Write-Host "Stopping servers..." -ForegroundColor Yellow
Get-Process | Where-Object {$_.MainWindowTitle -like "*hr_mock_server*" -or $_.MainWindowTitle -like "*gps_mock_server*"} | Stop-Process
Write-Host "✅ Servers stopped" -ForegroundColor Green
