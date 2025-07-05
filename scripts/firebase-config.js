// Firebase configuration
// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your web app's Firebase configuration
// Replace with your actual Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyCaYrfHIQbweS4HIPut5fQH9pXdfV8NM6c",
    authDomain: "expense-manager-dp.firebaseapp.com",
    projectId: "expense-manager-dp",
    storageBucket: "expense-manager-dp.firebasestorage.app",
    messagingSenderId: "903103928646",
    appId: "1:903103928646:web:b3c50f8fc249d906216d47"
    // measurementId: "G-YGJEQXG43C"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

// Configure Google Auth Provider
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

// Export the app instance
export default app; 