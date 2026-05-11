// 1. Firebase Konfiguratsiyasi (Sizning loyihangiz uchun)
const firebaseConfig = {
  apiKey: "AIzaSyBFOoT_ZhvE1tT1Qglh5GjPPhs8ZsyRWoc",
  authDomain: "energo-monitoring.firebaseapp.com",
  databaseURL: "https://energo-monitoring-default-rtdb.firebaseio.com",
  projectId: "energo-monitoring",
  storageBucket: "energo-monitoring.firebasestorage.app",
  messagingSenderId: "514032923022",
  appId: "1:514032923022:web:fe2f57b81a30d0c2fd74df"
};

// Firebase-ni ishga tushirish
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// 2. Xaritani sozlash
var map = L.map('map', { zoomControl: false }).setView([40.10, 65.37], 13); 
L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3']
}).addTo(map);

var marker = L.marker([40.10, 65.37], { draggable: true }).addTo(map);
var lastPos = null;

// 3. GPS orqali kuzatish
navigator.geolocation.watchPosition(function(p) {
    lastPos = { lat: p.coords.latitude, lng: p.coords.longitude };
    marker.setLatLng([lastPos.lat, lastPos.lng]);
    map.setView([lastPos.lat, lastPos.lng], 18);
    document.getElementById('latitude').innerText = lastPos.lat.toFixed(6);
    document.getElementById('longitude').innerText = lastPos.lng.toFixed(6);
}, function(e) { console.log(e); }, { enableHighAccuracy: true });

// 4. "Save Location" tugmasi bosilganda Firebase-ga yozish
document.querySelector('.save-btn').addEventListener('click', function() {
    if (lastPos) {
        database.ref('locations/' + Date.now()).set({
            lat: lastPos.lat,
            lng: lastPos.lng,
            time: new Date().toLocaleString(),
            staff: "Xodim"
        }).then(() => {
            alert("BAZAGA SAQLANDI!");
        }).catch((error) => {
            alert("Xato: " + error.message);
        });
    } else {
        alert("GPS hali aniqlanmadi!");
    }
});

// 5. Boshqa xodimlar yuborgan nuqtalarni avtomatik ko'rsatish
database.ref('locations/').on('value', function(snapshot) {
    const data = snapshot.val();
    if (data) {
        Object.values(data).forEach(function(loc) {
            // Saqlangan nuqtalarni yashil marker bilan ko'rsatish
            L.circleMarker([loc.lat, loc.lng], {
                color: '#28a745',
                fillColor: '#28a745',
                fillOpacity: 0.5,
                radius: 10
            }).addTo(map).bindPopup("Vaqt: " + loc.time);
        });
    }
});
