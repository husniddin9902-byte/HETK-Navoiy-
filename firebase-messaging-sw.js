/* HETK brauzer bildirishnomalari uchun Firebase service worker. */
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBFOoT_ZhvE1tT1Qglh5GjPPhs8ZsyRWoc',
  authDomain: 'energo-monitoring.firebaseapp.com',
  databaseURL: 'https://energo-monitoring-default-rtdb.firebaseio.com',
  projectId: 'energo-monitoring',
  storageBucket: 'energo-monitoring.firebasestorage.app',
  messagingSenderId: '514032923022',
  appId: '1:514032923022:web:fe2f57b81a30d0c2fd74df'
});

firebase.messaging();
