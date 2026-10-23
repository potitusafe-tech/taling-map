// รูปแบบข้อมูลที่สถานี (node) ส่งให้ตัวกลาง (gateway) ผ่าน ESP-NOW
// ต้องเหมือนกันทั้งสองฝั่ง: firmware/taling_node/packet.h และ firmware/taling_gateway/packet.h
#pragma once
#include <stdint.h>

#define TALING_MAGIC 0x544C4B31UL   // "TLK1"

typedef struct __attribute__((packed)) {
  uint32_t magic;          // TALING_MAGIC
  uint32_t netKey;         // ต้องตรงกับ NET_KEY ของ gateway ไม่งั้นถูกทิ้ง
  char     stationId[12];  // เช่น "2401-1"
  uint32_t seq;            // นับขึ้นทีละ 1 ทุกครั้งที่ส่ง
  float    levelCm;        // ระดับน้ำเหนือระดับต่ำสุด (NAN = วัดไม่ได้)
  float    distCm;         // ระยะเซนเซอร์ถึงผิวน้ำ (-1 = วัดไม่ได้)
  float    tempC;          // NAN = ไม่มี BME280
  float    rh;
  float    presHpa;
  float    battV;
  uint8_t  screws;         // bit0 = L1, bit1 = L2, bit2 = L3 (1 = เปียก)
} TalingPacket;
