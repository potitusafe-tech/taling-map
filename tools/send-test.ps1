# ทดสอบส่งค่าระดับน้ำเข้า Firebase แบบเดียวกับ ESP32 (ล็อกอินด้วยบัญชีอุปกรณ์ แล้ว PATCH /stations/<id>.json)
# ใช้:   powershell -ExecutionPolicy Bypass -File tools\send-test.ps1 -StationId 2401-1 -LevelCm 42.5
# ลบค่าทดสอบ: เพิ่ม -Remove
# รหัสผ่านพิมพ์ตอนรัน ไม่ถูกเก็บในไฟล์และไม่แสดงบนจอ

param(
  [string]$StationId = '2401-1',
  [double]$LevelCm = 42.5,
  [switch]$Remove
)

$ErrorActionPreference = 'Stop'
$db = 'https://taling-map-default-rtdb.asia-southeast1.firebasedatabase.app'

$apiKey = Read-Host 'Web API Key (Project settings > General)'
$email = Read-Host 'อีเมลบัญชีอุปกรณ์ [device@taling.local]'
if (-not $email) { $email = 'device@taling.local' }
$secure = Read-Host 'รหัสผ่านบัญชีอุปกรณ์' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $pass = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }

try {
  $login = Invoke-RestMethod -Method Post -ContentType 'application/json' `
    -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$($apiKey.Trim())" `
    -Body (@{ email = $email.Trim(); password = $pass; returnSecureToken = $true } | ConvertTo-Json)
} catch {
  $reason = ''
  try { $reason = ((New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd() | ConvertFrom-Json).error.message } catch {}
  $hint = switch -Wildcard ($reason) {
    'INVALID_LOGIN_CREDENTIALS*' { 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }
    'INVALID_PASSWORD*'          { 'รหัสผ่านไม่ถูกต้อง' }
    'EMAIL_NOT_FOUND*'           { 'ไม่พบอีเมลนี้ในโปรเจกต์ taling-map' }
    'USER_DISABLED*'             { 'บัญชีนี้ถูกปิดใช้งาน' }
    'API key not valid*'         { 'Web API Key ไม่ถูกต้อง' }
    'TOO_MANY_ATTEMPTS*'         { 'ลองผิดหลายครั้งเกินไป รอสักพักแล้วลองใหม่' }
    default                      { 'ดูข้อความจาก Firebase ด้านบน' }
  }
  Write-Host "ล็อกอินไม่สำเร็จ: $reason" -ForegroundColor Red
  Write-Host $hint -ForegroundColor Red
  exit 1
} finally { $pass = $null }
Write-Host "ล็อกอินสำเร็จ  UID ของบัญชีนี้: $($login.localId)" -ForegroundColor Green

$url = "$db/stations/$StationId.json?auth=$($login.idToken)"
if ($Remove) {
  Invoke-RestMethod -Method Delete -Uri $url | Out-Null
  Write-Host "ลบค่าทดสอบของ $StationId แล้ว" -ForegroundColor Yellow
  return
}

$body = @{
  level_cm = $LevelCm
  temp_c   = 29.5
  rh       = 78
  pres_hpa = 1008.5
  batt_v   = 3.95
  time     = (Get-Date -Format 'dd/MM/yyyy HH:mm') + ' (ทดสอบ)'
} | ConvertTo-Json
$res = Invoke-RestMethod -Method Patch -ContentType 'application/json; charset=utf-8' -Uri $url `
  -Body ([Text.Encoding]::UTF8.GetBytes($body))
Write-Host "ส่งแล้ว: $StationId = $LevelCm cm" -ForegroundColor Green
$res | ConvertTo-Json
Write-Host 'เปิดแผนที่ภายใน 30 วินาทีจะเห็นค่านี้: https://potitusafe-tech.github.io/taling-map/'
