// ตลิ่งคลอง · ตัวกลาง (gateway) รับข้อมูลจากสถานีด้วย ESP-NOW แล้วส่งขึ้น Firebase
//
//   [node ที่เสา] --ESP-NOW--> [gateway นี้ ต่อ WiFi] --HTTPS--> Firebase --> หน้าเว็บ
//
// ก่อนอัปโหลด: คัดลอก secrets.example.h เป็น secrets.h แล้วใส่ WiFi / รหัสผ่านบัญชีอุปกรณ์
// อัปโหลดแล้วเปิด Serial Monitor (115200) จด "MAC ของ gateway" ไปใส่ใน GATEWAY_MAC ของ node
// ไลบรารี: ArduinoJson (v7)   บอร์ด: ESP32 Dev Module

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <esp_idf_version.h>
#include <ArduinoJson.h>
#include <time.h>
#include "packet.h"
#include "secrets.h"

// แจ้งเตือน Telegram (ใส่ TG_BOT_TOKEN / TG_CHAT_ID ใน secrets.h ถ้าว่าง = ปิดแจ้งเตือน)
#ifndef TG_BOT_TOKEN
#define TG_BOT_TOKEN ""
#endif
#ifndef TG_CHAT_ID
#define TG_CHAT_ID ""
#endif
const float WARN_CM = 50.0;              // ต้องตรงกับเกณฑ์ "เตือน" บนเว็บ (js/config.js)
const float CRIT_CM = 65.0;              // ต้องตรงกับเกณฑ์ "วิกฤต"
const unsigned long REPEAT_MS = 6UL * 3600 * 1000;   // ยังอยู่ระดับเดิม เตือนซ้ำทุก 6 ชั่วโมง
const char* SITE_URL = "https://potitusafe-tech.github.io/taling-map/";

const uint32_t NET_KEY = 20261023;   // ต้องตรงกับ NET_KEY ของ node
const char* DB_URL  = "https://taling-map-default-rtdb.asia-southeast1.firebasedatabase.app";
const char* API_KEY = "AIzaSyBCwFPOV4NEjiKPrg5fHNWlX3_jmYGS_wQ";   // Web API Key ไม่ใช่ความลับ

struct Incoming { TalingPacket p; int rssi; uint8_t mac[6]; };
QueueHandle_t queue;
String idToken;
unsigned long tokenAt = 0;

// รับจาก node: ตรวจรูปแบบแล้วเข้าคิว (ห้ามส่ง HTTP ใน callback)
void handlePacket(const uint8_t *mac, const uint8_t *data, int len, int rssi) {
  if (len != sizeof(TalingPacket)) return;
  Incoming in;
  memcpy(&in.p, data, sizeof in.p);
  if (in.p.magic != TALING_MAGIC || in.p.netKey != NET_KEY) return;   // ไม่ใช่สถานีของเรา
  in.p.stationId[sizeof in.p.stationId - 1] = 0;
  for (char *c = in.p.stationId; *c; c++) if (!isalnum(*c) && *c != '-' && *c != '_') return;
  in.rssi = rssi;
  memcpy(in.mac, mac, 6);
  xQueueSend(queue, &in, 0);
}

#if ESP_IDF_VERSION_MAJOR >= 5
void onRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  handlePacket(info->src_addr, data, len, info->rx_ctrl ? info->rx_ctrl->rssi : 0);
}
#else
void onRecv(const uint8_t *mac, const uint8_t *data, int len) { handlePacket(mac, data, len, 0); }
#endif

bool signIn() {
  WiFiClientSecure c; c.setInsecure();   // ทดสอบก่อน ติดตั้งจริงควรใส่ root CA
  HTTPClient http;
  http.begin(c, String("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=") + API_KEY);
  http.addHeader("Content-Type", "application/json");
  JsonDocument req;
  req["email"] = DEV_EMAIL; req["password"] = DEV_PASS; req["returnSecureToken"] = true;
  String body; serializeJson(req, body);
  int code = http.POST(body);
  String res = http.getString();
  http.end();
  if (code != 200) { Serial.printf("ล็อกอิน Firebase ไม่สำเร็จ (%d): %s\n", code, res.c_str()); return false; }
  JsonDocument d; deserializeJson(d, res);
  idToken = d["idToken"].as<String>();
  tokenAt = millis();
  Serial.println("ล็อกอิน Firebase สำเร็จ");
  return true;
}

float r1(float v) { return round(v * 10) / 10.0; }

// ---------- แจ้งเตือน Telegram ----------
// เตือนเมื่อระดับ "ขึ้น" เป็นเตือน/วิกฤต, เตือนซ้ำทุก REPEAT_MS ถ้ายังค้าง, และบอกเมื่อกลับมาปกติ
struct AlertState { char id[12]; uint8_t level; unsigned long sentAt; };
AlertState alerts[64];
int alertCount = 0;

uint8_t alertLevel(float cm) { return cm >= CRIT_CM ? 2 : cm >= WARN_CM ? 1 : 0; }

bool sendTelegram(const String &text) {
  WiFiClientSecure c; c.setInsecure();
  HTTPClient http;
  http.begin(c, String("https://api.telegram.org/bot") + TG_BOT_TOKEN + "/sendMessage");
  http.addHeader("Content-Type", "application/json");
  JsonDocument d;
  d["chat_id"] = TG_CHAT_ID;
  d["text"] = text;
  d["disable_web_page_preview"] = true;
  String body; serializeJson(d, body);
  int code = http.POST(body);
  http.end();
  Serial.printf("  Telegram -> %d\n", code);
  return code == 200;
}

void checkAlert(const TalingPacket &p) {
  if (!strlen(TG_BOT_TOKEN) || !strlen(TG_CHAT_ID) || isnan(p.levelCm)) return;
  AlertState *a = nullptr;
  for (int i = 0; i < alertCount; i++) if (!strcmp(alerts[i].id, p.stationId)) { a = &alerts[i]; break; }
  if (!a) {
    if (alertCount >= 64) return;
    a = &alerts[alertCount++];
    strncpy(a->id, p.stationId, sizeof a->id - 1); a->id[sizeof a->id - 1] = 0;
    a->level = 0; a->sentAt = 0;
  }
  uint8_t lv = alertLevel(p.levelCm);
  String msg;
  if (lv > a->level || (lv > 0 && lv == a->level && millis() - a->sentAt > REPEAT_MS)) {
    msg = String(lv == 2 ? "🔴 วิกฤต" : "🟠 เตือน") + " สถานี " + p.stationId +
          "\nระดับน้ำ " + String(p.levelCm, 1) + " cm (เกณฑ์ " + String(lv == 2 ? CRIT_CM : WARN_CM, 0) + " cm)";
  } else if (lv == 0 && a->level > 0) {
    msg = String("🟢 กลับสู่ระดับปกติ สถานี ") + p.stationId + "\nระดับน้ำ " + String(p.levelCm, 1) + " cm";
  }
  if (msg.length()) {
    struct tm t; char ts[20] = "";
    if (getLocalTime(&t, 500)) strftime(ts, sizeof ts, "%d/%m %H:%M", &t);
    msg += String("\nเวลา ") + ts + "\nดูแผนที่: " + SITE_URL;
    if (sendTelegram(msg)) a->sentAt = millis();
  }
  a->level = lv;
}

void upload(const Incoming &in) {
  if (idToken == "" || millis() - tokenAt > 50UL * 60 * 1000) { if (!signIn()) return; }
  const TalingPacket &p = in.p;
  JsonDocument d;
  if (!isnan(p.levelCm)) d["level_cm"] = r1(p.levelCm);
  d["dist_cm"] = p.distCm > 0 ? r1(p.distCm) : -1;
  if (!isnan(p.tempC))   d["temp_c"] = r1(p.tempC);
  if (!isnan(p.rh))      d["rh"] = round(p.rh);
  if (!isnan(p.presHpa)) d["pres_hpa"] = r1(p.presHpa);
  d["batt_v"] = round(p.battV * 100) / 100.0;
  d["l1"] = (p.screws & 1) != 0;
  d["l2"] = (p.screws & 2) != 0;
  d["l3"] = (p.screws & 4) != 0;
  d["seq"] = p.seq;
  d["rssi"] = in.rssi;
  struct tm t;
  if (getLocalTime(&t, 1000)) { char ts[20]; strftime(ts, sizeof ts, "%d/%m/%Y %H:%M", &t); d["time"] = ts; }
  String json; serializeJson(d, json);

  WiFiClientSecure c; c.setInsecure();
  HTTPClient http;
  http.begin(c, String(DB_URL) + "/stations/" + p.stationId + ".json?auth=" + idToken);
  http.addHeader("Content-Type", "application/json");
  int code = http.PATCH(json);
  http.end();
  Serial.printf("%s #%lu (สัญญาณ %d dBm) -> Firebase %d  %s\n", p.stationId, (unsigned long)p.seq, in.rssi, code, json.c_str());
  if (code == 401) idToken = "";
  checkAlert(p);
}

// บอกสาเหตุที่ต่อ WiFi ไม่ได้เป็นภาษาไทย
void printWiFiStatus() {
  switch (WiFi.status()) {
    case WL_CONNECTED:      Serial.printf(" ต่อได้ (IP %s)\n", WiFi.localIP().toString().c_str()); break;
    case WL_NO_SSID_AVAIL:  Serial.println(" ไม่เจอ WiFi ชื่อนี้ — ESP32 ใช้ได้เฉพาะ 2.4 GHz (ชื่อที่ลงท้าย 5G ใช้ไม่ได้)"); break;
    case WL_CONNECT_FAILED: Serial.println(" ต่อไม่ได้ — รหัส WiFi อาจผิด"); break;
    default:                Serial.println(" ต่อไม่ได้ — เช็กชื่อ/รหัส WiFi และต้องเป็น 2.4 GHz"); break;
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);
  queue = xQueueCreate(16, sizeof(Incoming));

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.printf("\ngateway: กำลังต่อ WiFi %s", WIFI_SSID);
  for (int i = 0; i < 60 && WiFi.status() != WL_CONNECTED; i++) { delay(500); Serial.print("."); }
  printWiFiStatus();

  uint8_t mac[6];
  esp_wifi_get_mac(WIFI_IF_STA, mac);
  Serial.printf("MAC ของ gateway (ใส่ใน GATEWAY_MAC ของ node): {0x%02X, 0x%02X, 0x%02X, 0x%02X, 0x%02X, 0x%02X}\n",
    mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  Serial.printf("ช่อง WiFi: %d (node จะหาช่องนี้เอง)\n", WiFi.channel());

  if (esp_now_init() != ESP_OK) { Serial.println("ESP-NOW เริ่มไม่ได้"); return; }
  esp_now_register_recv_cb(onRecv);
  configTime(7 * 3600, 0, "pool.ntp.org", "time.google.com");
  signIn();
  Serial.println("พร้อมรับข้อมูลจาก node");
}

void loop() {
  static unsigned long lastTry = 0;
  if (WiFi.status() != WL_CONNECTED) {
    // ลองต่อใหม่ทุก 30 วินาที (ถี่กว่านี้ ESP32 จะฟ้อง "sta is connecting")
    if (millis() - lastTry > 30000) { lastTry = millis(); Serial.print("WiFi หลุด กำลังต่อใหม่..."); WiFi.reconnect(); }
    delay(500);
    return;
  }
  Incoming in;
  if (xQueueReceive(queue, &in, pdMS_TO_TICKS(500)) == pdTRUE) upload(in);
}
