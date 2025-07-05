// Firestore-based Dashboard Script
import { 
    getExpenses, 
    getIncome, 
    getBorrowLent, 
    getBalance,
    calculateCurrentBalance,
    getAllDropdownData
} from './firestore-service.js';
import { getUserId } from './auth-helper.js';
import { auth } from './firebase-config.js';

let expenses = [];
let income = [];
let borrowLent = [];
let dropdownData = {}; // Store categories, payment types, etc.

$(document).ready(function() {
    showLoader();
    initializeDashboard();
    
    // Additional dropdown initialization after page load
    setTimeout(() => {
        initializeDropdown();
    }, 500);
});

async function initializeDashboard() {
    try {
        // Load user profile
        loadUserProfile();
        
        // Load all data
        await loadAllData();
        
        // Set up date filters AFTER data is loaded
        setupDateFilters();
        
        // Initialize charts
        initializeCharts();
        
        // Update summary cards
        updateSummaryCards();
        
        // Update tables
        updateTransactionsTable();
        updateBorrowLentTable();
        updateSpendingInsights();
        
        hideLoader();
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        hideLoader();
        if (typeof toastr !== 'undefined') {
            toastr.error('Failed to load dashboard data. Please try again.');
        }
    }
}

async function loadAllData() {
    try {
        // Load all data in parallel
        [expenses, income, borrowLent, dropdownData] = await Promise.all([
            getExpenses(),
            getIncome(),
            getBorrowLent(),
            getAllDropdownData()
        ]);
        
        console.log('Data loaded successfully:', { 
            expenses: expenses.length, 
            income: income.length, 
            borrowLent: borrowLent.length,
            categories: dropdownData.Category?.length || 0,
            incomeCategories: dropdownData.IncomeCategory?.length || 0
        });
        
    } catch (error) {
        console.error('Error loading data:', error);
        throw error;
    }
}

function setupDateFilters() {
    // Set default date range (current month)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    document.getElementById('startDate').value = formatDateForInput(startOfMonth);
    document.getElementById('endDate').value = formatDateForInput(endOfMonth);
    
    // Apply filter button
    document.getElementById('applyFilter').addEventListener('click', async function() {
        showLoader();
        await applyDateFilter();
        hideLoader();
    });
    
    // Reset filter button
    document.getElementById('resetFilter').addEventListener('click', async function() {
        showLoader();
        document.getElementById('startDate').value = formatDateForInput(startOfMonth);
        document.getElementById('endDate').value = formatDateForInput(endOfMonth);
        await applyDateFilter();
        hideLoader();
    });
}

async function applyDateFilter() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    try {
        // Reload data with date filter
        [expenses, income] = await Promise.all([
            getExpenses(startDate, endDate),
            getIncome(startDate, endDate)
        ]);
        
        // Update all components
        updateSummaryCards();
        updateTransactionsTable();
        initializeCharts();
        updateSpendingInsights();
        
        if (typeof toastr !== 'undefined') {
            toastr.success('Filter applied successfully!');
        }
    } catch (error) {
        console.error('Error applying date filter:', error);
        if (typeof toastr !== 'undefined') {
            toastr.error('Failed to apply filter. Please try again.');
        }
    }
}

async function updateSummaryCards() {
    try {
        // Calculate totals
        const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        const totalIncome = income.reduce((sum, inc) => sum + inc.amount, 0);
        
        // Get current bank balance from balance data
        const balanceData = await getBalance();
        const totalBankBalance = balanceData.reduce((sum, balance) => {
            // Only include non-credit card accounts
            const account = dropdownData.PaymentSubType?.find(a => a.Value === balance.accountId);
            const isCreditCard = account && account.PaymentType === 3;
            return isCreditCard ? sum : sum + parseFloat(balance.balance || 0);
        }, 0);
        
        // Calculate borrow/lent balance
        const openBorrowLent = borrowLent.filter(item => item.status === 'Open');
        const borrowTotal = openBorrowLent
            .filter(item => item.type === 'Borrow')
            .reduce((sum, item) => sum + item.amount, 0);
        const lentTotal = openBorrowLent
            .filter(item => item.type === 'Lent')
            .reduce((sum, item) => sum + item.amount, 0);
        const borrowLentBalance = lentTotal - borrowTotal;
        
        // Update cards
        document.getElementById('current-balance').textContent = `₹ ${totalBankBalance.toFixed(2)}`;
        document.getElementById('filtered-expense').textContent = `₹ ${totalExpenses.toFixed(2)}`;
        document.getElementById('filtered-income').textContent = `₹ ${totalIncome.toFixed(2)}`;
        document.getElementById('borrow-lent-balance').textContent = `₹ ${borrowLentBalance.toFixed(2)}`;
        document.getElementById('borrow-lent-details').textContent = `${openBorrowLent.length}`;
    } catch (error) {
        console.error('Error updating summary cards:', error);
        // Fallback to simple calculation if balance data fails
        const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        const totalIncome = income.reduce((sum, inc) => sum + inc.amount, 0);
        const currentBalance = totalIncome - totalExpenses;
        
        document.getElementById('current-balance').textContent = `₹ ${currentBalance.toFixed(2)}`;
        document.getElementById('filtered-expense').textContent = `₹ ${totalExpenses.toFixed(2)}`;
        document.getElementById('filtered-income').textContent = `₹ ${totalIncome.toFixed(2)}`;
    }
}

function updateTransactionsTable() {
    const tableBody = document.getElementById('transactions-table');
    
    // Combine and sort transactions
    const transactions = [
        ...expenses.map(expense => ({
            ...expense,
            type: 'Expense',
            date: expense.paymentDate,
            category: getCategoryName(expense.categoryId),
            amount: -expense.amount
        })),
        ...income.map(inc => ({
            ...inc,
            type: 'Income',
            date: inc.date,
            category: getIncomeCategoryName(inc.incomeSourceId),
            amount: inc.amount
        }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date))
     .slice(0, 10); // Show only last 10 transactions
    
    if (transactions.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No transactions found</td></tr>';
        return;
    }
    
    tableBody.innerHTML = transactions.map(transaction => `
        <tr>
            <td>${formatDate(transaction.date)}</td>
            <td>
                <span class="badge ${transaction.type === 'Income' ? 'bg-success' : 'bg-danger'}">
                    ${transaction.type}
                </span>
            </td>
            <td>${transaction.category}</td>
            <td>${transaction.description}</td>
            <td class="text-end ${transaction.amount >= 0 ? 'text-success' : 'text-danger'}">
                ₹ ${Math.abs(transaction.amount).toFixed(2)}
            </td>
        </tr>
    `).join('');
}

function updateBorrowLentTable() {
    const tableBody = document.getElementById('borrow-lent-table');
    
    if (borrowLent.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No borrow/lent records found</td></tr>';
        return;
    }
    
    tableBody.innerHTML = borrowLent.map(item => `
        <tr>
            <td>${formatDate(item.date)}</td>
            <td>
                <span class="badge ${item.type === 'Lent' ? 'bg-warning' : 'bg-info'}">
                    ${item.type}
                </span>
            </td>
            <td>${item.person}</td>
            <td>${item.description}</td>
            <td>₹ ${item.amount.toFixed(2)}</td>
            <td>${formatDate(item.dueDate)}</td>
            <td>
                <span class="badge ${item.status === 'Open' ? 'bg-warning' : 'bg-success'}">
                    ${item.status}
                </span>
            </td>
            <td>${item.returnedDate ? formatDate(item.returnedDate) : '-'}</td>
        </tr>
    `).join('');
}

function updateSpendingInsights() {
    // Top spending categories
    const categorySpending = {};
    expenses.forEach(expense => {
        const categoryName = getCategoryName(expense.categoryId);
        categorySpending[categoryName] = (categorySpending[categoryName] || 0) + expense.amount;
    });
    
    const topCategories = Object.entries(categorySpending)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3);
    
    const topCategoriesHtml = topCategories.map(([category, amount]) => `
        <div class="d-flex justify-content-between align-items-center mb-2">
            <span>${category}</span>
            <span class="text-danger">₹ ${amount.toFixed(2)}</span>
        </div>
    `).join('');
    
    document.getElementById('top-categories').innerHTML = topCategoriesHtml;
    
    // Average daily spending
    if (expenses.length > 0) {
        const totalSpending = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        const daysDiff = getDaysDifference(expenses);
        const avgDaily = daysDiff > 0 ? totalSpending / daysDiff : totalSpending;
        document.getElementById('avg-daily-spending').textContent = `₹ ${avgDaily.toFixed(2)}`;
    }
    
    // Largest transaction
    const allTransactions = [...expenses, ...income];
    if (allTransactions.length > 0) {
        const largest = allTransactions.reduce((max, transaction) => 
            transaction.amount > max.amount ? transaction : max
        );
        document.getElementById('largest-transaction').textContent = `₹ ${largest.amount.toFixed(2)}`;
    }
    
    // Transaction count
    document.getElementById('transaction-count').textContent = allTransactions.length;
}

function initializeCharts() {
    // Category Chart
    createCategoryChart();
    
    // Monthly Trend Chart
    createMonthlyTrendChart();
}

function createCategoryChart() {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (window.categoryChart && typeof window.categoryChart.destroy === 'function') {
        window.categoryChart.destroy();
    }
    
    // Prepare data
    const categoryData = {};
    expenses.forEach(expense => {
        const categoryName = getCategoryName(expense.categoryId);
        categoryData[categoryName] = (categoryData[categoryName] || 0) + expense.amount;
    });
    
    const labels = Object.keys(categoryData);
    const data = Object.values(categoryData);
    
    // Hide loading
    document.getElementById('categoryChartLoading').style.display = 'none';
    
    window.categoryChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                    '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function createMonthlyTrendChart() {
    const ctx = document.getElementById('monthlyTrendChart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (window.monthlyTrendChart && typeof window.monthlyTrendChart.destroy === 'function') {
        window.monthlyTrendChart.destroy();
    }
    
    // Prepare monthly data
    const monthlyData = {};
    expenses.forEach(expense => {
        const month = expense.paymentDate.substring(0, 7); // YYYY-MM
        monthlyData[month] = (monthlyData[month] || 0) + expense.amount;
    });
    
    const labels = Object.keys(monthlyData).sort();
    const data = labels.map(month => monthlyData[month]);
    
    // Hide loading
    document.getElementById('monthlyTrendChartLoading').style.display = 'none';
    
    window.monthlyTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.map(month => formatMonth(month)),
            datasets: [{
                label: 'Monthly Expenses',
                data: data,
                borderColor: '#36A2EB',
                backgroundColor: 'rgba(54, 162, 235, 0.1)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Helper functions
function getCategoryName(categoryId) {
    if (!dropdownData.Category) {
        return 'Loading...';
    }
    const category = dropdownData.Category.find(cat => cat.Value === categoryId);
    return category ? category.Text : `Category ${categoryId}`;
}

function getIncomeCategoryName(categoryId) {
    if (!dropdownData.IncomeCategory) {
        return 'Loading...';
    }
    const category = dropdownData.IncomeCategory.find(cat => cat.id === categoryId);
    return category ? category.name : `Income ${categoryId}`;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN');
}

function formatDateForInput(date) {
    return date.toISOString().split('T')[0];
}

function formatMonth(monthString) {
    const [year, month] = monthString.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function getDaysDifference(transactions) {
    if (transactions.length === 0) return 0;
    
    const dates = transactions.map(t => new Date(t.paymentDate || t.date));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    
    return Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1;
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