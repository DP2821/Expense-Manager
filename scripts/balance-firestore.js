// Firestore-based Balance Script
import { 
    getAllDropdownData, 
    getBalance,
    addBalance as addBalanceToFirestore,
    updateBalance as updateBalanceInFirestore
} from './firestore-service.js';
import { 
    collection, 
    addDoc, 
    updateDoc, 
    doc, 
    query, 
    where, 
    getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from './firebase-config.js';
import { getUserId } from './auth-helper.js';
import { auth } from './firebase-config.js';

let Global_Response = null;
let selectedAccountId = null;
let balances = [];

$(document).ready(function() {
    showLoader();
    initializeBalancePage();
    setCurrentDate();
    
    // Form submission
    $('#balance-form').on('submit', function(e) {
        e.preventDefault();
        saveBalance();
    });
    
    // Reset form
    $('#resetForm').click(function() {
        resetForm();
    });
    
    // Account selection change
    $('#accountSelect').change(function() {
        const selectedValue = $(this).val();
        if (selectedValue) {
            selectedAccountId = selectedValue;
            loadAccountBalance(selectedValue);
        }
    });
    
    // Additional dropdown initialization after page load
    setTimeout(() => {
        initializeDropdown();
    }, 500);
});

async function initializeBalancePage() {
    try {
        // Load user profile
        loadUserProfile();
        
        // Load dropdown data and balances in parallel
        const [dropdownData, balanceData] = await Promise.all([
            getAllDropdownData(),
            getBalance()
        ]);
        
        Global_Response = dropdownData;
        balances = balanceData;
        
        populateAccountDropdown();
        loadBalanceTable();
        calculateSummary();
        hideLoader();
        
        if (typeof toastr !== 'undefined') {
            toastr.success('Balance data loaded successfully!');
        }
    } catch (error) {
        console.error('Error initializing balance page:', error);
        hideLoader();
        if (typeof toastr !== 'undefined') {
            toastr.error('Error loading balance data. Please try again.');
        }
    }
}

function populateAccountDropdown() {
    const accountSelect = $('#accountSelect');
    accountSelect.empty();
    accountSelect.append('<option value="" disabled selected>Choose an account...</option>');
    
    if (Global_Response && Global_Response.PaymentSubType) {
        Global_Response.PaymentSubType.forEach(function(account) {
            const option = `<option value="${account.Value}">${account.Text}</option>`;
            accountSelect.append(option);
        });
    }
}

function loadAccountBalance(accountId) {
    // Find the account in the balance data
    const accountBalance = balances.find(b => b.accountId == accountId);
    if (accountBalance) {
        $('#balanceAmount').val(accountBalance.balance || 0);
        $('#creditLimit').val(accountBalance.creditLimit || 0);
        $('#lastUpdated').val(accountBalance.lastUpdated || getCurrentDate());
    } else {
        $('#balanceAmount').val('');
        $('#creditLimit').val('');
        $('#lastUpdated').val(getCurrentDate());
    }
}

function loadBalanceTable() {
    const tbody = $('#balance-table');
    tbody.empty();
    
    if (balances && balances.length > 0) {
        balances.forEach(function(balance) {
            const account = Global_Response.PaymentSubType.find(a => a.Value == balance.accountId);
            const paymentType = Global_Response.PaymentType.find(p => p.Value == account?.PaymentType);
            
            const accountType = paymentType ? paymentType.Text : 'Unknown';
            const isCreditCard = account && account.PaymentType == 3; // Assuming 3 is credit card type
            const available = isCreditCard ? (balance.creditLimit - balance.balance) : balance.balance;
            
            // Format balance display based on account type
            let balanceDisplay = '';
            if (isCreditCard) {
                balanceDisplay = `Used: ₹ ${Number(balance.balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`;
            } else {
                balanceDisplay = `₹ ${Number(balance.balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`;
            }
            
            const tr = `
                <tr>
                    <td>${account ? account.Text : 'Unknown'}</td>
                    <td><span class="badge bg-${isCreditCard ? 'warning' : 'primary'}">${accountType}</span></td>
                    <td>${balanceDisplay}</td>
                    <td>${isCreditCard ? '₹ ' + Number(balance.creditLimit || 0).toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}</td>
                    <td class="${available < 0 ? 'text-danger' : 'text-success'}">₹ ${Number(available).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td>${balance.lastUpdated || 'Not set'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="editBalance(${balance.accountId})">
                            <span class="material-icons" style="font-size: 16px;">edit</span>
                        </button>
                    </td>
                </tr>
            `;
            tbody.append(tr);
        });
    } else {
        tbody.append('<tr><td colspan="7" class="text-center text-muted">No balance data found. Add your first balance entry.</td></tr>');
    }
}

function calculateSummary() {
    let totalBankBalance = 0;
    let totalCreditLimit = 0;
    let totalCreditUsed = 0;
    let totalAvailable = 0;
    
    if (balances) {
        balances.forEach(function(balance) {
            const account = Global_Response.PaymentSubType.find(a => a.Value == balance.accountId);
            const isCreditCard = account && account.PaymentType == 3;
            
            if (isCreditCard) {
                totalCreditLimit += parseFloat(balance.creditLimit || 0);
                totalCreditUsed += parseFloat(balance.balance || 0);
                totalAvailable += parseFloat(balance.creditLimit || 0) - parseFloat(balance.balance || 0);
            } else {
                totalBankBalance += parseFloat(balance.balance || 0);
                totalAvailable += parseFloat(balance.balance || 0);
            }
        });
    }
    
    $('#total-bank-balance').text(`₹ ${totalBankBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
    $('#total-credit-used').text(`₹ ${totalCreditUsed.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
    $('#credit-usage-info').text(`of ₹ ${totalCreditLimit.toLocaleString(undefined, {minimumFractionDigits: 2})} total limit`);
    $('#net-available').text(`₹ ${totalAvailable.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
}

async function saveBalance() {
    const accountId = $('#accountSelect').val();
    const balanceAmount = $('#balanceAmount').val();
    const creditLimit = $('#creditLimit').val();
    const lastUpdated = $('#lastUpdated').val();
    
    if (!accountId || !balanceAmount || !lastUpdated) {
        if (typeof toastr !== 'undefined') {
            toastr.warning('Please fill all required fields');
        } else {
            alert('Please fill all required fields');
        }
        return;
    }
    
    showLoader();
    
    try {
        const userId = getUserId();
        const balanceData = {
            userId,
            accountId: parseInt(accountId),
            balance: parseFloat(balanceAmount),
            creditLimit: parseFloat(creditLimit || 0),
            lastUpdated: lastUpdated
        };
        
        // Check if balance already exists for this account
        const existingBalance = balances.find(b => b.accountId == accountId);
        
        if (existingBalance) {
            // Update existing balance
            await updateBalanceInFirestore(existingBalance.id, balanceData);
        } else {
            // Add new balance
            await addBalanceToFirestore(balanceData);
        }
        
        if (typeof toastr !== 'undefined') {
            toastr.success('Balance saved successfully!');
        } else {
            alert('Balance saved successfully!');
        }
        
        resetForm();
        await initializeBalancePage(); // Reload all data
    } catch (error) {
        console.error('Error saving balance:', error);
        if (typeof toastr !== 'undefined') {
            toastr.error('Error saving balance. Please try again.');
        } else {
            alert('Error saving balance. Please try again.');
        }
        hideLoader();
    }
}

// These functions are now handled by the firestore-service.js
// The local functions have been removed to avoid naming conflicts

// Make editBalance function globally available
window.editBalance = function(accountId) {
    selectedAccountId = accountId;
    $('#accountSelect').val(accountId);
    loadAccountBalance(accountId);
    
    // Scroll to form
    document.getElementById('balance-form').scrollIntoView({ 
        behavior: 'smooth' 
    });
    
    if (typeof toastr !== 'undefined') {
        toastr.info('Account selected for editing. Update the values and save.');
    }
};

function resetForm() {
    $('#balance-form')[0].reset();
    selectedAccountId = null;
    setCurrentDate();
}

function setCurrentDate() {
    document.getElementById('lastUpdated').value = getCurrentDate();
}

function getCurrentDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function loadUserProfile() {
    // Remove any existing user info elements added by auth-guard.js
    const existingUserInfo = document.querySelector('.user-info');
    if (existingUserInfo) {
        existingUserInfo.remove();
    }
    
    // Wait for auth to be ready
    const unsubscribe = auth.onAuthStateChanged((user) => {
        if (user) {
            document.getElementById('userName').textContent = user.displayName || 'User';
            document.getElementById('userEmail').textContent = user.email || '';
        } else {
            document.getElementById('userName').textContent = 'Guest';
            document.getElementById('userEmail').textContent = 'Not signed in';
        }
        
        // Initialize dropdown after user info is set
        initializeDropdown();
    });
    
    // Set up logout functionality
    document.getElementById('logoutBtn').addEventListener('click', function(e) {
        e.preventDefault();
        auth.signOut().then(() => {
            window.location.href = 'login.html';
        }).catch((error) => {
            console.error('Error signing out:', error);
            if (typeof toastr !== 'undefined') {
                toastr.error('Error signing out. Please try again.');
            }
        });
    });
}

function initializeDropdown() {
    // Wait a bit for DOM to be ready
    setTimeout(() => {
        const dropdownToggle = document.getElementById('userDropdown');
        if (dropdownToggle && typeof bootstrap !== 'undefined') {
            // Destroy existing dropdown if any
            const existingDropdown = bootstrap.Dropdown.getInstance(dropdownToggle);
            if (existingDropdown) {
                existingDropdown.dispose();
            }
            
            // Create new dropdown
            new bootstrap.Dropdown(dropdownToggle);
            
            // Add click handler as backup
            dropdownToggle.addEventListener('click', function(e) {
                e.preventDefault();
                const dropdownMenu = this.nextElementSibling;
                if (dropdownMenu && dropdownMenu.classList.contains('dropdown-menu')) {
                    dropdownMenu.classList.toggle('show');
                }
            });
        }
    }, 100);
}

function showLoader() {
    $("#globalLoader").fadeIn();
}

function hideLoader() {
    $("#globalLoader").fadeOut();
} 