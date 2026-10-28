# Capture screenshots using headless Chrome on port 8080
$artifactDir = "C:\Users\arvpr\.gemini\antigravity\brain\e9067e90-a871-436e-8528-dc8a694f798d"
$screenshotDir = Join-Path $PSScriptRoot "screenshots"
if (!(Test-Path $screenshotDir)) { New-Item -ItemType Directory -Path $screenshotDir | Out-Null }

$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (!(Test-Path $chrome)) {
  $chrome = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
}

# Start server process on port 8080
$env:PORT = "8080"
$proc = Start-Process node -ArgumentList "server.js" -PassThru -NoNewWindow
Start-Sleep -Seconds 3

$views = @(
  @{ name = "01_signed_out"; url = "http://localhost:8080/report" },
  @{ name = "02_login_modal"; url = "http://localhost:8080/report?modal=login" },
  @{ name = "03_report_form"; url = "http://localhost:8080/report?auth=student" },
  @{ name = "04_duplicate_prompt"; url = "http://localhost:8080/report?auth=student&test=duplicate" },
  @{ name = "05_my_reports_timeline"; url = "http://localhost:8080/my-reports?auth=student&modal=detail&id=1" },
  @{ name = "06_staff_triage"; url = "http://localhost:8080/staff/admin?auth=admin" },
  @{ name = "07_heatmap_drilldown"; url = "http://localhost:8080/staff/admin/heatmap?auth=admin&drilldown=Block%201" }
)

foreach ($v in $views) {
  # Desktop 1366x768
  $destDesktop = Join-Path $screenshotDir "$($v.name)_desktop_1366.png"
  Start-Process $chrome -ArgumentList "--headless=new", "--screenshot=$destDesktop", "--window-size=1366,768", "--virtual-time-budget=2500", "$($v.url)" -Wait
  if (Test-Path $destDesktop) {
    Copy-Item $destDesktop (Join-Path $artifactDir "$($v.name)_desktop_1366.png") -Force
    Write-Host "Captured desktop: $($v.name)"
  }

  # Mobile 375x812
  $destMobile = Join-Path $screenshotDir "$($v.name)_mobile_375.png"
  Start-Process $chrome -ArgumentList "--headless=new", "--screenshot=$destMobile", "--window-size=375,812", "--virtual-time-budget=2500", "$($v.url)" -Wait
  if (Test-Path $destMobile) {
    Copy-Item $destMobile (Join-Path $artifactDir "$($v.name)_mobile_375.png") -Force
    Write-Host "Captured mobile: $($v.name)"
  }
}

# Stop server process
Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
Write-Host "All screenshots captured successfully!"
