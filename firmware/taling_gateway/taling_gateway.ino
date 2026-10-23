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
}

void setup() {
  Serial.begin(115200);
  delay(300);
  queue = xQueueCreate(16, sizeof(Incoming));

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.printf("\ngateway: กำลังต่อ WiFi %s", WIFI_SSID);
  for (int i = 0; i < 60 && WiFi.status() != WL_CONNECTED; i++) { delay(500); Serial.print("."); }
  Serial.println(WiFi.status() == WL_CONNECTED ? " ต่อได้" : " ต่อไม่ได้ (เช็กชื่อ/รหัส WiFi)");

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
  if (WiFi.status() != WL_CONNECTED) { WiFi.reconnect(); delay(2000); return; }
  Incoming in;
  if (xQueueReceive(queue, &in, pdMS_TO_TICKS(500)) == pdTRUE) upload(in);
}
