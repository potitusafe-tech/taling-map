// โหลดใน <head> ก่อนส่วนอื่น เพื่อให้สีโหมดมืด/สว่างถูกตั้งแต่เปิดหน้า (ไม่กะพริบ)
// โหมดที่เลือกไว้ครั้งก่อน (ไม่มี = ตามระบบ)
const darkMQ = window.matchMedia('(prefers-color-scheme: dark)');
try { const t = localStorage.getItem('theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) {}
function isDark() { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : darkMQ.matches; }
