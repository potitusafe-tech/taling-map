// ---------- โฟกัสรายอำเภอ ----------
// เลือกอำเภอ (จากเมนู รายการ หรือกดบนแผนที่) → ซูมไปที่อำเภอ ทำนอกอำเภอให้มืด ล็อกให้เลื่อนได้แค่ในอำเภอ
// และแสดงสถานีของอำเภอนั้นในแถบล่าง; ปุ่ม ← หรือ × = เลิกโฟกัส กลับมาทั้งจังหวัด

function showDistrict(code) {
  const layer = distLayers[code];
  if (!layer) return;
  unfocusDistrict();
  focusCode = code;
  map.closePopup();
  openView('district', {
    title: districtTitle(layer.feature.properties.name),
    back: () => { clearDistrictFocus(); openView('districts'); }
  });
  renderDistrictView();

  // นอกอำเภอมืดลง + เส้นขอบอำเภอชัดขึ้น
  const g = layer.feature.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const holes = polys.map(p => p[0].map(c => [c[1], c[0]]));
  L.polygon([world].concat(holes), { stroke: false, fillColor: '#000', fillOpacity: isDark() ? 0.6 : 0.5, interactive: false }).addTo(focusGroup);
  L.geoJSON(layer.feature, { style: { color: isDark() ? '#7fc4f2' : '#1d5fa8', weight: 3, fill: false }, interactive: false }).addTo(focusGroup);

  // ซูมพอดีอำเภอ (เว้นที่ให้แถบล่าง) แล้วล็อกกรอบการเลื่อนกับการซูมออก
  const b = layer.getBounds();
  map.setMaxBounds(null);
  map.setMinZoom(0);
  map.once('moveend', () => {
    if (focusCode !== code) return;
    // กรอบล็อกต้องครอบทั้งจอที่เห็นอยู่ (รวมส่วนใต้แถบล่าง) ไม่งั้น Leaflet จะดันแผนที่ออกจากอำเภอ
    map.setMaxBounds(map.getBounds().extend(b).pad(0.1));
    map.setMinZoom(Math.floor((map.getZoom() - 0.5) * 4) / 4);
  });
  map.fitBounds(b, fitOpts(24));
}

// เอาโฟกัสออก (ไม่ขยับแผนที่)
function unfocusDistrict() {
  focusCode = null;
  focusGroup.clearLayers();
  Object.values(markerById).forEach(m => m.setOpacity(1));
  map.setMaxBounds(REGION);
  syncMinZoom();
}

// เลิกโฟกัสแล้วกลับไปดูทั้งจังหวัด
function clearDistrictFocus() {
  if (!focusCode) return;
  unfocusDistrict();
  map.closePopup();
  fitProvince();
}

// เนื้อหาหน้าอำเภอในแถบล่าง: พื้นที่ จำนวนสถานี สถานะสูงสุด และรายการสถานี (ระดับสูงสุดก่อน)
function renderDistrictView() {
  const box = document.getElementById('dview');
  box.textContent = '';
  if (!focusCode) return;
  const f = distLayers[focusCode].feature;
  const here = STATIONS.filter(s => districtOf(s) === focusCode)
    .sort((a, c) => Number(c.level_cm) - Number(a.level_cm));
  // สถานีนอกอำเภอจางลง ให้เหลือเด่นแค่ของอำเภอนี้
  STATIONS.forEach(s => { if (markerById[s.id]) markerById[s.id].setOpacity(here.includes(s) ? 1 : 0.2); });

  const info = document.createElement('div'); info.className = 'dsum';
  info.textContent = 'พื้นที่ ' + Number(f.properties.area_sqkm).toLocaleString('th-TH', { maximumFractionDigits: 1 }) + ' ตร.กม. · ' + here.length + ' สถานี';
  if (here.length) {
    const worst = statusOf(Number(here[0].level_cm));
    info.appendChild(document.createTextNode(' · สูงสุด '));
    const w = document.createElement('b'); w.textContent = worst.name; w.style.color = colorText(worst);
    info.appendChild(w);
  }
  box.appendChild(info);

  if (!here.length) {
    const no = document.createElement('div'); no.className = 'note'; no.textContent = 'ยังไม่มีสถานีในอำเภอนี้';
    box.appendChild(no);
    return;
  }
  const list = document.createElement('div'); list.className = 'slist';
  here.forEach(s => list.appendChild(stationRow(s)));
  box.appendChild(list);
  const nt = document.createElement('div'); nt.className = 'note';
  nt.textContent = 'แผนที่ล็อกไว้ที่อำเภอนี้ · กด ← เพื่อเลือกอำเภออื่น';
  box.appendChild(nt);
}
