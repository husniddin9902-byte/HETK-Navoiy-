var map = L.map('map', { zoomControl: false }).setView([40.1031, 65.3739], 13); 

L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3']
}).addTo(map);

var marker;

function findMyLocation() {
    map.locate({
        setView: true, 
        maxZoom: 18,
        enableHighAccuracy: true,
        timeout: 30000, // Vaqtni 30 soniyaga uzaytirdik
        maximumAge: 0 
    });
}

map.on('locationfound', function(e) {
    if (marker) {
        marker.setLatLng(e.latlng);
    } else {
        marker = L.marker(e.latlng).addTo(map);
    }
    
    document.getElementById('latitude').innerText = e.latlng.lat.toFixed(6);
    document.getElementById('longitude').innerText = e.latlng.lng.toFixed(6);
    
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${e.latlng.lat}&lon=${e.latlng.lng}`)
        .then(res => res.json())
        .then(data => {
            document.getElementById('address').innerText = data.display_name || "Manzil topilmadi";
        }).catch(() => {
            document.getElementById('address').innerText = "Internet aloqasi sust";
        });
});

// Xatolik xabarini ekranga chiqarmaslik uchun console-ga yo'naltiramiz
map.on('locationerror', function(e) {
    console.log("GPS qidirilmoqda... " + e.message);
});

findMyLocation();

document.getElementById('locate-btn').addEventListener('click', findMyLocation);

document.getElementById('toggle-info').addEventListener('click', function() {
    var panel = document.getElementById('info-panel');
    panel.classList.toggle('hidden');
    this.querySelector('i').classList.toggle('fa-chevron-up');
    this.querySelector('i').classList.toggle('fa-chevron-down');
});
