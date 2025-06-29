# Expense Manager with Automatic Balance Updates

## Overview
This Expense Manager application now includes automatic balance updates for both bank accounts and credit cards when expenses or income are added.

## New Features

### Automatic Balance Updates
- **Bank Accounts**: Balance automatically decreases when expenses are added, increases when income is added
- **Credit Cards**: Used amount increases when expenses are added (available credit decreases)
- **Income**: Can only be added to bank accounts (not credit cards)

### How It Works

#### For Bank Accounts:
1. **Expense**: When you add an expense using a bank account, the balance automatically decreases
   - Example: HDFC Account with ₹10,000 → Spend ₹2,000 → New balance: ₹8,000

2. **Income**: When you add income to a bank account, the balance automatically increases
   - Example: HDFC Account with ₹8,000 → Add income ₹5,000 → New balance: ₹13,000

#### For Credit Cards:
1. **Expense**: When you add an expense using a credit card, the used amount increases
   - Example: HDFC Credit Card with ₹50,000 limit, ₹0 used → Spend ₹5,000 → Used: ₹5,000, Available: ₹45,000

2. **Income**: Cannot be added to credit cards (system prevents this)

## Setup Instructions

### 1. Google Sheets Setup
Ensure your Google Sheets has the following sheets:
- `Expenses` - For expense records
- `Income` - For income records  
- `Balance` - For account balances
- `PaymentType` - For payment type definitions
- `PaymentSubtype` - For account definitions
- `Category` - For expense categories
- `SubCategory` - For expense sub-categories
- `IncomeCategory` - For income sources

### 2. Account Types
- **Bank Accounts**: PaymentType ID should NOT be 3
- **Credit Cards**: PaymentType ID should be 3

### 3. Balance Sheet Structure
The Balance sheet should have these columns:
- `AccountId` - References PaymentSubtype Value
- `Balance` - Current balance (for bank accounts) or used amount (for credit cards)
- `CreditLimit` - Credit limit (for credit cards only)
- `LastUpdated` - Date of last update

## Usage

### Adding Expenses
1. Go to "Add Expense" tab
2. Fill in amount, description, payment method, category, and date
3. Click "Save"
4. The corresponding account balance will be automatically updated

### Adding Income
1. Go to "Add Income" tab
2. Fill in amount, description, income source, account, and date
3. Click "Save"
4. The selected bank account balance will be automatically updated

### Managing Balances
1. Go to "Balance" page
2. View current balances and available credit
3. Manually edit balances if needed
4. See automatic update notifications

## Technical Implementation

### Frontend Changes
- Modified `scripts/index.js` to include balance update flags
- Added account selection for income entries
- Enhanced user feedback messages

### Backend Changes
- Modified `Google App Scripts/code.gs` to handle automatic balance updates
- Added `updateAccountBalance()` function for expenses
- Added `updateAccountBalanceForIncome()` function for income
- Enhanced balance calculation logic
- **Updated expense grouping to use main Categories instead of SubCategories**

### Key Functions
- `updateAccountBalance(accountId, expenseAmount)` - Updates balance when expense is added
- `updateAccountBalanceForIncome(accountId, incomeAmount)` - Updates balance when income is added
- `findBalanceRow(accountId)` - Finds existing balance entry for an account
- **Expense grouping now uses main Category names for charts and insights**

## Benefits
1. **Real-time Balance Tracking**: No need to manually update balances
2. **Accurate Financial Picture**: Always see current available funds
3. **Credit Card Management**: Track credit usage and available limits
4. **Reduced Errors**: Eliminates manual balance update mistakes
5. **Better Financial Planning**: Clear view of spending vs available funds

## Notes
- Credit card balances show "Used" amount, not remaining balance
- Available credit is calculated as: Credit Limit - Used Amount
- Income can only be added to bank accounts, not credit cards
- All balance updates include automatic date tracking 