// Firebase configuration - Replace with your project's config
const firebaseConfig = {
  apiKey: "AIzaSyBYjOZqjDfUG5gkZatuJI2AVHw8WWwU92M",
  authDomain: "nexus-machinery.firebaseapp.com",
  projectId: "nexus-machinery",
  storageBucket: "nexus-machinery.firebasestorage.app",
  messagingSenderId: "165083917791",
  appId: "1:165083917791:web:c6f8bca1ce81d3c272286a"
};

firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();
