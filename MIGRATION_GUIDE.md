# Migration Guide: Google Sheets to Firestore

This guide explains the changes made to migrate your Expense Manager from Google Sheets to Firebase Firestore.

## What's Changed

### 1. **Authentication System**
- ✅ Added Google Sign-In authentication
- ✅ Added guest/anonymous login option
- ✅ User session management
- ✅ Automatic redirect to login for unauthenticated users

### 2. **Data Storage**
- ✅ Moved from Google Sheets to Firestore
- ✅ User-specific data isolation
- ✅ Real-time data synchronization
- ✅ Better scalability and performance

### 3. **New Files Created**

#### Authentication Files:
- `login.html` - Beautiful login page with Google Sign-In
- `styles/login.css` - Styling for login page
- `scripts/firebase-config.js` - Firebase configuration
- `scripts/auth.js` - Authentication logic
- `scripts/auth-guard.js` - Page protection
- `scripts/logout.js` - Logout functionality

#### Firestore Files:
- `scripts/firestore-service.js` - Complete Firestore data service
- `scripts/index-firestore.js` - Updated index page logic
- `scripts/dashboard-firestore.js` - Updated dashboard logic

### 4. **Updated Files**
- `Index.html` - Now uses Firestore scripts and authentication
- `Dashboard.html` - Now uses Firestore scripts and authentication

## How to Use the New System

### 1. **First Time Setup**
1. Follow the `FIREBASE_SETUP.md` guide to set up Firebase
2. Update `scripts/firebase-config.js` with your Firebase credentials
3. Open `login.html` to test authentication

### 2. **For New Users**
- Users will be automatically redirected to `login.html`
- They can sign in with Google or continue as guest
- First-time users get default categories and payment types

### 3. **For Existing Users**
- All existing data remains in Google Sheets
- New data will be stored in Firestore
- You can optionally migrate old data (see below)

## Data Structure Changes

### Old Structure (Google Sheets):
```
Expenses: [ID, Amount, PaymentSubTypeId, SubCategoryId, Description, Date, CreatedDate]
Income: [ID, Amount, Description, IncomeSource, Date, CreatedDate]
BorrowLent: [ID, Type, Person, Amount, Description, Date, DueDate, Status, ReturnedDate]
```

### New Structure (Firestore):
```javascript
// All collections now include userId field
expenses: {
  userId: "user123",
  amount: 100,
  paymentTypeId: 1,
  paymentSubTypeId: 2,
  categoryId: 1,
  subCategoryId: 1,
  description: "Lunch",
  paymentDate: "2024-01-15",
  createdAt: Timestamp
}

income: {
  userId: "user123",
  amount: 5000,
  description: "Salary",
  incomeSourceId: 1,
  accountId: 2,
  date: "2024-01-15",
  createdAt: Timestamp
}

borrowLent: {
  userId: "user123",
  type: "Borrow",
  person: "John",
  amount: 100,
  description: "Lunch money",
  date: "2024-01-15",
  dueDate: "2024-01-20",
  status: "Open",
  returnedDate: null,
  createdAt: Timestamp
}
```

## Migration Options

### Option 1: Fresh Start (Recommended)
- Start with new data in Firestore
- Keep old Google Sheets as backup
- New users get default categories

### Option 2: Data Migration
If you want to migrate existing data:

1. **Export from Google Sheets:**
   ```javascript
   // You can export your Google Sheets data as JSON
   // and create a migration script
   ```

2. **Import to Firestore:**
   ```javascript
   // Add userId to each record
   // Convert dates to proper format
   // Update category/payment type references
   ```

## Testing the Migration

### 1. **Test Authentication**
- Open `login.html`
- Try Google Sign-In
- Try guest login
- Verify logout works

### 2. **Test Data Operations**
- Add new expenses
- Add new income
- Add borrow/lent records
- Check dashboard updates

### 3. **Test Multi-User**
- Create multiple user accounts
- Verify data isolation
- Test concurrent access

## Rollback Plan

If you need to rollback:

1. **Keep Google Sheets scripts:**
   - `Google App Scripts/code.gs` (backup)
   - `scripts/index.js` (original version)

2. **Switch back:**
   - Update `Index.html` to use `scripts/index.js`
   - Update `Dashboard.html` to use `scripts/dashboard.js`
   - Remove authentication guards

## Performance Improvements

### Before (Google Sheets):
- API rate limits
- Slower data retrieval
- No real-time updates
- Limited concurrent users

### After (Firestore):
- Real-time data synchronization
- Faster queries
- Better scalability
- Offline support (future enhancement)

## Security Improvements

### Before:
- All data in one Google Sheet
- No user isolation
- Manual access control

### After:
- User-specific data
- Firebase security rules
- Authentication required
- Automatic data isolation

## Next Steps

1. **Set up Firebase** (follow `FIREBASE_SETUP.md`)
2. **Test the new system**
3. **Migrate data** (optional)
4. **Update other pages** (Chart.html, Balance.html)
5. **Add offline support** (future enhancement)

## Support

If you encounter issues:

1. Check browser console for errors
2. Verify Firebase configuration
3. Check Firestore security rules
4. Ensure authentication is working

## Files to Update Next

- `Chart.html` - Add authentication and Firestore
- `Balance.html` - Add authentication and Firestore
- `scripts/chart.js` - Convert to Firestore
- `scripts/balance.js` - Convert to Firestore 