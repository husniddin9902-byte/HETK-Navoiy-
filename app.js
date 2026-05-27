// ===============================
// FIREBASE SOZLAMALARI
// ===============================

const firebaseConfig = {
    apiKey: "AIzaSyBF0oT_ZhvE1tT1Qglh5GjPPhs8ZsyRWoc",
    authDomain: "energo-monitoring.firebaseapp.com",
    databaseURL: "https://energo-monitoring-default-rtdb.firebaseio.com",
    projectId: "energo-monitoring",
    storageBucket: "energo-monitoring.firebasestorage.app",
    messagingSenderId: "514032923022",
    appId: "1:514032923022:web:fe2f57b81a30d0c2f0"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.database();


// ===============================
// ASOSIY O'ZGARUVCHILAR
// ===============================

const appState = {

    folders: {},
    elements: {},

    selectedFolderId: null,

    mainMap: null,
    panelMap: null,

    panelMarkers: [],
    mainMarkers: []

};


// ===============================
// ASOSIY XARITA
// ===============================

function initMainMap() {

    appState.mainMap = L.map('map').setView([40.100, 65.350], 11);

    L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
            maxZoom: 20
        }
    ).addTo(appState.mainMap);

}


// ===============================
// PANEL XARITASI
// ===============================

function initPanelMap() {

    appState.panelMap = L.map('panel-map').setView([40.100, 65.350], 11);

    L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
            maxZoom: 20
        }
    ).addTo(appState.panelMap);

}


// ===============================
// PAPKALARNI YUKLASH
// ===============================

function loadFolders() {

    db.ref('folders').on('value', snapshot => {

        appState.folders = snapshot.val() || {};

        renderFolders();

        hideLoader();

    });

}


// ===============================
// ELEMENTLARNI YUKLASH
// ===============================

function loadElements() {

    db.ref('elements').on('value', snapshot => {

        appState.elements = snapshot.val() || {};

        renderPanelMarkers();

    });

}


// ===============================
// PAPKALARNI CHIQARISH
// ===============================

function renderFolders() {

    const root = document.getElementById('tree-root');

    root.innerHTML = '';

    Object.entries(appState.folders).forEach(([id, folder]) => {

        if (folder.parentId === 'root') {

            const item = createFolderElement(id, folder);

            root.appendChild(item);

        }

    });

}


// ===============================
// BIRTA PAPKA ELEMENTI
// ===============================

function createFolderElement(id, folder) {

    const wrapper = document.createElement('div');

    wrapper.className = 'folder-item';


    const header = document.createElement('div');

    header.className = 'folder-header';


    header.innerHTML = `
        <span style="color:${folder.color}">
            📁
        </span>

        <span>
            ${folder.name}
        </span>
    `;


    header.onclick = () => {

        appState.selectedFolderId = id;

        selectFolder(header);

        renderPanelMarkers();

    };


    wrapper.appendChild(header);


    const children = document.createElement('div');

    children.className = 'folder-children';


    Object.entries(appState.folders).forEach(([childId, childFolder]) => {

        if (childFolder.parentId === id) {

            children.appendChild(
                createFolderElement(childId, childFolder)
            );

        }

    });


    wrapper.appendChild(children);

    return wrapper;

}


// ===============================
// PAPKANI TANLASH
// ===============================

function selectFolder(activeHeader) {

    document.querySelectorAll('.folder-header').forEach(el => {

        el.classList.remove('active-folder');

    });

    activeHeader.classList.add('active-folder');

}


// ===============================
// PANEL MARKERLARI
// ===============================

function renderPanelMarkers() {

    appState.panelMarkers.forEach(marker => {

        appState.panelMap.removeLayer(marker);

    });

    appState.panelMarkers = [];


    Object.entries(appState.elements).forEach(([id, element]) => {

        if (!element.folderIds) return;


        if (
            appState.selectedFolderId &&
            !element.folderIds.includes(appState.selectedFolderId)
        ) {
            return;
        }


        const marker = L.marker([
            element.lat,
            element.lng
        ]).addTo(appState.panelMap);


        marker.bindPopup(`
            <b>${element.name}</b>
            <br>
            ${element.note || ''}
        `);


        appState.panelMarkers.push(marker);

    });

}


// ===============================
// PANELNI OCHISH
// ===============================

function initPanel() {

    const panel = document.getElementById('panel-overlay');

    document.getElementById('list-btn').onclick = () => {

        panel.classList.remove('hidden');

        setTimeout(() => {

            appState.panelMap.invalidateSize();

        }, 300);

    };


    document.getElementById('close-list').onclick = () => {

        panel.classList.add('hidden');

    };

}


// ===============================
// TABLAR
// ===============================

function initTabs() {

    const folderBtn = document.getElementById('tab-folders');

    const mapBtn = document.getElementById('tab-items');

    const foldersTab = document.getElementById('folders-section');

    const mapTab = document.getElementById('items-section');


    folderBtn.onclick = () => {

        folderBtn.classList.add('active');

        mapBtn.classList.remove('active');

        foldersTab.style.display = 'block';

        mapTab.style.display = 'none';

    };


    mapBtn.onclick = () => {

        mapBtn.classList.add('active');

        folderBtn.classList.remove('active');

        foldersTab.style.display = 'none';

        mapTab.style.display = 'block';

        setTimeout(() => {

            appState.panelMap.invalidateSize();

        }, 300);

    };

}


// ===============================
// LOADERNI YOPISH
// ===============================

function hideLoader() {

    document.getElementById('app-loader').style.display = 'none';

}


// ===============================
// SAYT ISHGA TUSHISHI
// ===============================

window.onload = () => {

    initMainMap();

    initPanelMap();

    initPanel();

    initTabs();
initMapSwitcher();
    loadFolders();

    loadElements();

};
// ===============================
// XARITA TURINI ALMASHTIRISH
// ===============================

let currentMapType = 'normal';

const normalLayer = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
        maxZoom: 20
    }
);

const satelliteLayer = L.tileLayer(
    'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    {
        maxZoom: 20,
        subdomains:['mt0','mt1','mt2','mt3']
    }
);


function initMapSwitcher() {

    const mapBtn = document.getElementById('map-type-btn');

    if(!mapBtn) return;


    mapBtn.onclick = () => {

        if(currentMapType === 'normal') {

            appState.mainMap.eachLayer(layer => {

                appState.mainMap.removeLayer(layer);

            });

            satelliteLayer.addTo(appState.mainMap);

            currentMapType = 'satellite';

        } else {

            appState.mainMap.eachLayer(layer => {

                appState.mainMap.removeLayer(layer);

            });

            normalLayer.addTo(appState.mainMap);

            currentMapType = 'normal';

        }

    };

}
