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

const appState = {

    selectedNodeId: null,
    selectedNodeType: null,

    folders: {},
    elements: {},

    mainMap: {
        map: null,
        markers: []
    },

    panelMap: {
        map: null,
        markers: []
    }
};

appState.mainMap.map = L.map('map', {
    zoomControl: false
}).setView([40.1, 65.3], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20
}).addTo(appState.mainMap.map);

function initPanelMap() {

    appState.panelMap.map = L.map('panel-map', {
        zoomControl: true
    }).setView([40.1, 65.3], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 20
    }).addTo(appState.panelMap.map);
}

function loadFolders() {

    db.ref('folders').on('value', snapshot => {

        appState.folders = snapshot.val() || {};

        renderTree();
    });
}

function loadElements() {

    db.ref('elements').on('value', snapshot => {

        appState.elements = snapshot.val() || {};

        renderPanelMap();
    });
}

function renderTree() {

    const root = document.getElementById('tree-root');

    root.innerHTML = '';

    Object.entries(appState.folders).forEach(([id, folder]) => {

        if (folder.parentId === 'root') {
            root.appendChild(buildFolderNode(id, folder));
        }
    });
}

function buildFolderNode(id, folder) {

    const wrapper = document.createElement('div');
    wrapper.className = 'folder-item';

    const header = document.createElement('div');
    header.className = 'folder-header';

    header.innerHTML = `
        <span style="color:${folder.color}">📁</span>
        <span>${folder.name}</span>
    `;

    header.onclick = () => {

        appState.selectedNodeId = id;
        appState.selectedNodeType = 'folder';

        renderPanelMap();

        document.querySelectorAll('.folder-header').forEach(el => {
            el.classList.remove('active');
        });

        header.classList.add('active');
    };

    wrapper.appendChild(header);

    const children = document.createElement('div');
    children.className = 'folder-children';

    Object.entries(appState.folders).forEach(([childId, childFolder]) => {

        if (childFolder.parentId === id) {
            children.appendChild(buildFolderNode(childId, childFolder));
        }
    });

    wrapper.appendChild(children);

    return wrapper;
}

function renderPanelMap() {

    appState.panelMap.markers.forEach(marker => {
        appState.panelMap.map.removeLayer(marker);
    });

    appState.panelMap.markers = [];

    Object.entries(appState.elements).forEach(([id, element]) => {

        if (!element.folderIds) return;

        if (
            appState.selectedNodeId &&
            !element.folderIds.includes(appState.selectedNodeId)
        ) {
            return;
        }

        const marker = L.marker([
            element.lat,
            element.lng
        ]).addTo(appState.panelMap.map);

        marker.bindPopup(`
            <b>${element.name}</b><br>
            ${element.note || ''}
        `);

        appState.panelMap.markers.push(marker);
    });
}

function initTabs() {

    const buttons = document.querySelectorAll('.tab-btn');

    buttons.forEach(button => {

        button.onclick = () => {

            buttons.forEach(btn => {
                btn.classList.remove('active');
            });

            button.classList.add('active');

            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });

            if (button.dataset.tab === 'folders') {
                document.getElementById('folders-tab').classList.add('active');
            }

            if (button.dataset.tab === 'panel-map') {

                document.getElementById('panel-map-tab').classList.add('active');

                setTimeout(() => {
                    appState.panelMap.map.invalidateSize();
                }, 200);
            }
        };
    });
}

function initPanel() {

    document.getElementById('panel-btn').onclick = () => {
        document.getElementById('panel-overlay').classList.remove('hidden');
    };

    document.getElementById('close-panel-btn').onclick = () => {
        document.getElementById('panel-overlay').classList.add('hidden');
    };
}

function initBottomPanel() {

    const panel = document.getElementById('bottom-panel');

    document.getElementById('panel-toggle').onclick = () => {
        panel.classList.toggle('minimized');
    };
}

function initLocate() {

    document.getElementById('locate-btn').onclick = () => {

        navigator.geolocation.getCurrentPosition(position => {

            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            document.getElementById('latitude').innerText = lat;
            document.getElementById('longitude').innerText = lng;

            appState.mainMap.map.setView([lat, lng], 17);

            L.marker([lat, lng]).addTo(appState.mainMap.map);
        });
    };
}

window.onload = () => {

    initPanelMap();

    initTabs();

    initPanel();

    initBottomPanel();

    initLocate();

    loadFolders();

    loadElements();

    document.getElementById('app-loader').style.display = 'none';
};
