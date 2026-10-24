// คัดลอกไฟล์นี้เป็น secrets.h (อยู่โฟลเดอร์เดียวกัน) แล้วใส่ค่าจริง
// secrets.h ถูกกันไม่ให้ขึ้น GitHub ด้วย .gitignore — ห้าม commit รหัสผ่าน
#pragma once

#define WIFI_SSID "ชื่อ WiFi"
#define WIFI_PASS "รหัส WiFi"

// บัญชีอุปกรณ์ใน Firebase Authentication
#define DEV_EMAIL "device@taling.local"
#define DEV_PASS  "รหัสผ่านบัญชีอุปกรณ์"

// แจ้งเตือน Telegram (ไม่ใช้ก็ลบ 2 บรรทัดนี้ หรือปล่อยว่าง "")
// TG_BOT_TOKEN: จาก @BotFather   TG_CHAT_ID: เลขแชทที่จะรับแจ้งเตือน (ดูวิธีใน README)
#define TG_BOT_TOKEN ""
#define TG_CHAT_ID   ""
