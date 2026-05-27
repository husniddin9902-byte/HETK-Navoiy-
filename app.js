// ===============================
// FIREBASE
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
// APP HOLATI
// ===============================

const appState = {

    folders: {},
    elements: {},

    selectedFolder: null,

    mainMap: null,
    panelMap: null,

    currentMapType: 'satellite',

    panelMarkers: [],
    mainMarkers: []

};


// ===============================
// XARITA QATLAMLARI
// ===============================

const satelliteLayer = L.tileLayer(
    'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    {
        maxZoom: 20,
        subdomains:['mt0','mt1','mt2','mt3']
    }
);

const normalLayer = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
        maxZoom: 20
    }
);


// ===============================
// ASOSIY XARITA
// ===============================

function initMainMap() {

    appState.mainMap = L.map('map', {
        zoomControl: false
    }).setView([40.100, 65.350], 10);

    satelliteLayer.addTo(appState.mainMap);

}


// ===============================
// PANEL XARITASI
// ===============================

function initPanelMap() {

    const panelMapDiv = document.getElementById('panel-map');

    if(!panelMapDiv) return;

    appState.panelMap = L.map('panel-map').setView([40.100, 65.350], 10);

    satelliteLayer.addTo(appState.panelMap);

}


// ===============================
// LOADER
// ===============================

function hideLoader() {

    const loader = document.getElementById('app-loader');

    if(loader){

        loader.style.display = 'none';

    }

}


// ===============================
// PANEL
// ===============================

function initPanel() {

    const panel = document.getElementById('list-container');

    const openBtn = document.getElementById('list-btn');

    const closeBtn = document.getElementById('close-list');


    if(openBtn){

        openBtn.onclick = () => {

            panel.style.display = 'flex';

            setTimeout(() => {

                if(appState.panelMap){

                    appState.panelMap.invalidateSize();

                }

            }, 300);

        };

    }


    if(closeBtn){

        closeBtn.onclick = () => {

            panel.style.display = 'none';

        };

    }

}


// ===============================
// TABLAR
// ===============================

function initTabs() {

    const foldersBtn = document.getElementById('tab-folders');

    const mapBtn = document.getElementById('tab-items');

    const foldersSection = document.getElementById('folders-section');

    const mapSection = document.getElementById('items-section');


    if(foldersBtn){

        foldersBtn.onclick = () => {

            foldersBtn.classList.add('active');

            mapBtn.classList.remove('active');

            foldersSection.style.display = 'block';

            mapSection.style.display = 'none';

        };

    }


    if(mapBtn){

        mapBtn.onclick = () => {

            mapBtn.classList.add('active');

            foldersBtn.classList.remove('active');

            foldersSection.style.display = 'none';

            mapSection.style.display = 'block';

            setTimeout(() => {

                if(appState.panelMap){

                    appState.panelMap.invalidateSize();

                }

            }, 300);

        };

    }

}


// ===============================
// XARITA TURINI ALMASHTIRISH
// ===============================

function initMapSwitcher() {

    const mapBtn = document.getElementById('map-type-btn');

    if(!mapBtn) return;


    mapBtn.onclick = () => {

        appState.mainMap.eachLayer(layer => {

            appState.mainMap.removeLayer(layer);

        });


        if(appState.currentMapType === 'satellite'){

            normalLayer.addTo(appState.mainMap);

            appState.currentMapType = 'normal';

        } else {

            satelliteLayer.addTo(appState.mainMap);

            appState.currentMapType = 'satellite';

        }

    };

}


// ===============================
// PAPKALARNI YUKLASH
// ===============================

function loadFolders() {

    db.ref('folders').on('value', snapshot => {

        appState.folders = snapshot.val() || {};

        renderFolders();

    });

}


// ===============================
// PAPKALARNI CHIQARISH
// ===============================

function renderFolders() {

    const treeRoot = document.getElementById('tree-root');

    if(!treeRoot) return;

    treeRoot.innerHTML = '';

    Object.entries(appState.folders).forEach(([id, folder]) => {

        if(folder.parentId === 'root'){

            const item = createFolderItem(id, folder);

            treeRoot.appendChild(item);

        }

    });

}


// ===============================
// PAPKA ELEMENTI
// ===============================

function createFolderItem(id, folder) {

    const wrapper = document.createElement('div');

    wrapper.className = 'folder-item';


    const header = document.createElement('div');

    header.className = 'folder-header';


    header.innerHTML = `
        <span style="
            width:14px;
            height:14px;
            border-radius:50%;
            background:${folder.color || '#00ff88'};
            display:inline-block;
            margin-right:10px;
        "></span>

        <span>${folder.name}</span>
    `;


    header.onclick = () => {

        document.querySelectorAll('.folder-header').forEach(el => {

            el.classList.remove('active-folder');

        });

        header.classList.add('active-folder');

        appState.selectedFolder = id;

        renderPanelMarkers();

    };


    wrapper.appendChild(header);


    const children = document.createElement('div');

    children.className = 'folder-children';


    Object.entries(appState.folders).forEach(([childId, child]) => {

        if(child.parentId === id){

            children.appendChild(

                createFolderItem(childId, child)

            );

        }

    });


    wrapper.appendChild(children);

    return wrapper;

}


// ===============================
// ELEMENTLAR
// ===============================

function loadElements() {

    db.ref('elements').on('value', snapshot => {

        appState.elements = snapshot.val() || {};

        renderPanelMarkers();

    });

}


// ===============================
// MARKERLAR
// ===============================

function renderPanelMarkers() {

    if(!appState.panelMap) return;


    appState.panelMarkers.forEach(marker => {

        appState.panelMap.removeLayer(marker);

    });

    appState.panelMarkers = [];


    Object.entries(appState.elements).forEach(([id, element]) => {

        if(!element.lat || !element.lng) return;


        if(
            appState.selectedFolder &&
            element.folderIds &&
            !element.folderIds.includes(appState.selectedFolder)
        ){
            return;
        }


        const marker = L.marker([
            element.lat,
            element.lng
        ]).addTo(appState.panelMap);


        marker.bindPopup(`
            <b>${element.name || 'TP'}</b>
            <br>
            ${element.note || ''}
        `);


        appState.panelMarkers.push(marker);

    });

}


// ===============================
// GPS
// ===============================

function initLocateButton() {

    const locateBtn = document.getElementById('locate-btn');

    if(!locateBtn) return;


    locateBtn.onclick = () => {

        navigator.geolocation.getCurrentPosition(pos => {

            const lat = pos.coords.latitude;

            const lng = pos.coords.longitude;

            appState.mainMap.setView([lat, lng], 16);

            L.marker([lat, lng]).addTo(appState.mainMap);

        });

    };

}


// ===============================
// SAYT ISHGA TUSHISHI
// ===============================

window.onload = () => {

    try {

        initMainMap();

        initPanelMap();

        initPanel();

        initTabs();

        initMapSwitcher();

        initLocateButton();

        loadFolders();

        loadElements();

        setTimeout(() => {

            hideLoader();

        }, 1000);

    } catch(err){

        console.log(err);

        hideLoader();

    }

};
