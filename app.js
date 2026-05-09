// Xaritani yaratish (Navoiy markazi koordinatalari bilan)
var map = L.map('map').setView([40.1031, 65.3739], 13);

// Xarita ko'rinishini yuklash (Sputnik/Hybrid ko'rinishi)
L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
    maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3']
}).addTo(map);

// Turgan joyni aniqlash
map.locate({setView: true, maxZoom: 16});

var marker;
function onLocationFound(e) {
    if (marker) map.removeLayer(marker);
    marker = L.marker(e.latlng).addTo(map);
    
    document.getElementById('latitude').innerText = e.latlng.lat.toFixed(6);
    document.getElementById('longitude').innerText = e.latlng.lng.toFixed(6);
}
map.on('locationfound', onLocationFound);

// Strelka tugmasini bosganda panelni ochish/yopish
document.getElementById('toggle-info').addEventListener('click', function() {
    var panel = document.getElementById('info-panel');
    var icon = this.querySelector('i');
    panel.classList.toggle('hidden');
    icon.classList.toggle('fa-chevron-up');
    icon.classList.toggle('fa-chevron-down');
});
