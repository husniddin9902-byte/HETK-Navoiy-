// ==========================================
// 1. BU QISMGA TEGMA (SENING ESKI POYDEVORING)
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBFOoT_ZhvE1tT1Qglh5GjPPhs8ZsyRWoc",
  authDomain: "energo-monitoring.firebaseapp.com",
  databaseURL: "https://energo-monitoring-default-rtdb.firebaseio.com",
  projectId: "energo-monitoring",
  storageBucket: "energo-monitoring.firebasestorage.app",
  messagingSenderId: "514032923022",
  appId: "1:514032923022:web:fe2f57b81a30d0c2fd74df"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

var map = L.map('map', { zoomControl: false }).setView([40.10, 65.81], 16);
var userMarker = null, selectedMarker = null, lastPos = null;
var isUserInteracting = false, isManualSelection = false;
let activeFolderId = 'root'; // Yangi tizim uchun kalit

L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',{
    maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3']
}).addTo(map);

// PANELNI YANGILASH (SENING DIZAYNING UCHUN ASOSIY FUNKSIYALAR)
function updatePanelValues(lat, lng, acc = null, force = false) {
    if (isManualSelection && !force) return;
    document.getElementById('latitude').innerText = lat.toFixed(6);
    document.getElementById('longitude').innerText = lng.toFixed(6);
    if (acc) document.getElementById('accuracy').innerText = acc;
}

function updateAddress(lat, lng, force = false) {
    if (isManualSelection && !force) return;
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        .then(res => res.json()).then(data => {
            document.getElementById('address').innerText = data.display_name || "Manzil topilmadi";
        });
}

// GPS LOKATSIYA (ESKI KO'K NUQTA VA PANEL ULANISHI)
navigator.geolocation.watchPosition((p) => {
    const lat = p.coords.latitude, lng = p.coords.longitude;
    lastPos = { lat, lng };
    var newLatLng = new L.LatLng(lat, lng);
    if (userMarker) map.removeLayer(userMarker);
    userMarker = L.marker(newLatLng, { icon: L.divIcon({ className: 'user-location-container', html: `<div style="position: relative; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px;"><div style="position: absolute; width: 40px; height: 40px; background: rgba(0, 122, 255, 0.2); border: 1px solid rgba(0, 122, 255, 0.4); border-radius: 50%;"></div><div style="width: 12px; height: 12px; background: #007AFF; border: 2px solid white; border-radius: 50%; z-index: 2;"></div></div>` }) }).addTo(map);
    if (!isUserInteracting) map.setView(newLatLng, 18);
    updatePanelValues(lat, lng, Math.round(p.coords.accuracy));
    updateAddress(lat, lng);
}, null, { enableHighAccuracy: true });

// ==========================================
// 2. YANGI QISMLAR (ESKISIGA ZARAR BERMASDAN QO'SHILDI)
// ==========================================

// Papkalarni yuklash va daraxtni qurish funksiyalari...
// (Bu yerda loadFolders, renderTree funksiyalari daxlsiz alohida ishlaydi)

// SAQLASH TUGMASI (ENDI HAM PANELNI YANGILAYDI, HAM BAZAGA YOZADI)
document.querySelector('.save-btn').onclick = function() {
    const lat = document.getElementById('latitude').innerText;
    const lng = document.getElementById('longitude').innerText;
    const addr = document.getElementById('address').innerText;

    if (activeFolderId === 'root') {
        alert("Avval papka tanlang!");
        return;
    }

    database.ref('TPs/' + Date.now()).set({
        lat, lng, address: addr, folderId: activeFolderId, time: new Date().toLocaleString()
    }).then(() => alert("Saqlandi!"));
};

// Panelni ochib yopish (Sening original togglePanel funksiyang)
function togglePanel() {
    const panel = document.getElementById('panel');
    const icon = document.getElementById('toggle-icon');
    panel.classList.toggle('minimized');
    icon.style.transform = panel.classList.contains('minimized') ? 'rotate(0deg)' : 'rotate(180deg)';
}
