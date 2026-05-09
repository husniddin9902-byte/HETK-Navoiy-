// 1. Xaritani sozlash (Google Hybrid/Sputnik ko'rinishi)
var map = L.map('map', {
    zoomControl: false 
}).setView([40.1031, 65.3739], 13); 

L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3']
}).addTo(map);

var marker, circle;

// 2. Lokatsiyani aniqlash funksiyasi (Siz aytgan yuqori aniqlik bilan)
function findMyLocation() {
    map.locate({
        setView: true, 
        maxZoom: 18,
        enableHighAccuracy: true, // GPS-ni maksimal kuch bilan ishlatadi
        timeout: 10000 
    });
}

// 3. Lokatsiya topilganda bajariladigan ishlar
map.on('locationfound', function(e) {
    if (marker) {
        marker.setLatLng(e.latlng);
        circle.setLatLng(e.latlng).setRadius(e.accuracy / 2);
    } else {
        marker = L.marker(e.latlng).addTo(map);
        circle = L.circle(e.latlng, {radius: e.accuracy / 2}).addTo(map);
    }

    // Koordinatalarni panelga chiqarish
    document.getElementById('latitude').innerText = e.latlng.lat.toFixed(6);
    document.getElementById('longitude').innerText = e.latlng.lng.toFixed(6);
    
    // Manzilni matn ko'rinishida olish
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${e.latlng.lat}&lon=${e.latlng.lng}`)
        .then(res => res.json())
        .then(data => {
            document.getElementById('address').innerText = data.display_name;
        });
});

// 4. Xatolik bo'lsa
map.on('locationerror', function(e) {
    alert("GPS aniqlanmadi: " + e.message);
});

// Sayt ochilishi bilan lokatsiyani qidirishni boshlash
findMyLocation();

// 5. Tugmalar logikasi (Strelka va Lokatsiya tugmasi)
document.getElementById('locate-btn').addEventListener('click', findMyLocation);

document.getElementById('toggle-info').addEventListener('click', function() {
    var panel = document.getElementById('info-panel');
    panel.classList.toggle('hidden');
    this.querySelector('i').classList.toggle('fa-chevron-up');
    this.querySelector('i').classList.toggle('fa-chevron-down');
});
