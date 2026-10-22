// ---------- ข้อมูลสถานี ----------
// ไฟล์ข้อมูลล้วน แก้ค่าในนี้ได้เลย (หรือวาง stations.json ข้าง index.html เพื่อแทนที่ข้อมูลชุดนี้)

// สถานี: แก้ lat / lon เป็นพิกัดจริงของจุดที่ปักเสา แล้วลบ sample: true
// หรือวางไฟล์ stations.json ไว้ข้างไฟล์นี้ (รูปแบบเดียวกัน) หน้าจะอ่านและรีเฟรชทุก 30 วินาที
// อำเภอละ 2 สถานี วางบนคลอง/แม่น้ำจาก OpenStreetMap (ตำแหน่งและค่าจำลองทั้งหมด)
// bank = ลักษณะตลิ่ง 1 ลาด, 2 ชัน, 3 กำแพงคอนกรีต, 4 ขั้นบันได, 5 สองช่วง (ตอนนี้สุ่มไว้)
// "ลำน้ำไม่ทราบชื่อ" คือลำน้ำที่ OpenStreetMap ยังไม่มีชื่อ แก้ name เป็นชื่อจริงได้เลย
let STATIONS = [
  { id: '2401-1', name: 'แม่น้ำบางปะกง', lat: 13.6692, lon: 101.0758, level_cm: 34.2, min_cm: 0.0, time: '22 ต.ค. 2026 22:00', temp_c: 29.4, rh: 78, pres_hpa: 1008.6, batt_v: 3.92, bank: 4, sample: true },
  { id: '2401-2', name: 'คลองขวาง', lat: 13.7371, lon: 100.9557, level_cm: 21.5, min_cm: 0.0, time: '22 ต.ค. 2026 22:00', temp_c: 29.5, rh: 77, pres_hpa: 1008.6, batt_v: 3.96, bank: 5, sample: true },
  { id: '2402-1', name: 'แม่น้ำบางปะกง (ตอนบน)', lat: 13.8526, lon: 101.1624, level_cm: 44.8, min_cm: 0.0, time: '22 ต.ค. 2026 22:00', temp_c: 29.0, rh: 80, pres_hpa: 1008.4, batt_v: 3.87, bank: 1, sample: true },
  { id: '2402-2', name: 'แม่น้ำบางปะกง (ตอนล่าง)', lat: 13.7533, lon: 101.1955, level_cm: 41.5, min_cm: 0.0, time: '22 ต.ค. 2026 22:00', temp_c: 29.1, rh: 80, pres_hpa: 1008.5, batt_v: 3.88, bank: 3, sample: true },
  { id: '2403-1', name: 'คลองแพรกบางลาย', lat: 13.8386, lon: 101.0272, level_cm: 22.8, min_cm: 0.0, time: '22 ต.ค. 2026 22:00', temp_c: 29.6, rh: 76, pres_hpa: 1008.7, batt_v: 3.97, bank: 4, sample: true },
  { id: '2403-2', name: 'คลองกลาง', lat: 13.8118, lon: 100.9578, level_cm: 18.1, min_cm: 0.0, time: '22 ต.ค. 2026 22:00', temp_c: 29.6, rh: 75, pres_hpa: 1008.7, batt_v: 4.00, bank: 2, sample: true },
  { id: '2404-1', name: 'แม่น้ำบางปะกง', lat: 13.4928, lon: 101.0168, level_cm: 52.6, min_cm: 0.0, time: '22 ต.ค. 2026 22:00', temp_c: 29.9, rh: 82, pres_hpa: 1008.9, batt_v: 3.85, bank: 3, sample: true },
  { id: '2404-2', name: 'คลองใหม่', lat: 13.4833, lon: 100.9354, level_cm: 27.4, min_cm: 0.0, time: '22 ต.ค. 2026 22:00', temp_c: 30.0, rh: 83, pres_hpa: 1009.0, batt_v: 3.93, bank: 5, sample: true },
  { id: '2405-1', name: 'แม่น้ำบางปะกง', lat: 13.5875, lon: 101.0745, level_cm: 38.0, min_cm: 0.0, time: '22 ต.ค. 2026 22:00', temp_c: 29.7, rh: 81, pres_hpa: 1008.8, batt_v: 3.90, bank: 5, sample: true },
  { id: '2405-2', name: 'คลองประเวศบุรีรมย์', lat: 13.6403, lon: 101.0186, level_cm: 31.2, min_cm: 0.0, time: '22 ต.ค. 2026 22:00', temp_c: 29.6, rh: 79, pres_hpa: 1008.8, batt_v: 3.94, bank: 2, sample: true },
  { id: '2406-1', name: 'คลองท่าลาด', lat: 13.6978, lon: 101.4326, level_cm: 12.4, min_cm: 0.0, time: '22 ต.ค. 2026 22:00', temp_c: 28.7, rh: 74, pres_hpa: 1008.2, batt_v: 4.01, bank: 1, sample: true },
  { id: '2406-2', name: 'คลองโพธิ์', lat: 13.7436, lon: 101.3550, level_cm: 8.3, min_cm: 0.0, time: '22 ต.ค. 2026 22:00', temp_c: 28.8, rh: 74, pres_hpa: 1008.2, batt_v: 4.02, bank: 1, sample: true },
  { id: '2407-1', name: 'ลำน้ำไม่ทราบชื่อ 1', lat: 13.8416, lon: 101.2599, level_cm: 18.9, min_cm: 0.0, time: '22 ต.ค. 2026 22:00', temp_c: 28.9, rh: 75, pres_hpa: 1008.3, batt_v: 3.95, bank: 4, sample: true },
  { id: '2407-2', name: 'ลำน้ำไม่ทราบชื่อ 2', lat: 13.7709, lon: 101.2925, level_cm: 14.6, min_cm: 0.0, time: '22 ต.ค. 2026 22:00', temp_c: 28.9, rh: 75, pres_hpa: 1008.3, batt_v: 3.98, bank: 4, sample: true },
  { id: '2408-1', name: 'คลองท่าลาด', lat: 13.6736, lon: 101.4487, level_cm: 9.6, min_cm: 0.0, time: '22 ต.ค. 2026 22:00', temp_c: 28.2, rh: 72, pres_hpa: 1008.0, batt_v: 4.03, bank: 5, sample: true },
  { id: '2408-2', name: 'ห้วยกล่ำ', lat: 13.5319, lon: 101.5015, level_cm: 6.2, min_cm: 0.0, time: '22 ต.ค. 2026 22:00', temp_c: 28.1, rh: 71, pres_hpa: 1007.9, batt_v: 4.04, bank: 2, sample: true },
  { id: '2409-1', name: 'คลองวังกะจะ', lat: 13.5481, lon: 101.2836, level_cm: 15.3, min_cm: 0.0, time: '22 ต.ค. 2026 22:00', temp_c: 28.5, rh: 73, pres_hpa: 1008.1, batt_v: 3.99, bank: 2, sample: true },
  { id: '2409-2', name: 'คลองเจริญสุข', lat: 13.6046, lon: 101.3027, level_cm: 11.0, min_cm: 0.0, time: '22 ต.ค. 2026 22:00', temp_c: 28.6, rh: 73, pres_hpa: 1008.1, batt_v: 4.00, bank: 4, sample: true },
  { id: '2410-1', name: 'คลองตะเกรา', lat: 13.3702, lon: 101.6848, level_cm: 7.1, min_cm: 0.0, time: '22 ต.ค. 2026 22:00', temp_c: 27.9, rh: 70, pres_hpa: 1007.8, batt_v: 4.05, bank: 3, sample: true },
  { id: '2410-2', name: 'ลำน้ำไม่ทราบชื่อ', lat: 13.4065, lon: 101.7786, level_cm: 5.4, min_cm: 0.0, time: '22 ต.ค. 2026 22:00', temp_c: 27.8, rh: 70, pres_hpa: 1007.8, batt_v: 4.06, bank: 3, sample: true },
  { id: '2411-1', name: 'แม่น้ำบางปะกง', lat: 13.7112, lon: 101.1465, level_cm: 67.3, min_cm: 0.0, time: '22 ต.ค. 2026 22:00', temp_c: 29.3, rh: 79, pres_hpa: 1008.6, batt_v: 3.81, bank: 2, sample: true },
  { id: '2411-2', name: 'คลองชลประทาน', lat: 13.8002, lon: 101.1765, level_cm: 36.7, min_cm: 0.0, time: '22 ต.ค. 2026 22:00', temp_c: 29.2, rh: 78, pres_hpa: 1008.5, batt_v: 3.91, bank: 1, sample: true }
];
