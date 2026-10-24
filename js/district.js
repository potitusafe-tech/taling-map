// ---------- สรุปรายอำเภอ ----------
// กดอำเภอ (บนแผนที่หรือในแผง) → ซูมไปที่อำเภอ แล้วสรุปสถานีในอำเภอนั้น

function showDistrict(code) {
  const layer = distLayers[code];
  const f = layer.feature;
  map.fitBounds(layer.getBounds(), fitOpts(30));

  const box = document.createElement('div');
  const b = document.createElement('b');
  b.textContent = districtTitle(f.properties.name);
  box.appendChild(b);
  const area = document.createElement('div'); area.className = 'note'; area.style.marginTop = '0';
  area.textContent = 'พื้นที่ ' + Number(f.properties.area_sqkm).toLocaleString('th-TH', { maximumFractionDigits: 1 }) + ' ตร.กม.';
  box.appendChild(area);

  const here = STATIONS.filter(s => districtOf(s) === code)
    .sort((a, c) => Number(c.level_cm) - Number(a.level_cm));
  if (!here.length) {
    const no = document.createElement('div'); no.style.marginTop = '6px'; no.textContent = 'ยังไม่มีสถานีในอำเภอนี้';
    box.appendChild(no);
  } else {
    const worst = statusOf(Number(here[0].level_cm));
    const sum = document.createElement('div'); sum.style.marginTop = '6px';
    sum.textContent = here.length + ' สถานี · สถานะสูงสุด: ';
    const w = document.createElement('b'); w.textContent = worst.name; w.style.color = colorText(worst); sum.appendChild(w);
    box.appendChild(sum);
    const tb = document.createElement('table'); tb.className = 'info sum';
    here.forEach(s => {
      const st = statusOf(Number(s.level_cm));
      const tr = document.createElement('tr');
      const a = document.createElement('td');
      const btn = document.createElement('button'); btn.type = 'button';
      const dot = document.createElement('i'); dot.style.background = st.color;
      btn.appendChild(dot); btn.appendChild(document.createTextNode(stationLabel(s)));
      btn.addEventListener('click', () => { map.flyTo([s.lat, s.lon], 12); markerById[s.id].openPopup(); });
      a.appendChild(btn);
      const lv = document.createElement('td'); lv.textContent = Number(s.level_cm).toFixed(1) + ' cm';
      const ss = document.createElement('td'); ss.textContent = st.name; ss.style.color = colorText(st);
      tr.appendChild(a); tr.appendChild(lv); tr.appendChild(ss); tb.appendChild(tr);
    });
    box.appendChild(tb);
    const nt = document.createElement('div'); nt.className = 'note'; nt.textContent = 'กดชื่อสถานีเพื่อดูรายละเอียด';
    box.appendChild(nt);
  }
  L.popup({ minWidth: 260, autoPan: false }).setLatLng(layer.getBounds().getCenter()).setContent(box).openOn(map);
}
