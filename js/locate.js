// ---------- ตำแหน่งของฉัน ----------
// ปุ่มใต้ปุ่มซูม: ขอตำแหน่งจากเบราว์เซอร์ (ต้องเปิดผ่าน https หรือ localhost และผู้ใช้กดอนุญาต)
// แสดงจุดสีฟ้า + วงความแม่นยำ แล้วบินไปที่ตำแหน่งนั้น ตำแหน่งไม่ถูกส่งไปที่ไหน

const meLayer = L.layerGroup().addTo(map);

function showMyLocation(btn) {
  if (!navigator.geolocation) { alert('เบราว์เซอร์นี้หาตำแหน่งไม่ได้'); return; }
  btn.classList.add('busy');
  navigator.geolocation.getCurrentPosition(pos => {
    btn.classList.remove('busy');
    const ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
    const acc = Math.round(pos.coords.accuracy);
    meLayer.clearLayers();
    L.circle(ll, { radius: acc, color: '#1a73e8', weight: 1, fillColor: '#1a73e8', fillOpacity: 0.12, interactive: false }).addTo(meLayer);
    L.marker(ll, { icon: L.divIcon({ className: 'me', html: '<span></span>', iconSize: [18, 18] }), title: 'ตำแหน่งของฉัน', keyboard: false })
      .bindPopup('ตำแหน่งของฉัน (คลาดเคลื่อนประมาณ ' + acc.toLocaleString('th-TH') + ' ม.)').addTo(meLayer);

    // อยู่นอกกรอบที่แผนที่เลื่อนไปได้ (นอกภูมิภาค หรือนอกอำเภอที่ล็อกอยู่) ก็บอกไว้ ไม่ฝืนเลื่อน
    const bounds = map.options.maxBounds ? L.latLngBounds(map.options.maxBounds) : null;
    if (bounds && !bounds.contains(ll)) {
      alert(focusCode ? 'ตำแหน่งของคุณอยู่นอกอำเภอที่เลือก กด ← หรือ × ที่แถบล่างเพื่อดูทั้งจังหวัดก่อน'
                      : 'ตำแหน่งของคุณอยู่นอกพื้นที่แผนที่ (ฉะเชิงเทราและจังหวัดข้างเคียง)');
      return;
    }
    map.flyTo(ll, Math.max(map.getZoom(), 14));
  }, err => {
    btn.classList.remove('busy');
    alert(err.code === err.PERMISSION_DENIED
      ? 'ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง เปิดได้ที่ไอคอนแม่กุญแจข้างช่องที่อยู่เว็บ'
      : 'หาตำแหน่งไม่สำเร็จ ลองใหม่อีกครั้ง หรือเปิด GPS/ตำแหน่งของเครื่อง');
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
}

L.Control.Locate = L.Control.extend({
  options: { position: 'topleft' },
  onAdd: function () {
    const wrap = L.DomUtil.create('div', 'leaflet-bar');
    const a = L.DomUtil.create('a', 'locate-btn', wrap);
    a.href = '#'; a.role = 'button'; a.title = 'ตำแหน่งของฉัน';
    a.setAttribute('aria-label', 'ตำแหน่งของฉัน');
    a.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/></svg>';
    L.DomEvent.disableClickPropagation(wrap);
    L.DomEvent.on(a, 'click', e => { L.DomEvent.preventDefault(e); showMyLocation(a); });
    return wrap;
  }
});
new L.Control.Locate().addTo(map);
