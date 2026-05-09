function initLocation() {
    if (navigator.geolocation) {
        // Yuqori aniqlikda kuzatish
        navigator.geolocation.watchPosition(success, error, {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 5000
        });
    }
}

function success(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const acc = position.coords.accuracy;

    console.log("Aniqlik: " + acc + " metr");

    // Agar aniqlik hali past bo'lsa (masalan 400m), kutamiz. 
    // Agar 20 metrdan past bo'lsa, bu juda yaxshi.
    
    document.getElementById('latitude').innerText = lat.toFixed(6);
    document.getElementById('longitude').innerText = lng.toFixed(6);

    // Google Maps-ni yangilash (Sputnik ko'rinishida)
    const mapIframe = document.getElementById('google-map');
    mapIframe.src = `https://maps.google.com/maps?q=${lat},${lng}&z=18&t=k&output=embed`;
}

function error(err) {
    console.warn(`Xatolik (${err.code}): ${err.message}`);
}

document.getElementById('locate-btn').addEventListener('click', () => {
    location.reload(); // Sahifani yangilab, qaytadan aniqlash
});

document.getElementById('toggle-info').addEventListener('click', function() {
    document.getElementById('info-panel').classList.toggle('hidden');
});

initLocation();
