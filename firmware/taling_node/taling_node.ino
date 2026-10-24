// ตลิ่งคลอง · สถานีวัด (node) ส่งข้อมูลให้ตัวกลางด้วย ESP-NOW (ไม่ต้องมี WiFi ที่เสา)
//
//   [node ที่เสา] --ESP-NOW--> [gateway ที่มี WiFi] --HTTPS--> Firebase --> หน้าเว็บ
//
// ก่อนอัปโหลด:
//   1. อัปโหลด taling_gateway ก่อน แล้วดู MAC ของ gateway ใน Serial Monitor
//   2. ใส่ MAC นั้นใน GATEWAY_MAC ด้านล่าง และ NET_KEY ให้ตรงกับ gateway
//   3. TEST_MODE = 1 ส่งค่าจำลองได้เลยโดยไม่ต้องต่อเซนเซอร์ (ไว้ทดสอบการส่ง)
// ไลบรารี: Adafruit BME280 Library, Adafruit Unified Sensor   บอร์ด: ESP32 Dev Module

#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <esp_idf_version.h>
#include <Wire.h>
#include <Adafruit_BME280.h>
#include "packet.h"

// ---------- ค่าที่แก้ ----------
#define TEST_MODE 1                         // 1 = สุ่มค่า (ไม่ต้องต่อเซนเซอร์), 0 = อ่านเซนเซอร์จริง
#define TEST_ALL_STATIONS 0                 // โหมดสุ่ม: 1 = วนส่งแทนทุกสถานีบนเว็บ, 0 = ส่งเฉพาะ STATION_ID
const char* STATION_ID = "2401-1";          // ต้องตรงกับรหัสในวงเล็บบนเว็บ
uint8_t GATEWAY_MAC[6] = {0x20, 0x9B, 0xA9, 0x7C, 0xDA, 0x44};   // MAC ของ gateway (บอร์ด ESP32 ตัวแรกที่ต่อ COM4) เปลี่ยนถ้าใช้บอร์ดอื่น
const uint32_t NET_KEY = 20261023;          // ตัวเลขลับร่วมกับ gateway
const float SENSOR_HEIGHT_CM = 140.0;       // 90 cm + ความสูงตลิ่ง h
const int   SEND_EVERY_SEC = TEST_MODE ? 5 : 30;   // โหมดสุ่ม: ส่งทุก 5 วินาที (ใช้งานจริง 30 วินาที)

// รหัสสถานีบนเว็บ (ใช้ตอน TEST_ALL_STATIONS)
const char* TEST_IDS[] = {"2401-1","2401-2","2402-1","2402-2","2403-1","2403-2","2404-1","2404-2","2405-1","2405-2","2406-1",
                          "2406-2","2407-1","2407-2","2408-1","2408-2","2409-1","2409-2","2410-1","2410-2","2411-1","2411-2"};
const int TEST_COUNT = sizeof(TEST_IDS) / sizeof(TEST_IDS[0]);

// ---------- ขา ----------
const int PIN_TRIG = 5, PIN_ECHO = 18;      // JSN-SR04T (Echo 5V ต้องแบ่งแรงดันเหลือ 3.3V)
const int PIN_L1 = 32, PIN_L2 = 33, PIN_L3 = 25;   // สกรู (สายกลาง GND อยู่ต่ำกว่า L1, เปียก = LOW)
const int PIN_BATT = 34;  const float BATT_DIVIDER = 2.0;

Adafruit_BME280 bme;
bool bmeOk = false;
uint32_t seq = 0;
uint8_t channel = 1;                        // ช่องที่ gateway อยู่ (หาเองอัตโนมัติ)
volatile int lastStatus = -1;               // 1 = gateway ได้รับ, 0 = ไม่ได้รับ

#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 5, 0)
void onSent(const wifi_tx_info_t *info, esp_now_send_status_t status) { lastStatus = status == ESP_NOW_SEND_SUCCESS; }
#else
void onSent(const uint8_t *mac, esp_now_send_status_t status) { lastStatus = status == ESP_NOW_SEND_SUCCESS; }
#endif

float readDistanceCm() {
  float v[7]; int n = 0;
  for (int i = 0; i < 7; i++) {
    digitalWrite(PIN_TRIG, LOW);  delayMicroseconds(5);
    digitalWrite(PIN_TRIG, HIGH); delayMicroseconds(20);
    digitalWrite(PIN_TRIG, LOW);
    unsigned long us = pulseIn(PIN_ECHO, HIGH, 30000);
    float d = us * 0.0343 / 2.0;
    if (us && d > 20 && d < 450) v[n++] = d;
    delay(60);
  }
  if (!n) return -1;
  for (int i = 1; i < n; i++) for (int j = i; j > 0 && v[j] < v[j - 1]; j--) { float t = v[j]; v[j] = v[j - 1]; v[j - 1] = t; }
  return v[n / 2];
}

float rnd(float lo, float hi) { return lo + (hi - lo) * (random(10001) / 10000.0); }

void fillPacket(TalingPacket &p) {
  memset(&p, 0, sizeof p);
  p.magic = TALING_MAGIC;
  p.netKey = NET_KEY;
  p.seq = ++seq;
#if TEST_MODE
  strncpy(p.stationId, TEST_ALL_STATIONS ? TEST_IDS[(seq - 1) % TEST_COUNT] : STATION_ID, sizeof p.stationId - 1);
  // สุ่มแบบสมจริง: ส่วนใหญ่ปกติ บางที่เฝ้าระวัง/เตือน นานๆ ครั้งวิกฤต
  long roll = random(100);
  float level = roll < 55 ? rnd(5, 30) : roll < 80 ? rnd(30, 50) : roll < 93 ? rnd(50, 65) : rnd(65, 98);
  p.levelCm = level;  p.distCm = SENSOR_HEIGHT_CM - level;
  p.tempC = rnd(26, 34);  p.rh = rnd(60, 95);  p.presHpa = rnd(1005, 1012);  p.battV = rnd(3.6, 4.15);
  p.screws = (level >= 65 ? 1 : 0) | (level >= 80 ? 2 : 0) | (level >= 95 ? 4 : 0);
#else
  strncpy(p.stationId, STATION_ID, sizeof p.stationId - 1);
  float dist = readDistanceCm();
  p.distCm = dist;
  p.levelCm = dist > 0 ? SENSOR_HEIGHT_CM - dist : NAN;
  p.tempC   = bmeOk ? bme.readTemperature() : NAN;
  p.rh      = bmeOk ? bme.readHumidity() : NAN;
  p.presHpa = bmeOk ? bme.readPressure() / 100.0 : NAN;
  uint32_t mv = 0; for (int i = 0; i < 8; i++) mv += analogReadMilliVolts(PIN_BATT);
  p.battV = mv / 8.0 * BATT_DIVIDER / 1000.0;
  p.screws = (digitalRead(PIN_L1) == LOW ? 1 : 0) | (digitalRead(PIN_L2) == LOW ? 2 : 0) | (digitalRead(PIN_L3) == LOW ? 4 : 0);
#endif
}

// ส่ง 1 ครั้งบนช่องปัจจุบัน แล้วรอผลจาก gateway
bool sendOnce(const TalingPacket &p) {
  lastStatus = -1;
  if (esp_now_send(GATEWAY_MAC, (const uint8_t *)&p, sizeof p) != ESP_OK) return false;
  for (int i = 0; i < 50 && lastStatus < 0; i++) delay(2);
  return lastStatus == 1;
}

void setChannel(uint8_t ch) {
  esp_wifi_set_promiscuous(true);
  esp_wifi_set_channel(ch, WIFI_SECOND_CHAN_NONE);
  esp_wifi_set_promiscuous(false);
  channel = ch;
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.printf("\nnode %s เริ่มทำงาน (%s)\n", STATION_ID, TEST_MODE ? "โหมดทดสอบ: ค่าจำลอง" : "อ่านเซนเซอร์จริง");
  pinMode(PIN_TRIG, OUTPUT); pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_L1, INPUT_PULLUP); pinMode(PIN_L2, INPUT_PULLUP); pinMode(PIN_L3, INPUT_PULLUP);
  analogSetPinAttenuation(PIN_BATT, ADC_11db);
  randomSeed(esp_random());
#if !TEST_MODE
  Wire.begin(21, 22);
  bmeOk = bme.begin(0x76) || bme.begin(0x77);
  Serial.println(bmeOk ? "BME280: พบ" : "BME280: ไม่พบ");
#endif

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  if (esp_now_init() != ESP_OK) { Serial.println("ESP-NOW เริ่มไม่ได้"); return; }
  esp_now_register_send_cb(onSent);
  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, GATEWAY_MAC, 6);
  peer.channel = 0;          // 0 = ใช้ช่องปัจจุบัน
  peer.encrypt = false;
  esp_now_add_peer(&peer);
  setChannel(1);
}

void loop() {
  TalingPacket p;
  fillPacket(p);
  bool ok = sendOnce(p);
  if (!ok) {
    // gateway อยู่ช่องเดียวกับ WiFi ของมัน ไล่หาช่อง 1–13 จนเจอ
    Serial.print("หา gateway ");
    for (uint8_t ch = 1; ch <= 13 && !ok; ch++) {
      setChannel(ch); Serial.print(ch); Serial.print(' ');
      ok = sendOnce(p);
    }
    Serial.println();
  }
  Serial.printf("%s #%lu ระดับ %.1f cm  สกรู L1%c L2%c L3%c  -> %s (ช่อง %u)\n",
    p.stationId, (unsigned long)p.seq, p.levelCm, p.screws & 1 ? '*' : '-', p.screws & 2 ? '*' : '-', p.screws & 4 ? '*' : '-',
    ok ? "gateway ได้รับ" : "ไม่พบ gateway (เช็ก GATEWAY_MAC / gateway เปิดอยู่ไหม)", channel);
  delay(SEND_EVERY_SEC * 1000UL);
}
