// Authentication guard for protected pages
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { logout } from './logout.js';

// Check authentication status on page load
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // User is not authenticated, redirect to login
        console.log('User not authenticated, redirecting to login');
        // Only redirect if not already on login page
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = 'login.html';
        }
    } else {
        // User is authenticated, show user info in navbar
        console.log('User authenticated:', user.email || 'Anonymous');
        updateNavbarWithUserInfo(user);
    }
});

// Update navbar with user information (disabled - using dropdown instead)
function updateNavbarWithUserInfo(user) {
    // This function is disabled because we're using the dropdown menu instead
    // The user info is now handled by loadUserProfile() in each page's script
    console.log('User authenticated:', user.displayName || user.email || 'Guest User');
}

// Make logout function globally available
window.logout = logout;

// Export functions for use in other scripts
export function requireAuth() {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                resolve(user);
            } else {
                reject(new Error('User not authenticated'));
            }
        });
    });
}

// Get current user info
export function getCurrentUserInfo() {
    const user = auth.currentUser;
    if (!user) {
        return null;
    }
    
    return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        isAnonymous: user.isAnonymous
    };
} 