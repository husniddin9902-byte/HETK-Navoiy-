function initLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(success, error, {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 10000
        });
    } else {
        alert("Brauzeringiz geolokatsiyani qo'llab-quvvatlamaydi.");
    }
}

function success(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    // Koordinatalarni matn ko'rinishida chiqarish
    document.getElementById('latitude').innerText = lat.toFixed(6);
    document.getElementById('longitude').innerText = lng.toFixed(6);

    // Google Maps iframe-ni yangilash
    const mapIframe = document.getElementById('google-map');
    
    // t=k (Sputnik), z=19 (Yaqinlik), q (Nuqta manzili)
    // URL-ni to'g'ri formatda yozamiz:
    mapIframe.src = `https://maps.google.com/maps?q=${lat},${lng}&z=19&t=k&output=embed`;
}

function error(err) {
    console.warn(`Xatolik: ${err.message}`);
    // Agar timeout bo'lsa, qayta urinib ko'radi
}

// "Nishon" tugmasini bossa sahifani yangilab, qayta qidiradi
document.getElementById('locate-btn').addEventListener('click', () => {
    location.reload();
});

// Pastki panelni ochib-yopish
document.getElementById('toggle-info').addEventListener('click', function() {
    document.getElementById('info-panel').classList.toggle('hidden');
    // Strelka belgisini o'zgartirish
    this.querySelector('i').classList.toggle('fa-chevron-up');
    this.querySelector('i').classList.toggle('fa-chevron-down');
});

// Sayt ochilishi bilan boshlash
initLocation();
