// Robust Authentication Helper
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Cache for user information
let cachedUser = null;
let authStateInitialized = false;

// Initialize auth state listener
onAuthStateChanged(auth, (user) => {
    cachedUser = user;
    authStateInitialized = true;
    console.log('Auth state changed:', user ? 'User authenticated' : 'User not authenticated');
});

// Wait for auth state to be initialized
function waitForAuthState() {
    return new Promise((resolve) => {
        if (authStateInitialized) {
            resolve();
        } else {
            const checkAuthState = () => {
                if (authStateInitialized) {
                    resolve();
                } else {
                    setTimeout(checkAuthState, 100);
                }
            };
            checkAuthState();
        }
    });
}

// Get current user with retry mechanism
export async function getCurrentUser() {
    await waitForAuthState();
    
    // Try cached user first
    if (cachedUser) {
        return cachedUser;
    }
    
    // Try auth.currentUser
    if (auth.currentUser) {
        cachedUser = auth.currentUser;
        return auth.currentUser;
    }
    
    // If we're on a protected page and auth.currentUser is null,
    // there might be a timing issue. Wait a bit and try again.
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (auth.currentUser) {
                cachedUser = auth.currentUser;
                resolve(auth.currentUser);
            } else if (cachedUser) {
                resolve(cachedUser);
            } else {
                reject(new Error('User not authenticated'));
            }
        }, 2000);
    });
}

// Get user ID with retry mechanism
export async function getUserId() {
    try {
        const user = await getCurrentUser();
        return user ? user.uid : null;
    } catch (error) {
        console.error('Error getting user ID:', error);
        return null;
    }
}

// Get user email
export async function getUserEmail() {
    try {
        const user = await getCurrentUser();
        return user ? (user.email || 'Guest User') : null;
    } catch (error) {
        console.error('Error getting user email:', error);
        return null;
    }
}

// Get user display name
export async function getUserDisplayName() {
    try {
        const user = await getCurrentUser();
        return user ? (user.displayName || user.email || 'Guest User') : null;
    } catch (error) {
        console.error('Error getting user display name:', error);
        return null;
    }
}

// Check if user is authenticated
export async function isAuthenticated() {
    try {
        const user = await getCurrentUser();
        return user !== null;
    } catch (error) {
        return false;
    }
}

// Force refresh auth state
export function refreshAuthState() {
    cachedUser = auth.currentUser;
    authStateInitialized = true;
} 