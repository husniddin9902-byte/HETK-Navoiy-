// ======================================
// FIREBASE
// ======================================

const firebaseConfig = {

    apiKey: "AIzaSyBF0oT_ZhvE1tT1Qglh5GjPPhs8ZsyRWoc",

    authDomain: "energo-monitoring.firebaseapp.com",

    databaseURL:
    "https://energo-monitoring-default-rtdb.firebaseio.com",

    projectId: "energo-monitoring",

    storageBucket:
    "energo-monitoring.appspot.com",

    messagingSenderId: "514032923022",

    appId:
    "1:514032923022:web:fe2f57b81a30d0c2f0"

};

firebase.initializeApp(firebaseConfig);

const db = firebase.database();

const storage = firebase.storage();


// ======================================
// GLOBAL STATE
// ======================================

const appState = {

    folders: {},

    elements: {},

    selectedFolderId: null,

    selectedElementId: null,

    currentLat: null,

    currentLng: null,

    currentAddress: '',

    mainMap: null,

    panelMap: null,

    currentMapType: 'satellite',

    mainMarkers: [],

    panelMarkers: []

};


// ======================================
// TILE LAYERS
// ======================================

const satelliteLayer = L.tileLayer(

    'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',

    {
        maxZoom: 22,
        subdomains:['mt0','mt1','mt2','mt3']
    }

);

const normalLayer = L.tileLayer(

    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',

    {
        maxZoom: 22
    }

);


// ======================================
// INIT MAIN MAP
// ======================================

function initMainMap(){

    appState.mainMap = L.map('map', {

        zoomControl:false

    }).setView([40.100, 65.350], 10);


    satelliteLayer.addTo(appState.mainMap);


    appState.mainMap.on('click', e => {

        const lat = e.latlng.lat;

        const lng = e.latlng.lng;

        updateCoords(lat, lng);

    });

}


// ======================================
// INIT PANEL MAP
// ======================================

function initPanelMap(){

    appState.panelMap = L.map('panel-map')
    .setView([40.100, 65.350], 10);

    satelliteLayer.addTo(appState.panelMap);

}


// ======================================
// UPDATE COORDS
// ======================================

function updateCoords(lat, lng){

    appState.currentLat = lat;

    appState.currentLng = lng;


    document.getElementById('latitude')
    .innerText = lat.toFixed(6);

    document.getElementById('longitude')
    .innerText = lng.toFixed(6);


    reverseGeocode(lat, lng);

}


// ======================================
// REVERSE GEOCODE
// ======================================

async function reverseGeocode(lat, lng){

    try{

        const url =
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;

        const res = await fetch(url);

        const data = await res.json();

        const address =
        data.display_name || 'Aniqlanmadi';

        appState.currentAddress = address;

        document.getElementById('address')
        .innerText = address;

    }catch(err){

        console.log(err);

    }

}


// ======================================
// GPS
// ======================================

function initLocate(){

    const btn =
    document.getElementById('locate-btn');

    btn.onclick = () => {

        navigator.geolocation.getCurrentPosition(

            pos => {

                const lat =
                pos.coords.latitude;

                const lng =
                pos.coords.longitude;

                appState.mainMap.setView(
                    [lat, lng],
                    17
                );

                updateCoords(lat, lng);

                L.marker([lat, lng])
                .addTo(appState.mainMap);

            },

            err => {

                alert(
                    'GPS ruxsat berilmadi'
                );

            }

        );

    };

}


// ======================================
// PANEL
// ======================================

function initPanel(){

    const panel =
    document.getElementById('side-panel');

    const openBtn =
    document.getElementById('menu-btn');

    const closeBtn =
    document.getElementById('close-panel-btn');


    openBtn.onclick = () => {

        panel.classList.add('active');

        setTimeout(() => {

            appState.panelMap.invalidateSize();

        }, 300);

    };


    closeBtn.onclick = () => {

        panel.classList.remove('active');

    };


    panel.querySelector('.side-overlay')
    .onclick = () => {

        panel.classList.remove('active');

    };

}


// ======================================
// TABS
// ======================================

function initTabs(){

    const foldersBtn =
    document.getElementById(
        'folders-tab-btn'
    );

    const mapBtn =
    document.getElementById(
        'map-tab-btn'
    );

    const foldersTab =
    document.getElementById(
        'folders-tab'
    );

    const mapTab =
    document.getElementById(
        'map-tab'
    );


    foldersBtn.onclick = () => {

        foldersBtn.classList.add('active');

        mapBtn.classList.remove('active');

        foldersTab.classList.add('active');

        mapTab.classList.remove('active');

    };


    mapBtn.onclick = () => {

        mapBtn.classList.add('active');

        foldersBtn.classList.remove('active');

        mapTab.classList.add('active');

        foldersTab.classList.remove('active');


        setTimeout(() => {

            appState.panelMap.invalidateSize();

        }, 300);

    };

}


// ======================================
// MAP SWITCH
// ======================================

function initMapSwitcher(){

    const btn =
    document.getElementById(
        'map-type-btn'
    );

    btn.onclick = () => {

        appState.mainMap.eachLayer(layer => {

            appState.mainMap.removeLayer(layer);

        });


        if(
            appState.currentMapType
            === 'satellite'
        ){

            normalLayer.addTo(
                appState.mainMap
            );

            appState.currentMapType =
            'normal';

        }else{

            satelliteLayer.addTo(
                appState.mainMap
            );

            appState.currentMapType =
            'satellite';

        }

    };

}


// ======================================
// BOTTOM PANEL
// ======================================

function initBottomPanel(){

    const panel =
    document.getElementById(
        'bottom-panel'
    );

    const toggle =
    document.getElementById(
        'panel-toggle'
    );

    toggle.onclick = () => {

        panel.classList.toggle(
            'minimized'
        );

    };

}


// ======================================
// COPY COORDS
// ======================================

function initCopy(){

    const btn =
    document.getElementById(
        'copy-btn'
    );

    btn.onclick = () => {

        const text =

`Latitude: ${appState.currentLat}
Longitude: ${appState.currentLng}`;

        navigator.clipboard.writeText(
            text
        );

        alert('Nusxalandi');

    };

}


// ======================================
// SHARE
// ======================================

function initShare(){

    const btn =
    document.getElementById(
        'share-btn'
    );

    btn.onclick = async () => {

        const text =

`${appState.currentAddress}

https://maps.google.com/?q=${appState.currentLat},${appState.currentLng}`;

        if(navigator.share){

            navigator.share({

                title:'Lokatsiya',

                text:text

            });

        }else{

            alert(text);

        }

    };

}


// ======================================
// SEARCH
// ======================================

function initSearch(){

    const input =
    document.getElementById(
        'folder-search-input'
    );

    input.addEventListener(
        'input',
        () => {

            renderFolders(
                input.value
                .toLowerCase()
            );

        }
    );

}


// ======================================
// LOAD FOLDERS
// ======================================

function loadFolders(){

    db.ref('folders')
    .on('value', snapshot => {

        appState.folders =
        snapshot.val() || {};

        renderFolders();

    });

}


// ======================================
// RENDER FOLDERS
// ======================================

function renderFolders(search=''){

    const root =
    document.getElementById(
        'tree-root'
    );

    root.innerHTML = '';

    Object.entries(appState.folders)
    .forEach(([id, folder]) => {

        if(folder.parentId === 'root'){

            if(
                search &&
                !folder.name
                .toLowerCase()
                .includes(search)
            ){
                return;
            }

            root.appendChild(

                createFolderNode(
                    id,
                    folder
                )

            );

        }

    });

}


// ======================================
// CREATE FOLDER NODE
// ======================================

function createFolderNode(id, folder){

    const wrapper =
    document.createElement('div');

    wrapper.className =
    'folder-item';


    const header =
    document.createElement('div');

    header.className =
    'folder-header';


    header.innerHTML = `

    <div style="
    width:14px;
    height:14px;
    border-radius:50%;
    background:${folder.color || '#00aaff'};
    "></div>

    <div>
        ${folder.name}
    </div>

    `;


    header.onclick = () => {

        document
        .querySelectorAll(
            '.folder-header'
        )
        .forEach(el => {

            el.classList.remove(
                'active-folder'
            );

        });

        header.classList.add(
            'active-folder'
        );

        appState.selectedFolderId =
        id;

        renderMarkers();

    };


    wrapper.appendChild(header);


    const children =
    document.createElement('div');

    children.className =
    'folder-children';


    Object.entries(appState.folders)
    .forEach(([childId, child]) => {

        if(child.parentId === id){

            children.appendChild(

                createFolderNode(
                    childId,
                    child
                )

            );

        }

    });


    wrapper.appendChild(children);

    return wrapper;

}


// ======================================
// LOAD ELEMENTS
// ======================================

function loadElements(){

    db.ref('elements')
    .on('value', snapshot => {

        appState.elements =
        snapshot.val() || {};

        renderMarkers();

    });

}


// ======================================
// CLEAR MARKERS
// ======================================

function clearMarkers(){

    appState.mainMarkers
    .forEach(marker => {

        appState.mainMap
        .removeLayer(marker);

    });

    appState.panelMarkers
    .forEach(marker => {

        appState.panelMap
        .removeLayer(marker);

    });

    appState.mainMarkers = [];

    appState.panelMarkers = [];

}


// ======================================
// RENDER MARKERS
// ======================================

function renderMarkers(){

    clearMarkers();

    Object.entries(appState.elements)
    .forEach(([id, element]) => {

        if(
            appState.selectedFolderId &&
            element.folderIds &&
            !element.folderIds.includes(
                appState.selectedFolderId
            )
        ){
            return;
        }

        if(
            !element.lat ||
            !element.lng
        ){
            return;
        }


        const marker1 =
        createMarker(element)
        .addTo(appState.mainMap);

        const marker2 =
        createMarker(element)
        .addTo(appState.panelMap);


        appState.mainMarkers
        .push(marker1);

        appState.panelMarkers
        .push(marker2);

    });

}


// ======================================
// CREATE MARKER
// ======================================

function createMarker(element){

    const marker = L.marker([

        element.lat,

        element.lng

    ]);


    marker.bindPopup(`

    <div style="
    min-width:220px;
    ">

        <div style="
        font-size:16px;
        font-weight:700;
        margin-bottom:8px;
        ">
            ${element.name || 'TP'}
        </div>

        <div style="
        font-size:13px;
        margin-bottom:6px;
        ">
            ${element.phone || ''}
        </div>

        <div style="
        font-size:13px;
        ">
            ${element.note || ''}
        </div>

    </div>

    `);

    return marker;

}


// ======================================
// SAVE LOCATION BUTTON
// ======================================

function initSaveButton(){

    const btn =
    document.getElementById(
        'save-btn'
    );

    btn.onclick = () => {

        document
        .getElementById(
            'element-modal'
        )
        .classList.remove('hidden');


        document
        .getElementById(
            'element-lat-input'
        )
        .value = appState.currentLat;


        document
        .getElementById(
            'element-lng-input'
        )
        .value = appState.currentLng;

    };

}


// ======================================
// LOADER
// ======================================

function hideLoader(){

    document
    .getElementById(
        'app-loader'
    )
    .style.display = 'none';

}


// ======================================
// START
// ======================================

window.onload = () => {

    initMainMap();

    initPanelMap();

    initLocate();

    initPanel();

    initTabs();

    initMapSwitcher();

    initBottomPanel();

    initCopy();

    initShare();

    initSearch();

    initSaveButton();

    loadFolders();

    loadElements();

    setTimeout(() => {

        hideLoader();

    }, 1000);

};
