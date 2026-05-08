// Sizning Firebase konfiguratsiyangiz
const firebaseConfig = {
  apiKey: "AIzaSyBFOoT_ZhvE1tT1Qglh5GjPPhs8ZsyRWoc",
  authDomain: "energo-monitoring.firebaseapp.com",
  databaseURL: "https://energo-monitoring-default-rtdb.firebaseio.com",
  projectId: "energo-monitoring",
  storageBucket: "energo-monitoring.firebasestorage.app",
  messagingSenderId: "514032923022",
  appId: "1:514032923022:web:fe2f57b81a30d0c2fd74df",
  measurementId: "G-DCH7TPJJSL"
};

// Firebase-ni ishga tushirish
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let currentPath = "hierarxiya"; // Hozirgi turgan joyimiz (papka)

// Hududlarni ekranga chiqarish funksiyasi
function loadFolders(path) {
    const folderList = document.getElementById('folder-list');
    folderList.innerHTML = "Yuklanmoqda...";
    
    database.ref(path).on('value', (snapshot) => {
        folderList.innerHTML = "";
        const data = snapshot.val();
        
        if (data) {
            Object.keys(data).forEach(key => {
                const item = data[key];
                const div = document.createElement('div');
                div.className = "folder-item";
                div.innerHTML = `<i class="fas fa-folder"></i> <span>${item.nomi}</span>`;
                div.onclick = () => {
                    currentPath = `${path}/${key}/bolimlar`;
                    loadFolders(currentPath);
                };
                folderList.appendChild(div);
            });
        } else {
            folderList.innerHTML = "<p>Hali bu yerda papkalar yo'q.</p>";
        }
    });
}

// Yangi papka (hudud) qo'shish funksiyasi
function addFolder() {
    const name = prompt("Yangi hudud/bo'lim nomini yozing:");
    if (name) {
        const newFolderRef = database.ref(currentPath).push();
        newFolderRef.set({
            nomi: name,
            turi: "papka"
        }).then(() => alert("Qo'shildi!"));
    }
}

// Ilovani boshlash
document.addEventListener('DOMContentLoaded', () => {
    loadFolders(currentPath);
    document.getElementById('add-btn').onclick = addFolder;
    document.getElementById('back-btn').onclick = () => {
        // Orqaga qaytish mantiqi (oddiy ko'rinishi)
        currentPath = "hierarxiya";
        loadFolders(currentPath);
    };
});

