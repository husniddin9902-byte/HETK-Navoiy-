// ==========================================
// YANGLI DINAMIK TAB VA FILTRLASH LOGIKASI
// ==========================================
const tabFolders = document.getElementById('tab-folders');
const tabItems = document.getElementById('tab-items');
const foldersSection = document.getElementById('folders-section');
const itemsSection = document.getElementById('items-section');
const dynamicContentPanel = document.getElementById('dynamic-content-panel');
const searchContainerBox = document.getElementById('search-container-box');

// 1. GURUHLAR TABI BOSILGANDA
if (tabFolders) {
    tabFolders.addEventListener('click', () => {
        tabFolders.classList.add('active');
        tabItems.classList.remove('active');
        
        // Kontent panelini to'liq ochamiz, guruhlarni ko'rsatamiz
        dynamicContentPanel.style.display = 'block';
        foldersSection.classList.add('active');
        itemsSection.classList.remove('active');
        if(searchContainerBox) searchContainerBox.style.display = 'none'; // Guruhda qidiruv shartmas
    });
}

// 2. XARITA (RO'YXAT) TABI BOSILGANDA (Siz aytgan 2-rasm holatiga o'tadi)
if (tabItems) {
    tabItems.addEventListener('click', () => {
        tabItems.classList.add('active');
        tabFolders.classList.remove('active');
        
        // MUHIM MANTIQLAR:
        // Agarda biror guruh tanlangan bo'lsa, ro'yxatni ko'rsatish uchun kontentni ochiq qoldiramiz
        dynamicContentPanel.style.display = 'block';
        itemsSection.classList.add('active');
        foldersSection.classList.remove('active');
        if(searchContainerBox) searchContainerBox.style.display = 'block'; // Rasmdagi qidiruv ochiladi
        
        // Faqat tanlangan guruh elementlarini xaritada qoldirib, ro'yxatga yuklaydi
        loadFilteredPoints();
    });
}

// Global markerlar massivi (Eski markerlarni tozalab turish uchun)
let activeMapMarkers = [];

function loadFilteredPoints() {
    const tpListContainer = document.getElementById('tp-list');
    if (!tpListContainer) return;
    
    tpListContainer.innerHTML = "<p style='color:gray; padding:15px;'>Nuqtalar yuklanmoqda...</p>";

    if (activeFolderId === 'root') {
        tpListContainer.innerHTML = "<p style='color:#ff4444; padding:15px;'>Xaritani ko'rish va filtrlash uchun avval 'Guruhlar' bo'limidan birorta guruhni tanlang!</p>";
        return;
    }

    // Xaritadagi oldingi barcha guruh markerlarini tozalaymiz (Qolganlari ko'rinmas bo'ladi)
    activeMapMarkers.forEach(m => map.removeLayer(m));
    activeMapMarkers = [];

    database.ref('TPs').once('value', (snapshot) => {
        const allPoints = snapshot.val() || {};
        tpListContainer.innerHTML = ""; 

        // Faqat tanlangan activeFolderId ga tegishli nuqtalar
        const filteredKeys = Object.keys(allPoints).filter(key => allPoints[key].folderId === activeFolderId);

        if (filteredKeys.length === 0) {
            tpListContainer.innerHTML = "<p style='color:gray; padding:15px;'>Bu guruhga biror ham nuqta biriktirilmagan.</p>";
            return;
        }

        let bounds = [];

        filteredKeys.forEach(key => {
            const point = allPoints[key];
            const lat = parseFloat(point.lat);
            const lng = parseFloat(point.lng);
            const displayName = point.name || `Nuqta: ${point.time ? point.time.split(',')[0] : 'Noma\'lum'}`;

            if (!isNaN(lat) && !isNaN(lng)) {
                bounds.push([lat, lng]);

                // 1. FAQUAT SHU GURUH NUQTALARINI XARITAGA MARKER QILIB QO'SHAMIZ
                const folderColor = currentFolders[activeFolderId]?.color || '#007AFF';
                const mIcon = L.divIcon({
                    className: 'custom-tp-marker',
                    html: `<i class="fas fa-map-marker-alt" style="color: ${folderColor}; font-size: 24px; text-shadow: 0 0 3px black;"></i>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 24]
                });

                const marker = L.marker([lat, lng], {icon: mIcon}).addTo(map);
                marker.bindPopup(`<b>${displayName}</b><br>${point.address}`);
                activeMapMarkers.push(marker);

                // 2. PASTKI RO'YXAT ELEMENTINI YARATISH
                const item = document.createElement('div');
                item.className = 'tp-item';
                item.style.cssText = `padding: 12px 15px; margin: 8px 0; background: #00223a; border-radius: 10px; cursor: pointer; border-left: 4px solid ${folderColor}; display: flex; flex-direction: column; gap: 3px;`;
                
                item.innerHTML = `
                    <div style="font-weight: bold; color: white; font-size: 15px;">${displayName}</div>
                    <div style="color: #88a0b0; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><i class="fas fa-map-marker-alt" style="margin-right:4px;"></i>${point.address}</div>
                `;

                // Ro'yxatdan bosganda xaritani centerlash va kontent panelini tepaga yig'ish
                item.addEventListener('click', () => {
                    // Rasmdagi kabi faqat xarita ko'rinishi uchun panelni vaqtinchalik yopamiz (lekin tepadagi tab qoladi!)
                    dynamicContentPanel.style.display = 'none';
                    
                    map.setView([lat, lng], 18);
                    marker.openPopup();

                    updatePanelValues(lat, lng, null, true);
                    updateAddress(lat, lng, true);
                });

                item.setAttribute('data-search-name', displayName.toLowerCase() + point.address.toLowerCase());
                tpListContainer.appendChild(item);
            }
        });

        // Agar guruhda nuqtalar bo'lsa xaritani avtomat o'sha guruh elementlari markaziga olib keladi (Centerlash)
        if (bounds.length > 0) {
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    });
}

// QIDIRUVNING TO'LIQ ISHLASHI
const elementSearchInput = document.getElementById('element-search');
if (elementSearchInput) {
    elementSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        document.querySelectorAll('.tp-item').forEach(item => {
            const searchStr = item.getAttribute('data-search-name') || '';
            item.style.display = searchStr.includes(query) ? 'flex' : 'none';
        });
    });
}

// Guruh tahrirlash mantiqlari (avvalgidek o'zgarishsiz qoladi...)
// ... (openEditFolder, delete va update funksiyalari kodingiz eng oxirida turaversin)
