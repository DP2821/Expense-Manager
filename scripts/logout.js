// Logout functionality
import { auth } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Logout function
export function logout() {
    signOut(auth).then(() => {
        console.log('User signed out successfully');
        if (typeof toastr !== 'undefined') {
            toastr.success('You have been signed out successfully.');
        }
        // Redirect to login page
        window.location.href = 'login.html';
    }).catch((error) => {
        console.error('Sign out error:', error);
        if (typeof toastr !== 'undefined') {
            toastr.error('Sign out failed. Please try again.');
        }
    });
}

// Make logout function globally available
window.logout = logout;