# Firebase Setup Guide for Expense Manager

This guide will help you set up Firebase authentication for your Expense Manager app.

## Prerequisites

1. A Google account
2. Basic knowledge of Firebase

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter a project name (e.g., "expense-manager")
4. Choose whether to enable Google Analytics (optional)
5. Click "Create project"

## Step 2: Enable Authentication

1. In your Firebase project, go to "Authentication" in the left sidebar
2. Click "Get started"
3. Go to the "Sign-in method" tab
4. Enable "Google" as a sign-in provider:
   - Click on "Google"
   - Toggle "Enable"
   - Add your support email
   - Click "Save"
5. Enable "Anonymous" authentication:
   - Click on "Anonymous"
   - Toggle "Enable"
   - Click "Save"

## Step 3: Set Up Firestore Database

1. Go to "Firestore Database" in the left sidebar
2. Click "Create database"
3. Choose "Start in test mode" (for development)
4. Select a location for your database
5. Click "Done"

## Step 4: Get Your Firebase Configuration

1. Go to "Project settings" (gear icon next to "Project Overview")
2. Scroll down to "Your apps" section
3. Click the web icon (</>) to add a web app
4. Register your app with a nickname (e.g., "expense-manager-web")
5. Copy the Firebase configuration object

## Step 5: Update Your App Configuration

1. Open `scripts/firebase-config.js`
2. Replace the placeholder configuration with your actual Firebase config:

```javascript
const firebaseConfig = {
    apiKey: "your-actual-api-key",
    authDomain: "your-project-id.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
};
```

## Step 6: Set Up Firestore Security Rules

1. Go to "Firestore Database" → "Rules"
2. Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own data
    match /{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    }
    
    // Allow users to create documents with their own userId
    match /{document=**} {
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

## Step 7: Test Your Setup

1. Open `login.html` in your browser
2. Try signing in with Google
3. You should be redirected to the dashboard after successful authentication

## Step 8: Update Other Pages (Optional)

To protect other pages, add this line before the closing `</body>` tag:

```html
<script type="module" src="scripts/auth-guard.js"></script>
```

## Troubleshooting

### Common Issues:

1. **"Firebase not initialized" error**
   - Make sure you've updated the Firebase config in `scripts/firebase-config.js`

2. **"Permission denied" error**
   - Check your Firestore security rules
   - Ensure the user is authenticated

3. **Google sign-in popup blocked**
   - Allow pop-ups for your domain
   - Try using a different browser

4. **Authentication not working**
   - Verify Google authentication is enabled in Firebase Console
   - Check browser console for error messages

## Next Steps

After setting up authentication, you'll need to:

1. Update your data operations to use Firestore instead of Google Sheets
2. Add user ID to all data records
3. Filter data by user ID in all queries
4. Test multi-user functionality

## Security Notes

- Never commit your Firebase config with real API keys to public repositories
- Use environment variables in production
- Regularly review your Firestore security rules
- Consider implementing additional security measures for production use 