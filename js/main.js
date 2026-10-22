// ---------- เริ่มทำงาน ----------
// ปุ่มแผง, สลับโหมดมืด/สว่าง แล้ววาดทุกอย่างครั้งแรก

// ---------- ปิด/เปิดแท็บ ----------
document.getElementById('close').onclick = () => { document.body.classList.add('closed'); };
document.getElementById('open').onclick = () => { document.body.classList.remove('closed'); };

// ---------- โหมดมืด/สว่าง ----------
// อัตโนมัติ = ตามระบบเครื่อง, เลือกเองแล้วจำไว้ในเบราว์เซอร์นี้
function applyTheme() {
  const d = isDark();
  if (!map.hasLayer(osm) && !map.hasLayer(esri)) esri.addTo(map).bringToBack();
  mask.setStyle({ fillOpacity: d ? 0.45 : 0.3 });
  districts.setStyle(f => districts.options.style(f));
  render();
  document.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.theme === (document.documentElement.dataset.theme || 'auto'))));
}
function setTheme(t) {
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  try { localStorage.setItem('theme', t); } catch (e) {}
  applyTheme();
}
document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => setTheme(b.dataset.theme)));
darkMQ.addEventListener('change', () => { if (!document.documentElement.dataset.theme) applyTheme(); });

STATIONS = sanitizeStations(STATIONS);
renderLegend();
applyTheme();
loadLive();
setInterval(loadLive, 30000);
