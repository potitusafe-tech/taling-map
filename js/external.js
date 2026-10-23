// ---------- ข้อมูลภายนอกที่โหลดสดในเบราว์เซอร์ ----------
// ข้อความจากภายนอกใส่ด้วย textContent เท่านั้น (ไม่ใช้ innerHTML)

// ---------- เส้นทางน้ำ (OpenStreetMap ผ่าน Overpass โหลดสดในเบราว์เซอร์) ----------
(function loadWaterways() {
  const msg = document.getElementById('wmsg');
  const b = prov.getBounds();
  const bb = [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()].join(',');
  const q = '[out:json][timeout:60];way["waterway"~"^(river|canal|stream)$"](' + bb + ');out geom;';
  const hosts = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  // เส้นบางและจาง วาดใต้สีอำเภอ (pane 'water') ให้ดูเป็นส่วนหนึ่งของแผนที่
  const W = { river: [1.2, '#4a9bd6'], canal: [0.8, '#6fb4e6'], stream: [0.5, '#8cc6ee'] };
  if (!map.getPane('water')) map.createPane('water').style.zIndex = 390;
  async function go(i) {
    if (i >= hosts.length) { msg.textContent = 'โหลดเส้นทางน้ำไม่สำเร็จ (ต้องต่ออินเทอร์เน็ต) ลองรีเฟรช'; return; }
    try {
      const r = await fetch(hosts[i], { method: 'POST', body: 'data=' + encodeURIComponent(q) });
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      let n = 0;
      j.elements.forEach(e => {
        if (!e.geometry) return;
        const w = W[e.tags && e.tags.waterway] || W.stream;
        const line = L.polyline(e.geometry.map(p => [p.lat, p.lon]), { pane: 'water', color: w[1], weight: w[0], opacity: .7, interactive: false });
        line.addTo(waterLayer); n++;
      });
      msg.textContent = 'แม่น้ำ/คลอง/ลำธาร ' + n + ' เส้น (ที่มา: OpenStreetMap, ODbL) · เส้นอาจขาดบางสาย';
    } catch (e) { go(i + 1); }
  }
  go(0);
})();

// ---------- สถานีกรมชลประทาน (RID SWOC API โหลดสดในเบราว์เซอร์) ----------
// ชื่อ field ในเอกสารไม่ระบุตัวสะกดแน่ชัด จึงค้นหาแบบไม่สนตัวพิมพ์เล็กใหญ่
(function loadRID() {
  const msg = document.getElementById('rmsg');
  // เปิดผ่าน serve.py (http://localhost) จะเรียกผ่านตัวกลาง /rid/ ที่อื่น (ไฟล์ตรงๆ, GitHub Pages) จะลองเรียก API ตรง (มักติด CORS)
  const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const BASE = LOCAL ? '/rid/' : 'https://swoc-api-service.rid.go.th/api/';
  const rows = j => Array.isArray(j) ? j : (j && (j.data || j.result || j.rows || j.items)) || [];
  const pick = (o, re) => { for (const k in o) if (re.test(k) && o[k] !== null && o[k] !== '') return o[k]; };
  const b = prov.getBounds();
  async function get(name) {
    const r = await fetch(BASE + name);
    if (!r.ok) throw new Error(name + ' ' + r.status);
    return rows(await r.json());
  }
  (async () => {
    try {
      const [locs, data] = await Promise.all([get('pier-tele-location-master'), get('pier-tele-data')]);
      const latest = {};
      data.forEach(d => {
        const id = String(pick(d, /^(station_?id|id|code|station_?code)$/i));
        const tm = String(pick(d, /date|time/i) || '');
        if (!latest[id] || tm > latest[id].tm) latest[id] = { d: d, tm: tm };
      });
      let n = 0;
      locs.forEach(s => {
        const lat = parseFloat(pick(s, /^lat/i)), lon = parseFloat(pick(s, /^(lon|lng)/i));
        if (!isFinite(lat) || !isFinite(lon) || !b.contains([lat, lon])) return;
        const id = String(pick(s, /^(station_?id|id)$/i));
        const code = String(pick(s, /^(station_?code|code)$/i));
        const name = pick(s, /name/i) || code || id;
        const lv = latest[id] || latest[code];
        const pop = document.createElement('div');
        const hd = document.createElement('b'); hd.textContent = name; hd.style.color = '#1565c0'; pop.appendChild(hd);
        const tb = document.createElement('table'); tb.className = 'info';
        const add = (a, v) => { const tr = document.createElement('tr'); const x = document.createElement('td'); x.textContent = a; const y = document.createElement('td'); y.textContent = v; tr.appendChild(x); tr.appendChild(y); tb.appendChild(tr); };
        const river = pick(s, /river|basin/i); if (river) add('แม่น้ำ/ลุ่มน้ำ', river);
        const am = pick(s, /amphoe|district/i), pv = pick(s, /province/i);
        if (am || pv) add('พื้นที่', [am, pv].filter(Boolean).join(' '));
        if (lv) {
          const up = pick(lv.d, /^wl_?up/i), dn = pick(lv.d, /^wl_?down/i);
          if (up !== undefined) add('ระดับน้ำด้านเหนือ', up + ' m');
          if (dn !== undefined) add('ระดับน้ำด้านท้าย', dn + ' m');
          add('อัปเดตล่าสุด', lv.tm);
        } else add('ระดับน้ำ', 'ไม่มีข้อมูลล่าสุด');
        pop.appendChild(tb);
        const nt = document.createElement('div'); nt.className = 'note'; nt.textContent = 'ที่มา: กรมชลประทาน (SWOC) · หน่วยและค่าอ้างอิงเป็นของกรมชลประทาน ไม่ใช่ค่าเดียวกับสถานีของเรา'; pop.appendChild(nt);
        const icon = L.divIcon({ html: '<div class="rid"></div>', className: '', iconSize: [14, 14], iconAnchor: [7, 7] });
        L.marker([lat, lon], { icon: icon, title: String(name) }).bindPopup(pop, { minWidth: 240 }).addTo(ridLayer);
        n++;
      });
      msg.textContent = n ? ('พบสถานีกรมชลประทานในจังหวัด ' + n + ' แห่ง (อัปเดตทุก 15 นาที)') : 'ไม่พบสถานีโทรมาตรของกรมชลประทานในขอบเขตจังหวัด';
    } catch (e) {
      msg.textContent = 'โหลดข้อมูลกรมชลประทานไม่สำเร็จ (' + e.message + ') ' + (LOCAL ? 'ตัวกลางเรียก API ไม่ได้ ดูข้อความใน terminal ที่รัน serve.py' : 'เปิดผ่าน serve.py (python3 serve.py) แล้วเข้า http://localhost:8000/');
    }
  })();
})();
