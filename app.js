// --- OLDINGI FIREBASE VA MAP SOZLAMALARI O'ZGARISHSIZ QOLADI ---
// (Bu yerda sizning FirebaseConfig va Map init qismlari turadi...)

// --- YANGI O'ZGARUVCHILAR ---
let currentFolders = {}; // Bazadagi papkalarni vaqtinchalik saqlash uchun
let activeFolderId = 'root'; // Hozirgi tanlangan papka

// --- 1. PAPKA PANELINI BOSHQARISH (UI) ---
const listBtn = document.getElementById('list-btn');
const listModal = document.getElementById('list-container');
const closeList = document.getElementById('close-list');
const openAddBtn = document.getElementById('open-add-folder');
const addFolderPanel = document.getElementById('add-folder-panel');
const cancelFolder = document.getElementById('cancel-folder');
const hueSlider = document.getElementById('color-slider');
const colorPreview = document.getElementById('color-preview');

// Ro'yxatni ochish/yopish
listBtn.addEventListener('click', () => { listModal.style.display = 'flex'; loadFolders(); });
closeList.addEventListener('click', () => { listModal.style.display = 'none'; });

// Guruh qo'shish panelini ochish (Bottom Sheet)
openAddBtn.addEventListener('click', () => {
    addFolderPanel.classList.remove('hidden');
    updateParentSelect(); // Papkalarni tanlovga yuklash
});
cancelFolder.addEventListener('click', () => { addFolderPanel.classList.add('hidden'); });

// Hue Slider orqali rang tanlash
hueSlider.addEventListener('input', (e) => {
    const color = `hsl(${e.target.value}, 100%, 50%)`;
    colorPreview.style.background = color;
});

// --- 2. PAPKANI BAZAGA SAQLASH (ADMIN) ---
document.getElementById('save-folder').addEventListener('click', () => {
    const name = document.getElementById('new-group-name').value;
    const parentId = document.getElementById('parent-folder-select').value;
    const hue = hueSlider.value;
    const color = `hsl(${hue}, 100%, 50%)`;

    if (!name) return showToast("Nomini kiriting!");

    database.ref('Folders').push({
        name: name,
        parentId: parentId,
        color: color,
        hue: hue, // Qidiruv va tahrirlash uchun
        createdAt: Date.now()
    }).then(() => {
        showToast("Papka yaratildi!");
        document.getElementById('new-group-name').value = "";
        addFolderPanel.classList.add('hidden');
    });
});

// --- 3. DARAXTSIMON RO'YXATNI YUKLASH (TREE VIEW) ---
function loadFolders() {
    database.ref('Folders').on('value', (snapshot) => {
        const folders = snapshot.val() || {};
        currentFolders = folders;
        renderTree('root', document.getElementById('tree-root'));
    });
}

function renderTree(parentId, container) {
    container.innerHTML = "";
    
    // Ona papkaga tegishli bo'lgan bolalarni ajratib olish
    const children = Object.keys(currentFolders).filter(id => currentFolders[id].parentId === parentId);

    children.forEach(id => {
        const folder = currentFolders[id];
        const item = document.createElement('div');
        item.className = 'folder-item';
        item.innerHTML = `
            <div class="folder-header" id="folder-${id}">
                <span class="toggle-btn" onclick="toggleFolderView('${id}')">+</span>
                <i class="fas fa-folder" style="color: ${folder.color}; margin-right: 8px;"></i>
                <span onclick="selectFolder('${id}')">${folder.name}</span>
            </div>
            <div id="children-${id}" class="folder-children" style="display: none;"></div>
        `;
        container.appendChild(item);
        
        // Rekursiya: Ichki papkalarni yuklash
        renderTree(id, item.querySelector(`#children-${id}`));
    });
}

function toggleFolderView(id) {
    const childDiv = document.getElementById(`children-${id}`);
    const btn = document.querySelector(`#folder-${id} .toggle-btn`);
    if (childDiv.style.display === "none") {
        childDiv.style.display = "block";
        btn.innerText = "-";
    } else {
        childDiv.style.display = "none";
        btn.innerText = "+";
    }
}

// --- 4. IERARXIK RANG MEROSI VA XARITA ---
function selectFolder(folderId) {
    activeFolderId = folderId;
    listModal.style.display = 'none'; // Xaritani ko'rish uchun yopamiz
    showToast(`${currentFolders[folderId].name} tanlandi`);
    
    // Bu yerda xaritadagi markerlarni tanlangan papka rangiga qarab yangilaymiz
    refreshMarkersOnMap();
}

function refreshMarkersOnMap() {
    // Kelajakda TP (Transformatorlar) yuklanganda 
    // bu funksiya tanlangan papka ID si bo'yicha markerlarni ranglaydi.
}

// --- 5. ADMIN UCHUN PAPKALAR RO'YXATINI SELECTGA YUKLASH ---
function updateParentSelect() {
    const select = document.getElementById('parent-folder-select');
    select.innerHTML = '<option value="root">Asosiy papka (Bosh)</option>';
    
    Object.keys(currentFolders).forEach(id => {
        const option = document.createElement('option');
        option.value = id;
        option.innerText = currentFolders[id].name;
        select.appendChild(option);
    });
}

// --- OLDINGI SAQLASH TUGMASINI TP BILAN BOG'LASH (Yangilangan) ---
document.querySelector('.save-btn').addEventListener('click', function() {
    const lat = document.getElementById('latitude').innerText;
    const lng = document.getElementById('longitude').innerText;
    
    if (activeFolderId === 'root') {
        return showToast("Oldin papka tanlang!");
    }

    database.ref('TPs').push({
        lat: lat,
        lng: lng,
        folderId: activeFolderId, // Qaysi papka ichida ekani
        name: "Yangi TP", // Tahrirlashda o'zgartiriladi
        time: new Date().toLocaleString(),
        address: document.getElementById('address').innerText
    }).then(() => { 
        showToast("Element papkaga saqlandi!"); 
    });
});
