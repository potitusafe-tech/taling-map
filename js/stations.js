// ---------- สถานี ----------
// สถานะ, หาอำเภอจากพิกัด, จุดบนแผนที่, รายการในแผง และกล่องรายละเอียดสถานี

function statusOf(cm) {
  for (const t of THRESHOLDS) if (cm >= t.cm) return t;
  return NORMAL;
}

// หาว่าสถานีอยู่อำเภอไหน จากพิกัด (ไม่ต้องใส่อำเภอเองใน stations.json)
function inRing(lon, lat, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function districtOf(s) {
  const f = LAYERS.dist.features.find(f => f.geometry.coordinates.some(poly => inRing(s.lon, s.lat, poly[0])));
  return f ? f.properties.code : '';
}
const distName = {};
LAYERS.dist.features.forEach(f => { distName[f.properties.code] = f.properties.name; });
const markerById = {};

// ชื่อสถานีพร้อมรหัสในวงเล็บ เช่น แม่น้ำบางปะกง (2401-1) ใช้รหัสนี้เป็น STATION_ID ใน ESP32
function stationLabel(s) { return s.name + ' (' + s.id + ')'; }

function colorText(st) { return st.color === '#f9a825' && !isDark() ? '#8a6100' : st.color; }

// กดอำเภอ: ซูมไปที่อำเภอ แล้วสรุปสถานีในอำเภอนั้น

// กำลังวาดใหม่ (กันไม่ให้ popupclose ลบตำแหน่งน้ำตอนวาดใหม่)
let rendering = false;

function render() {
  // ข้อมูลใหม่เข้ามาแล้วกล่องสถานีเปิดค้างอยู่ ให้เปิดกลับและน้ำเลื่อนจากระดับเดิม
  const openId = Object.keys(markerById).find(id => markerById[id].isPopupOpen());
  rendering = true;
  stationLayer.clearLayers();
  rendering = false;
  const list = document.getElementById('list');
  list.textContent = '';
  const anySample = STATIONS.some(s => s.sample);
  document.getElementById('simtag').style.display = anySample ? '' : 'none';

  // เรียงตามอำเภอ แล้วใส่หัวข้ออำเภอในรายการด้านซ้าย
  const sorted = STATIONS.map(s => ({ s: s, code: districtOf(s) }))
    .sort((a, c) => a.code < c.code ? -1 : a.code > c.code ? 1 : 0);
  let lastCode = null;
  sorted.forEach(({ s, code }) => {
    if (code !== lastCode) {
      const h = document.createElement('button'); h.type = 'button'; h.className = 'grp';
      h.textContent = code ? districtTitle(distName[code]) : 'นอกเขตจังหวัด';
      if (code) h.addEventListener('click', () => showDistrict(code));
      list.appendChild(h);
      lastCode = code;
    }
    const st = statusOf(Number(s.level_cm));
    const lvl = Number(s.level_cm).toFixed(1);
    const silent = isSilent(s);
    const mk = silent ? SILENT : st;   // สีบนแผนที่และในรายการ: เงียบ = เทา

    const el = document.createElement('div');
    el.className = 'mk';
    el.style.setProperty('--c', mk.color);
    const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = mk.color;
    const chip = document.createElement('span'); chip.className = 'chip';
    chip.textContent = stationLabel(s) + ' · ' + mk.name;
    el.appendChild(dot); el.appendChild(chip);
    const icon = L.divIcon({ html: el, className: '', iconSize: [0, 0] });
    const m = L.marker([s.lat, s.lon], { icon: icon, title: stationLabel(s) }).addTo(stationLayer);
    markerById[s.id] = m;

    const pop = document.createElement('div');
    const hd = document.createElement('b'); hd.textContent = stationLabel(s) + ' · ' + st.name; hd.style.color = colorText(st); pop.appendChild(hd);
    if (code) { const dn = document.createElement('div'); dn.className = 'note'; dn.style.marginTop = '0'; dn.textContent = districtTitle(distName[code]); pop.appendChild(dn); }
    if (silent) { const sw = document.createElement('div'); sw.className = 'silent-warn'; sw.textContent = '⚠ ไม่มีข้อมูลใหม่เกินกำหนด ค่าด้านล่างเป็นค่าล่าสุดที่ได้รับ — เช็กไฟ/เน็ตของบอร์ด'; pop.appendChild(sw); }
    const rows = [];
    const num = (v, d) => (v === undefined || v === null || v === '') ? '-' : Number(v).toFixed(d);
    rows.push(['ระดับน้ำ (เหนือระดับต่ำสุด)', lvl + ' cm']);
    rows.push(['ระดับน้ำต่ำสุดที่บันทึก', num(s.min_cm, 1) + ' cm']);
    rows.push(['ระยะเซนเซอร์ถึงผิวน้ำ', num(140 - Number(s.level_cm), 1) + ' cm']);
    rows.push(['อุณหภูมิ', num(s.temp_c, 1) + ' °C']);
    rows.push(['ความชื้นสัมพัทธ์', num(s.rh, 0) + ' %']);
    rows.push(['ความกดอากาศ', num(s.pres_hpa, 1) + ' hPa']);
    SCREWS.forEach((sc, i) => rows.push(['สกรูวัดระดับ ' + sc.id + ' (' + (15 * (i + 1)) + ' cm)' + (typeof s[sc.id.toLowerCase()] === 'boolean' ? '' : ' · คำนวณ'), screwWet(s, sc) ? 'เปียก' : 'แห้ง']));
    rows.push(['แบตเตอรี่', num(s.batt_v, 2) + ' V']);
    rows.push(['อัปเดตล่าสุด', s.time]);
    const nx = nextUpdate(s);
    if (nx) rows.push(['อัปเดตครั้งต่อไป (คาดการณ์)', nx.text]);
    const tb = document.createElement('table'); tb.className = 'info';
    rows.forEach(r => { const tr = document.createElement('tr'); const a1 = document.createElement('td'); a1.textContent = r[0]; const a2 = document.createElement('td'); a2.textContent = r[1]; tr.appendChild(a1); tr.appendChild(a2); tb.appendChild(tr); });
    const wrap = document.createElement('div'); wrap.className = 'stwrap';
    wrap.appendChild(tb); wrap.appendChild(bankFigure(s, st));
    pop.appendChild(wrap);
    pop.appendChild(trendFigure(s, st));
    if (s.sample) { const sm = document.createElement('div'); sm.className = 'note'; sm.textContent = 'ตำแหน่ง ค่า และลักษณะตลิ่งเป็นข้อมูลจำลอง'; pop.appendChild(sm); }
    m.bindPopup(pop, { minWidth: 250, maxWidth: 640 });
    m.on('popupopen', e => {
      // ความกว้างคิดตอนเปิด ไม่ใช่ตอนวาด (ตอนวาดหน้าต่างอาจยังไม่มีขนาด)
      e.popup.options.maxWidth = Math.max(250, Math.min(640, window.innerWidth - 40));
      e.popup.update();
      riseWater(s, e.popup.getElement());
    });
    m.on('popupclose', () => { if (!rendering) delete waterY[s.id]; });

    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'st'; btn.title = stationLabel(s);
    const d = document.createElement('span'); d.className = 'd'; d.style.background = mk.color;
    const n = document.createElement('span'); n.className = 'n'; n.textContent = stationLabel(s);
    const v = document.createElement('span'); v.className = 'v'; v.textContent = silent ? 'เงียบ' : st.name;
    btn.appendChild(d); btn.appendChild(n); btn.appendChild(v);
    btn.addEventListener('click', () => { map.flyTo([s.lat, s.lon], 12); m.openPopup(); });
    list.appendChild(btn);
  });
  if (openId && markerById[openId] && map.hasLayer(markerById[openId])) markerById[openId].openPopup();
}

function renderLegend() {
  const lg = document.getElementById('legend');
  lg.textContent = '';
  const rows = THRESHOLDS.slice().reverse().map(t => ({ c: t.color, text: t.name + ' ≥ ' + t.cm + ' cm' }));
  rows.unshift({ c: NORMAL.color, text: NORMAL.name });
  rows.push({ c: SILENT.color, text: SILENT.name });
  rows.forEach(r => {
    const row = document.createElement('div');
    const i = document.createElement('i'); i.style.background = r.c;
    const t = document.createElement('span'); t.textContent = r.text;
    row.appendChild(i); row.appendChild(t); lg.appendChild(row);
  });
}
