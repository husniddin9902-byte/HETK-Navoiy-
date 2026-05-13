// 1. Firebase Sozlamalari
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

// 2. Xaritani ishga tushirish (Google Satellite bilan)
var map = L.map('map', { zoomControl: false }).setView([40.10, 65.81], 16);

L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',{
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3']
}).addTo(map);

var marker = L.marker([40.10, 65.81]).addTo(map);
var lastPos = null;
var isUserInteracting = false; 

// 3. Lokatsiyani aniqlash funksiyasi
function onLocation(p) {
    const lat = p.coords.latitude;
    const lng = p.coords.longitude;
    const acc = Math.round(p.coords.accuracy);
    lastPos = { lat: lat, lng: lng };
    
    var newLatLng = new L.LatLng(lat, lng);
    marker.setLatLng(newLatLng);

    // Xarita surilmagan bo'lsa, markazni yangilab turadi
    if (!isUserInteracting) {
        map.setView(newLatLng, 18);
    }

    // UI elementlarini yangilash
    if(document.getElementById('latitude')) document.getElementById('latitude').innerText = lat.toFixed(6);
    if(document.getElementById('longitude')) document.getElementById('longitude').innerText = lng.toFixed(6);
    if(document.getElementById('accuracy')) document.getElementById('accuracy').innerText = acc;
    
    // Manzilni aniqlash
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        .then(res => res.json())
        .then(data => {
            if(document.getElementById('address')) {
                document.getElementById('address').innerText = data.display_name || "Manzil topilmadi";
            }
        }).catch(() => {
            if(document.getElementById('address')) document.getElementById('address').innerText = "Internetda xatolik";
        });
}

// GPS kuzatishni yoqish
navigator.geolocation.watchPosition(onLocation, (e) => console.log(e), { enableHighAccuracy: true });

// 4. Xarita nazorati
map.on('movestart', function() {
    isUserInteracting = true;
});

// Nishon tugmasi bosilganda avto-sentrni qayta yoqish
if(document.getElementById('locate-btn')) {
    document.getElementById('locate-btn').addEventListener('click', () => {
        isUserInteracting = false; 
        if(lastPos) map.setView([lastPos.lat, lastPos.lng], 18);
    });
}

// 5. Panelni ochish/yopish (Strelka effekti bilan)
function togglePanel() {
    const panel = document.getElementById('panel');
    const icon = document.getElementById('toggle-icon');
    
    if(!panel || !icon) return;

    panel.classList.toggle('minimized');
    
    if (panel.classList.contains('minimized')) {
        icon.style.transform = 'rotate(0deg)'; 
        icon.className = 'fas fa-chevron-up'; // Tepaga strelka
    } else {
        icon.style.transform = 'rotate(180deg)';
        icon.className = 'fas fa-chevron-down'; // Pastga strelka
    }
}

// 6. Bazaga saqlash
document.querySelector('.save-btn').addEventListener('click', function() {
    if (lastPos) {
        database.ref('locations/' + Date.now()).set({
            lat: lastPos.lat,
            lng: lastPos.lng,
            time: new Date().toLocaleString(),
            address: document.getElementById('address').innerText
        }).then(() => {
            alert("Bazaga saqlandi!"); //
        });
    } else {
        alert("GPS ma'lumoti kutilmoqda...");
    }
});

// 7. Nusxa ko'chirish funksiyasi
function copyCoords() {
    if(lastPos) {
        const text = `${lastPos.lat.toFixed(6)}, ${lastPos.lng.toFixed(6)}`;
        navigator.clipboard.writeText(text).then(() => {
            alert("Koordinatalar nusxalandi!");
        });
    }
}
