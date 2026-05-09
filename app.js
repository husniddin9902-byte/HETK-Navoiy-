// Xarita sozlamalari
var map = L.map('map', {
    zoomControl: false // Odatiy tugmalarni o'chiramiz (rasmdagidek bo'lishi uchun)
}).setView([40.1031, 65.3739], 13); 

// Google Hybrid xaritasi (Sputnik + Yo'llar)
L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3']
}).addTo(map);

var marker;

// Haqiqiy lokatsiyani yuqori aniqlikda so'rash
function locateUser() {
    map.locate({
        setView: true, 
        maxZoom: 18,
        enableHighAccuracy: true // GPS-dan maksimal aniqlikda foydalanish
    });
}

// Sayt ochilishi bilan lokatsiyani aniqlash
locateUser();

// Xarita ustidagi lokatsiya tugmasini bossa ham ishlaydi
document.getElementById('locate-btn').addEventListener('click', locateUser);

map.on('locationfound', function(e) {
    if (marker) {
        marker.setLatLng(e.latlng);
    } else {
        marker = L.marker(e.latlng).addTo(map);
    }
    
    // Pastdagi panelga koordinatalarni yozish
    document.getElementById('latitude').innerText = e.latlng.lat.toFixed(6);
    document.getElementById('longitude').innerText = e.latlng.lng.toFixed(6);
    
    // Manzilni aniqlash (Reverse Geocoding)
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${e.latlng.lat}&lon=${e.latlng.lng}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('address').innerText = data.display_name;
        });
});

map.on('locationerror', function() {
    alert("Lokatsiyani aniqlashda xatolik! Iltimos, telefonda GPS yoqilganini va brauzerda ruxsat berilganini tekshiring.");
});

// Strelka tugmasi logic
document.getElementById('toggle-info').addEventListener('click', function() {
    var panel = document.getElementById('info-panel');
    panel.classList.toggle('hidden');
    this.querySelector('i').classList.toggle('fa-chevron-up');
    this.querySelector('i').classList.toggle('fa-chevron-down');
});
