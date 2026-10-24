# ตลิ่งคลอง · เครื่องมือ ESP32 (ดับเบิลคลิกไอคอน "ตลิ่งคลอง ESP32" บนเดสก์ท็อป หรือ tools\ESP32.bat)
# เมนู: ตรวจสถานะ / ดูข้อความจาก gateway หรือ node / อัปโหลดโค้ดใหม่ / เปิดเว็บ
# บอร์ดแยกด้วยชิป USB: CP210x = gateway (ESP32 Dev Module), FTDI = node (ESP32-WROOM-32)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
$root = Split-Path $PSScriptRoot -Parent
$cli  = Join-Path $env:LOCALAPPDATA 'Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe'
$fqbn = 'esp32:esp32:esp32'
$db   = 'https://taling-map-default-rtdb.asia-southeast1.firebasedatabase.app'
$site = 'https://potitusafe-tech.github.io/taling-map/'

function Find-Boards {
  $ports = Get-CimInstance Win32_PnPEntity -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '\((COM\d+)\)' }
  $r = [ordered]@{ gateway = $null; node = $null }
  foreach ($p in $ports) {
    $com = [regex]::Match($p.Name, 'COM\d+').Value
    if ($p.Name -match 'CP210') { $r.gateway = $com }
    elseif ($p.Name -match 'USB Serial Port|FTDI|FT232') { $r.node = $com }
  }
  $r
}

function Show-Status {
  Write-Host ''
  $b = Find-Boards
  Write-Host ('  gateway (Dev Module): ' + $(if ($b.gateway) { "เสียบอยู่ที่ $($b.gateway)" } else { 'ไม่พบ' })) -ForegroundColor $(if ($b.gateway) { 'Green' } else { 'Yellow' })
  Write-Host ('  node (WROOM-32):      ' + $(if ($b.node) { "เสียบอยู่ที่ $($b.node)" } else { 'ไม่พบ (ถ้าเสียบที่ชาร์จ/พาวเวอร์แบงก์ ก็ไม่ขึ้นตรงนี้ เป็นเรื่องปกติ)' })) -ForegroundColor $(if ($b.node) { 'Green' } else { 'Yellow' })
  try {
    $d = Invoke-RestMethod "$db/stations.json" -TimeoutSec 15
    $rows = @($d.PSObject.Properties | ForEach-Object { $_.Value.time } | Where-Object { $_ })
    $latest = $rows | Sort-Object { try { [datetime]::ParseExact(($_ -split ' \(')[0], 'dd/MM/yyyy HH:mm', $null) } catch { [datetime]::MinValue } } | Select-Object -Last 1
    Write-Host "  ข้อมูลบนเว็บ:          $($rows.Count) สถานี · ล่าสุด $latest" -ForegroundColor Cyan
  } catch { Write-Host '  ข้อมูลบนเว็บ:          อ่าน Firebase ไม่ได้ (เช็กอินเทอร์เน็ต)' -ForegroundColor Red }
  Write-Host ''
}

# บรรทัดที่อ่านออก: อักษรที่พิมพ์ได้/ภาษาไทยเกือบทั้งหมด และมีคำที่บอร์ดเราพิมพ์จริง
function Test-CleanLine([string]$s) {
  if ($s.Length -lt 4) { return $false }
  $bad = ([regex]::Matches($s, '[^\x20-\x7E฀-๿—→↕]')).Count
  if ($bad / $s.Length -gt 0.05) { return $false }
  return $s -match '[฀-๿]|#\d+|Firebase|WiFi|MAC|gateway|node|ESP-NOW|BME280|E \(\d+\)'
}

# อ่านพอร์ตเองแทน serial monitor: ไม่กระตุก DTR/RTS (บอร์ดไม่รีเซ็ต), ทิ้งขยะจากสัญญาณรบกวน, ไม่พิมพ์บรรทัดซ้ำติดกัน
function Watch-Board($role) {
  $b = Find-Boards
  $port = $b[$role]
  if (-not $port) { Write-Host "  ไม่พบบอร์ด $role ที่ต่อกับคอม" -ForegroundColor Yellow; return }
  Write-Host "  กำลังดูข้อความจาก $role ($port)  ·  กด q เพื่อกลับเมนู" -ForegroundColor Cyan
  Write-Host '  gateway ปกติ: "-> Firebase 200"   node ปกติ: "gateway ได้รับ"   (node ส่งเป็นรอบทุก 10 นาที อาจต้องรอ)' -ForegroundColor DarkGray
  $sp = New-Object System.IO.Ports.SerialPort $port, 115200
  $sp.DtrEnable = $false; $sp.RtsEnable = $false
  try { $sp.Open() } catch { Write-Host "  เปิด $port ไม่ได้ (โปรแกรมอื่นใช้อยู่? ปิด Serial Monitor ใน Arduino IDE ก่อน)" -ForegroundColor Red; return }
  Start-Sleep -Milliseconds 300
  $sp.DiscardInBuffer()   # ทิ้งข้อมูลค้างในไดรเวอร์ (ไม่งั้นบางทีขึ้นข้อความซ้ำๆ รัวๆ)
  $buf = New-Object System.Collections.Generic.List[byte]
  $chunk = New-Object byte[] 4096
  $last = ''
  try {
    while ($true) {
      if ([Console]::KeyAvailable -and [Console]::ReadKey($true).KeyChar -eq 'q') { break }
      if ($sp.BytesToRead -gt 0) {
        $n = $sp.Read($chunk, 0, $chunk.Length)
        for ($i = 0; $i -lt $n; $i++) {
          if ($chunk[$i] -eq 10) {
            $line = [Text.Encoding]::UTF8.GetString($buf.ToArray()).Trim()
            $buf.Clear()
            if ($line -ne $last -and (Test-CleanLine $line)) {
              $color = if ($line -match 'Firebase 200|gateway ได้รับ|สำเร็จ|ต่อได้') { 'Green' } elseif ($line -match 'ไม่|error|Error|E \(') { 'Yellow' } else { 'Gray' }
              Write-Host ("  " + (Get-Date -Format 'HH:mm:ss') + "  " + $line) -ForegroundColor $color
              $last = $line
            }
          } elseif ($buf.Count -lt 2000) { $buf.Add($chunk[$i]) } else { $buf.Clear() }
        }
      } else { Start-Sleep -Milliseconds 100 }
    }
  } finally { $sp.Close() }
}

function Upload-Board($role) {
  $b = Find-Boards
  $port = $b[$role]
  if (-not $port) { Write-Host "  ไม่พบบอร์ด $role ที่ต่อกับคอม เสียบสาย USB ก่อน" -ForegroundColor Yellow; return }
  $sketch = Join-Path $root "firmware\taling_$role"
  if ($role -eq 'gateway') {
    $sec = Join-Path $sketch 'secrets.h'
    if (-not (Test-Path $sec) -or (Get-Content $sec -Raw -Encoding UTF8) -match '"ชื่อ WiFi"|"รหัส WiFi"|"รหัสผ่านบัญชีอุปกรณ์"') {
      Write-Host '  ยังไม่ได้กรอก firmware\taling_gateway\secrets.h (ชื่อ/รหัส WiFi 2.4 GHz และรหัสบัญชีอุปกรณ์)' -ForegroundColor Red; return
    }
  }
  Write-Host "  กำลังคอมไพล์และอัปโหลด $role ลง $port (ครั้งแรกอาจนาน 1–3 นาที)..." -ForegroundColor Cyan
  Write-Host '  ถ้าค้างที่ Connecting... ให้กดปุ่ม BOOT บนบอร์ดค้างไว้' -ForegroundColor DarkGray
  & $cli compile --upload -p $port --fqbn $fqbn $sketch 2>&1 | ForEach-Object { "$_" } |
    Where-Object { $_ -match 'Sketch uses|Writing at 0x0001.*100|Hard resetting|error|Error|Failed' } | ForEach-Object { Write-Host "  $_" }
  if ($LASTEXITCODE -eq 0) { Write-Host "  อัปโหลด $role สำเร็จ" -ForegroundColor Green } else { Write-Host "  อัปโหลด $role ไม่สำเร็จ ดูข้อความด้านบน" -ForegroundColor Red }
}

if (-not (Test-Path $cli)) { Write-Host 'ไม่พบ Arduino IDE (ต้องติดตั้ง Arduino IDE 2 ก่อน)' -ForegroundColor Red; Read-Host 'กด Enter เพื่อปิด'; exit 1 }

while ($true) {
  Write-Host '================ ตลิ่งคลอง · ESP32 ================' -ForegroundColor White
  Show-Status
  Write-Host '  1  ตรวจสถานะอีกครั้ง'
  Write-Host '  2  ดูการทำงานของ gateway (ต่อ WiFi / ส่ง Firebase)'
  Write-Host '  3  ดูการทำงานของ node (ส่งถึง gateway ไหม)'
  Write-Host '  4  อัปโหลดโค้ดใหม่ลง gateway'
  Write-Host '  5  อัปโหลดโค้ดใหม่ลง node'
  Write-Host '  6  เปิดเว็บแผนที่'
  Write-Host '  0  ปิด'
  $c = Read-Host 'เลือก'
  switch ($c) {
    '1' { }
    '2' { Watch-Board 'gateway' }
    '3' { Watch-Board 'node' }
    '4' { Upload-Board 'gateway' }
    '5' { Upload-Board 'node' }
    '6' { Start-Process $site }
    '0' { exit 0 }
    default { Write-Host '  พิมพ์ตัวเลข 0–6' -ForegroundColor Yellow }
  }
}
