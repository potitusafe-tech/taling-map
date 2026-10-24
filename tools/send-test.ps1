# ทดสอบส่งค่าระดับน้ำเข้า Firebase แบบเดียวกับ ESP32 (ล็อกอินด้วยบัญชีอุปกรณ์ แล้ว PATCH /stations/<id>.json)
# ใช้:   powershell -ExecutionPolicy Bypass -File tools\send-test.ps1 -StationId 2401-1 -LevelCm 42.5
# ลบค่าทดสอบ: เพิ่ม -Remove
# ทุกสถานีพร้อมกัน: -All (สุ่มระดับวิกฤต 66–95 cm ถ้าไม่ใส่ -LevelCm)  ลบทั้งหมด: -All -Remove
# สุ่มทุกค่าแบบสมจริง: -All -Random (ระดับน้ำ อุณหภูมิ ความชื้น ความกดอากาศ แบต สกรู)
#
# รันอัตโนมัติ (เช่น ทุกชั่วโมงด้วย Task Scheduler) โดยไม่ต้องพิมพ์รหัสทุกครั้ง:
#   1. -SaveLogin  ครั้งเดียว: พิมพ์รหัสผ่าน แล้วเก็บแบบเข้ารหัสของ Windows (เปิดได้เฉพาะผู้ใช้ Windows คนนี้ บนเครื่องนี้)
#   2. -UseSavedLogin  ใช้รหัสที่เก็บไว้ ไม่ถามอะไร และเขียนผลลง %APPDATA%\taling\send.log
# รหัสผ่านไม่ถูกเก็บในไฟล์โปรเจกต์ และไม่แสดงบนจอ

param(
  [string]$StationId = '2401-1',
  [double]$LevelCm = 42.5,
  [switch]$Remove,
  [switch]$All,
  [switch]$Random,
  [switch]$SaveLogin,
  [switch]$UseSavedLogin
)

$ErrorActionPreference = 'Stop'
$db = 'https://taling-map-default-rtdb.asia-southeast1.firebasedatabase.app'
# Web API Key ของ Firebase ไม่ใช่ความลับ (ระบุแค่ว่าเป็นโปรเจกต์ไหน)
$apiKey = 'AIzaSyBCwFPOV4NEjiKPrg5fHNWlX3_jmYGS_wQ'
$store = Join-Path $env:APPDATA 'taling'
$loginFile = Join-Path $store 'device-login.xml'
$logFile = Join-Path $store 'send.log'

function Log($msg, $color = 'Gray') {
  Write-Host $msg -ForegroundColor $color
  if ($UseSavedLogin) { Add-Content -Path $logFile -Value ((Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '  ' + $msg) -Encoding UTF8 }
}
New-Item -ItemType Directory -Force -Path $store | Out-Null

# ---------- บัญชีอุปกรณ์ ----------
if ($UseSavedLogin) {
  if (-not (Test-Path $loginFile)) { Log 'ยังไม่ได้บันทึกรหัส: รัน send-test.ps1 -SaveLogin ก่อน' Red; exit 1 }
  $cred = Import-Clixml $loginFile
} else {
  $email = Read-Host 'อีเมลบัญชีอุปกรณ์ [device@taling.local]'
  if (-not $email) { $email = 'device@taling.local' }
  do {
    $secure = Read-Host 'รหัสผ่านบัญชีอุปกรณ์ (พิมพ์แล้วจะไม่ขึ้นบนจอ)' -AsSecureString
    if ($secure.Length -eq 0) { Write-Host 'ยังไม่ได้พิมพ์รหัสผ่าน ลองใหม่' -ForegroundColor Yellow }
  } while ($secure.Length -eq 0)
  $cred = New-Object System.Management.Automation.PSCredential($email.Trim(), $secure)
}

$pass = $cred.GetNetworkCredential().Password
try {
  $login = Invoke-RestMethod -Method Post -ContentType 'application/json' `
    -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$apiKey" `
    -Body (@{ email = $cred.UserName; password = $pass; returnSecureToken = $true } | ConvertTo-Json)
} catch {
  $reason = ''
  try { $reason = ((New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd() | ConvertFrom-Json).error.message } catch { $reason = $_.Exception.Message }
  $hint = switch -Wildcard ($reason) {
    'INVALID_LOGIN_CREDENTIALS*' { 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }
    'INVALID_PASSWORD*'          { 'รหัสผ่านไม่ถูกต้อง' }
    'EMAIL_NOT_FOUND*'           { 'ไม่พบอีเมลนี้ในโปรเจกต์ taling-map' }
    'USER_DISABLED*'             { 'บัญชีนี้ถูกปิดใช้งาน' }
    'MISSING_PASSWORD*'          { 'ยังไม่ได้พิมพ์รหัสผ่าน' }
    'TOO_MANY_ATTEMPTS*'         { 'ลองผิดหลายครั้งเกินไป รอสักพักแล้วลองใหม่' }
    default                      { 'เช็กอินเทอร์เน็ต หรือดูข้อความด้านบน' }
  }
  Log "ล็อกอินไม่สำเร็จ: $reason ($hint)" Red
  exit 1
} finally { $pass = $null }
Log "ล็อกอินสำเร็จ  UID: $($login.localId)" Green

if ($SaveLogin) {
  $cred | Export-Clixml -Path $loginFile
  Log "บันทึกรหัสแบบเข้ารหัสไว้ที่ $loginFile แล้ว (ใช้ได้เฉพาะผู้ใช้ Windows นี้บนเครื่องนี้)" Green
  if (-not $All -and -not $PSBoundParameters.ContainsKey('StationId')) { return }
}

# ---------- รายชื่อสถานี ----------
if ($All) {
  $src = Get-Content (Join-Path $PSScriptRoot '..\data\stations.js') -Raw -Encoding UTF8
  $ids = [regex]::Matches($src, "id:\s*'([A-Za-z0-9_-]+)'") | ForEach-Object { $_.Groups[1].Value }
} else { $ids = @($StationId) }
$criticalLevel = $All -and -not $Random -and -not $PSBoundParameters.ContainsKey('LevelCm')

function RandVal($min, $max, $digits = 1) { [math]::Round((Get-Random -Minimum ([double]$min) -Maximum ([double]$max)), $digits) }

$sent = 0
foreach ($id in $ids) {
  $url = "$db/stations/$id.json?auth=$($login.idToken)"
  if ($Remove) {
    Invoke-RestMethod -Method Delete -Uri $url | Out-Null
    Log "ลบค่าทดสอบของ $id แล้ว" Yellow
    continue
  }
  if ($Random) {
    # ส่วนใหญ่ปกติ บางสถานีเฝ้าระวัง/เตือน และนานๆ ครั้งวิกฤต
    $roll = Get-Random -Minimum 0 -Maximum 100
    $level = if ($roll -lt 55) { RandVal 5 30 } elseif ($roll -lt 80) { RandVal 30 50 } elseif ($roll -lt 93) { RandVal 50 65 } else { RandVal 65 98 }
    $body = [ordered]@{
      level_cm = $level
      dist_cm  = [math]::Round(140 - $level, 1)
      temp_c   = RandVal 26 34
      rh       = [int](RandVal 60 95 0)
      pres_hpa = RandVal 1005 1012
      batt_v   = RandVal 3.6 4.15 2
      l1       = $level -ge 65
      l2       = $level -ge 80
      l3       = $level -ge 95
      time     = (Get-Date -Format 'dd/MM/yyyy HH:mm') + ' (สุ่ม)'
    }
  } else {
    $level = if ($criticalLevel) { RandVal 66 95 } else { $LevelCm }
    $body = [ordered]@{
      level_cm = $level
      temp_c   = 29.5
      rh       = 78
      pres_hpa = 1008.5
      batt_v   = 3.95
      time     = (Get-Date -Format 'dd/MM/yyyy HH:mm') + ' (ทดสอบ)'
    }
  }
  $json = $body | ConvertTo-Json
  Invoke-RestMethod -Method Patch -ContentType 'application/json; charset=utf-8' -Uri $url `
    -Body ([Text.Encoding]::UTF8.GetBytes($json)) | Out-Null
  $sent++
  Write-Host "ส่งแล้ว: $id = $level cm" -ForegroundColor Green
}
if (-not $Remove) { Log "ส่งครบ $sent สถานี" Green }
