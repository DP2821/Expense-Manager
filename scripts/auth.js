// Authentication functionality
import { auth, googleProvider } from './firebase-config.js';
import { 
    signInWithPopup, 
    signInAnonymously, 
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// DOM elements - only initialize if we're on the login page
const googleSignInBtn = document.getElementById('google-signin-btn');
const guestLoginBtn = document.getElementById('guest-login-btn');
const loginSection = document.getElementById('login-section');
const loadingSection = document.getElementById('loading-section');

// Only set up event listeners if we're on the login page
if (googleSignInBtn && guestLoginBtn && loginSection && loadingSection) {
    // Check if user is already logged in
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is signed in
            console.log('User is signed in:', user.email || 'Anonymous');
            redirectToDashboard();
        } else {
            // User is signed out
            console.log('User is signed out');
            showLoginSection();
        }
    });

    // Google Sign In
    googleSignInBtn.addEventListener('click', async () => {
        try {
            showLoadingSection();
            
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            
            console.log('Google sign-in successful:', user.email);
            toastr.success(`Welcome, ${user.displayName || user.email}!`);
            
            // Redirect to dashboard after successful login
            setTimeout(() => {
                redirectToDashboard();
            }, 1000);
            
        } catch (error) {
            console.error('Google sign-in error:', error);
            showLoginSection();
            
            // Handle specific error cases
            if (error.code === 'auth/popup-closed-by-user') {
                toastr.warning('Sign-in was cancelled. Please try again.');
            } else if (error.code === 'auth/popup-blocked') {
                toastr.error('Pop-up was blocked. Please allow pop-ups for this site.');
            } else {
                toastr.error('Sign-in failed. Please try again.');
            }
        }
    });

    // Guest Login
    guestLoginBtn.addEventListener('click', async () => {
        try {
            showLoadingSection();
            
            const result = await signInAnonymously(auth);
            const user = result.user;
            
            console.log('Guest login successful:', user.uid);
            toastr.success('Welcome! You are now signed in as a guest.');
            
            // Redirect to dashboard after successful login
            setTimeout(() => {
                redirectToDashboard();
            }, 1000);
            
        } catch (error) {
            console.error('Guest login error:', error);
            showLoginSection();
            toastr.error('Guest login failed. Please try again.');
        }
    });

    // Show loading section
    function showLoadingSection() {
        loginSection.classList.add('d-none');
        loadingSection.classList.remove('d-none');
    }

    // Show login section
    function showLoginSection() {
        loginSection.classList.remove('d-none');
        loadingSection.classList.add('d-none');
    }

    // Redirect to dashboard
    function redirectToDashboard() {
        window.location.href = 'Dashboard.html';
    }
}

// Get current user
export function getCurrentUser() {
    return auth.currentUser;
}

// Check if user is authenticated
export function isAuthenticated() {
    return auth.currentUser !== null;
}

// Get user ID (for Firestore operations)
export function getUserId() {
    const user = auth.currentUser;
    if (user) {
        return user.uid;
    }
    
    // If currentUser is null but we're on a protected page, 
    // the user should be authenticated (auth-guard would have redirected)
    // This is a fallback for timing issues
    console.warn('auth.currentUser is null, but user should be authenticated');
    return null;
}

// Get user email (for display purposes)
export function getUserEmail() {
    const user = auth.currentUser;
    return user ? (user.email || 'Guest User') : null;
}

// Get user display name
export function getUserDisplayName() {
    const user = auth.currentUser;
    return user ? (user.displayName || user.email || 'Guest User') : null;
} 