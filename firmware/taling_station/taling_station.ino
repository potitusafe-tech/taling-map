// ตลิ่งคลอง · โค้ดสถานี ESP32
// วัดระยะถึงผิวน้ำ (JSN-SR04T), อากาศ (BME280), สกรูวัดระดับ L1-L3, แบตเตอรี่
// แล้วส่งขึ้น Firebase Realtime Database ที่ /stations/<STATION_ID>.json ทุก SEND_EVERY_SEC
//
// ก่อนอัปโหลด: คัดลอก secrets.example.h เป็น secrets.h แล้วใส่ WiFi / รหัสผ่านบัญชีอุปกรณ์
// ไลบรารีที่ต้องติดตั้ง (Arduino IDE > Library Manager):
//   ArduinoJson (v7), Adafruit BME280 Library, Adafruit Unified Sensor
// บอร์ด: ESP32 Dev Module

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_BME280.h>
#include <time.h>
#include "secrets.h"

// ---------- ค่าที่แก้ตามหน้างาน ----------
const char* STATION_ID = "2401-1";      // ต้องตรงกับรหัสในวงเล็บบนเว็บ
const float SENSOR_HEIGHT_CM = 140.0;   // เซนเซอร์สูงจากระดับน้ำต่ำสุด = 90 cm + h (ตลิ่ง)
const int   SEND_EVERY_SEC = 60;

// ---------- ขา (ESP32 DevKit) ----------
const int PIN_TRIG = 5;     // JSN-SR04T Trig
const int PIN_ECHO = 18;    // JSN-SR04T Echo (ถ้าเลี้ยงเซนเซอร์ 5V ต้องลดแรงดัน Echo เหลือ 3.3V ด้วยตัวต้านทานแบ่งแรงดัน)
const int PIN_L1 = 32;      // สกรู L1 (15 cm เหนือดิน)
const int PIN_L2 = 33;      // สกรู L2 (30 cm)
const int PIN_L3 = 25;      // สกรู L3 (45 cm)
                            // สายกลาง (GND) ต่อกับขั้วที่อยู่ต่ำกว่า L1 เมื่อน้ำท่วมถึงสกรู ขาจะถูกดึงลง LOW = เปียก
const int PIN_BATT = 34;    // แรงดันแบต ผ่านตัวต้านทานแบ่ง 1:2 (เช่น 100k/100k)
const float BATT_DIVIDER = 2.0;
// BME280 ใช้ I2C: SDA = 21, SCL = 22, address 0x76 (บางโมดูลเป็น 0x77)

// ---------- Firebase ----------
const char* DB_URL  = "https://taling-map-default-rtdb.asia-southeast1.firebasedatabase.app";
const char* API_KEY = "AIzaSyBCwFPOV4NEjiKPrg5fHNWlX3_jmYGS_wQ";   // Web API Key ไม่ใช่ความลับ

Adafruit_BME280 bme;
bool bmeOk = false;
String idToken;
unsigned long tokenAt = 0;

// วัดระยะ 1 ครั้ง (cm) คืน -1 ถ้าไม่มีเสียงสะท้อน
float readDistanceOnce() {
  digitalWrite(PIN_TRIG, LOW);  delayMicroseconds(5);
  digitalWrite(PIN_TRIG, HIGH); delayMicroseconds(20);   // JSN-SR04T ต้องการพัลส์ยาวกว่า HC-SR04
  digitalWrite(PIN_TRIG, LOW);
  unsigned long us = pulseIn(PIN_ECHO, HIGH, 30000);     // 30 ms ≈ 5 m
  if (us == 0) return -1;
  return us * 0.0343 / 2.0;
}

// วัด 7 ครั้งแล้วใช้ค่ากลาง (กันคลื่น/สัญญาณรบกวน)
float readDistanceCm() {
  float v[7]; int n = 0;
  for (int i = 0; i < 7; i++) {
    float d = readDistanceOnce();
    if (d > 20 && d < 450) v[n++] = d;   // JSN-SR04T วัดใกล้กว่า ~20 cm ไม่ได้
    delay(60);
  }
  if (n == 0) return -1;
  for (int i = 1; i < n; i++) for (int j = i; j > 0 && v[j] < v[j - 1]; j--) { float t = v[j]; v[j] = v[j - 1]; v[j - 1] = t; }
  return v[n / 2];
}

bool wet(int pin) { return digitalRead(pin) == LOW; }

float readBatteryV() {
  uint32_t mv = 0;
  for (int i = 0; i < 8; i++) mv += analogReadMilliVolts(PIN_BATT);
  return (mv / 8.0) * BATT_DIVIDER / 1000.0;
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("WiFi: กำลังต่อ %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) { delay(500); Serial.print("."); }
  Serial.println(WiFi.status() == WL_CONNECTED ? " ต่อได้" : " ต่อไม่ได้");
}

// ล็อกอินบัญชีอุปกรณ์ ได้ token ใช้ได้ 1 ชั่วโมง
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
  if (code != 200) {
    Serial.printf("ล็อกอินไม่สำเร็จ (%d): %s\n", code, res.c_str());
    return false;
  }
  JsonDocument d; deserializeJson(d, res);
  idToken = d["idToken"].as<String>();
  tokenAt = millis();
  Serial.println("ล็อกอินสำเร็จ");
  return true;
}

void sendReading() {
  if (idToken == "" || millis() - tokenAt > 50UL * 60 * 1000) {
    if (!signIn()) return;
  }

  float dist = readDistanceCm();
  JsonDocument d;
  if (dist > 0) d["level_cm"] = round((SENSOR_HEIGHT_CM - dist) * 10) / 10.0;
  d["dist_cm"] = dist > 0 ? round(dist * 10) / 10.0 : -1;
  if (bmeOk) {
    d["temp_c"]   = round(bme.readTemperature() * 10) / 10.0;
    d["rh"]       = round(bme.readHumidity());
    d["pres_hpa"] = round(bme.readPressure() / 10.0) / 10.0;
  }
  d["l1"] = wet(PIN_L1);
  d["l2"] = wet(PIN_L2);
  d["l3"] = wet(PIN_L3);
  d["batt_v"] = round(readBatteryV() * 100) / 100.0;
  struct tm t;
  if (getLocalTime(&t, 2000)) { char ts[20]; strftime(ts, sizeof ts, "%d/%m/%Y %H:%M", &t); d["time"] = ts; }

  String json; serializeJson(d, json);
  Serial.println("ส่ง: " + json);
  if (dist < 0) Serial.println("เตือน: วัดระยะไม่ได้ (เช็กสาย Trig/Echo หรือหัวเซนเซอร์)");

  WiFiClientSecure c; c.setInsecure();
  HTTPClient http;
  http.begin(c, String(DB_URL) + "/stations/" + STATION_ID + ".json?auth=" + idToken);
  http.addHeader("Content-Type", "application/json");
  int code = http.PATCH(json);
  Serial.printf("Firebase ตอบ %d\n", code);
  if (code == 401) idToken = "";   // token หมดอายุ/ไม่มีสิทธิ์ รอบหน้าล็อกอินใหม่
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.printf("\nสถานี %s เริ่มทำงาน\n", STATION_ID);
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_L1, INPUT_PULLUP);
  pinMode(PIN_L2, INPUT_PULLUP);
  pinMode(PIN_L3, INPUT_PULLUP);
  analogSetPinAttenuation(PIN_BATT, ADC_11db);

  Wire.begin(21, 22);
  bmeOk = bme.begin(0x76) || bme.begin(0x77);
  Serial.println(bmeOk ? "BME280: พบ" : "BME280: ไม่พบ (เช็กสาย SDA/SCL หรือ address)");

  connectWiFi();
  configTime(7 * 3600, 0, "pool.ntp.org", "time.google.com");   // เวลาไทย
}

void loop() {
  connectWiFi();
  if (WiFi.status() == WL_CONNECTED) sendReading();
  delay(SEND_EVERY_SEC * 1000UL);
}
