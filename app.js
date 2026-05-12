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

// 2. Xaritani ishga tushirish
var map = L.map('map', { zoomControl: false }).setView([40.10, 65.37], 13); 

L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0','mt1','mt2','mt3']
}).addTo(map);

var marker = L.marker([40.10, 65.37], { draggable: true }).addTo(map);
var lastPos = null;

// 3. Lokatsiyani aniqlash
function onLocation(p) {
    lastPos = { lat: p.coords.latitude, lng: p.coords.longitude };
    var newLatLng = new L.LatLng(lastPos.lat, lastPos.lng);
    marker.setLatLng(newLatLng);
    map.setView(newLatLng, 18);
    document.getElementById('latitude').innerText = lastPos.lat.toFixed(6);
    document.getElementById('longitude').innerText = lastPos.lng.toFixed(6);
}

navigator.geolocation.watchPosition(onLocation, (e) => console.log(e), { enableHighAccuracy: true });

// 4. Bazaga saqlash
document.querySelector('.save-btn').addEventListener('click', function() {
    if (lastPos) {
        database.ref('locations/' + Date.now()).set({
            lat: lastPos.lat,
            lng: lastPos.lng,
            time: new Date().toLocaleString()
        }).then(() => alert("Bazaga saqlandi!"));
    }
});

// 5. Nishon tugmasi
document.getElementById('locate-btn').addEventListener('click', () => {
    if(lastPos) map.setView([lastPos.lat, lastPos.lng], 18);
});
