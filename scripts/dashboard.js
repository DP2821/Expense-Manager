const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwWIHyqrYr6nvO8rVL3J0Vfi5kwibefcrcHxw-s16-FRw99aH35S7KgBJONOiLmUl_q/exec';

let categoryChart = null;
let monthlyTrendChart = null;
let currentStartDate = null;
let currentEndDate = null;

// Chart colors for consistent theming
const chartColors = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
    '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
];

$(document).ready(function() {
    showLoader();
    initializeDateFilters();
    loadDashboardData();
    // Load analytics data with default date range to show charts and consistent filtered values
    loadAnalyticsData(currentStartDate, currentEndDate);
    setupEventListeners();
});

function initializeDateFilters() {
    // Set default date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    $('#endDate').val(formatDateForInput(endDate));
    $('#startDate').val(formatDateForInput(startDate));
    
    currentStartDate = formatDateForInput(startDate);
    currentEndDate = formatDateForInput(endDate);
}

function setupEventListeners() {
    $('#applyFilter').click(function() {
        const startDate = $('#startDate').val();
        const endDate = $('#endDate').val();
        
        if (startDate && endDate && startDate <= endDate) {
            currentStartDate = startDate;
            currentEndDate = endDate;
            showLoader();
            loadAnalyticsData(startDate, endDate);
        } else {
            if (typeof toastr !== 'undefined') {
                toastr.warning('Please select valid date range (start date should be before end date)');
            } else {
                alert('Please select valid date range (start date should be before end date)');
            }
        }
    });
    
    $('#resetFilter').click(function() {
        initializeDateFilters();
        showLoader();
        loadAnalyticsData(currentStartDate, currentEndDate);
    });
}

function loadDashboardData() {
    fetch(`${APPS_SCRIPT_URL}?dashboard=1`)
        .then(response => response.json())
        .then(data => {
            
            // Update summary cards
            document.getElementById('current-balance').textContent = `₹ ${Number(data.currentBalance).toLocaleString(undefined, {minimumFractionDigits: 2})}`;
            document.getElementById('filtered-expense').textContent = `₹ ${Number(data.monthExpense).toLocaleString(undefined, {minimumFractionDigits: 2})}`;
            document.getElementById('filtered-income').textContent = `₹ ${Number(data.monthIncome).toLocaleString(undefined, {minimumFractionDigits: 2})}`;
            document.getElementById('borrow-lent-balance').textContent = `₹ ${Number(data.borrowLentBalance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`;
            document.getElementById('borrow-lent-details').textContent = `${data.openBorrowLent || 0} Open`;
            
            // Update recent transactions table
            const tbody = document.querySelector('.table tbody');
            tbody.innerHTML = '';
            if (Array.isArray(data.recentTransactions) && data.recentTransactions.length > 0) {
                data.recentTransactions.forEach(tx => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${tx.date}</td>
                        <td><span class="badge bg-${tx.type === 'Expense' ? 'danger' : 'success'}">${tx.type}</span></td>
                        <td>${tx.category}</td>
                        <td>${tx.description}</td>
                        <td class="text-end">${tx.amount < 0 ? '-' : '+'}₹ ${Math.abs(tx.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td colspan="5" class="text-center text-muted">No recent transactions found.</td>`;
                tbody.appendChild(tr);
            }

            // Update borrow/lent transactions table
            updateBorrowLentTable(data.borrowLentTransactions || []);
            
            if (typeof toastr !== 'undefined') {
                toastr.success('Dashboard data loaded successfully!');
            } else {
                console.log('Dashboard data loaded successfully!');
            }
        })
        .catch(err => {
            console.error('Dashboard fetch error:', err);
            const tbody = document.querySelector('.table tbody');
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Failed to load dashboard data.</td></tr>`;
            
            const borrowLentTbody = document.getElementById('borrow-lent-table');
            borrowLentTbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Failed to load borrow/lent data.</td></tr>`;
            
            if (typeof toastr !== 'undefined') {
                toastr.error('Failed to load dashboard data. Please try again.');
            } else {
                console.error('Failed to load dashboard data. Please try again.');
            }
        });
}

function loadAnalyticsData(startDate, endDate) {
    const url = `${APPS_SCRIPT_URL}?analytics=1&startDate=${startDate}&endDate=${endDate}`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            console.log('Analytics data:', data);
            
            // Update summary cards
            document.getElementById('filtered-expense').textContent = `₹ ${Number(data.totalExpense || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`;
            document.getElementById('filtered-income').textContent = `₹ ${Number(data.totalIncome || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`;
            
            // Update transactions table
            updateTransactionsTable(data.filteredTransactions || []);
            
            // Update spending insights
            updateSpendingInsights(data);
            
            // Update charts
            updateCategoryChart(data.categoryBreakdown || []);
            updateMonthlyTrendChart(data.monthlyTrends || []);
            
            hideLoader();
            if (typeof toastr !== 'undefined') {
                toastr.success('Analytics data updated successfully!');
            } else {
                console.log('Analytics data updated successfully!');
            }
        })
        .catch(err => {
            console.error('Analytics fetch error:', err);
            hideLoader();
            if (typeof toastr !== 'undefined') {
                toastr.error('Failed to load analytics data. Please try again.');
            } else {
                console.error('Failed to load analytics data. Please try again.');
            }
        });
}

function updateTransactionsTable(transactions) {
    const tbody = $('#transactions-table');
    tbody.empty();
    
    if (transactions.length > 0) {
        transactions.forEach(tx => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${tx.date}</td>
                <td><span class="badge bg-${tx.type === 'Expense' ? 'danger' : 'success'}">${tx.type}</span></td>
                <td>${tx.category}</td>
                <td>${tx.description}</td>
                <td class="text-end">${tx.amount < 0 ? '-' : '+'}₹ ${Math.abs(tx.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            `;
            tbody.append(tr);
        });
    } else {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="5" class="text-center text-muted">No transactions found for selected date range.</td>`;
        tbody.append(tr);
    }
}

function updateBorrowLentTable(transactions) {
    const tbody = $('#borrow-lent-table');
    tbody.empty();
    
    if (transactions.length > 0) {
        transactions.forEach(tx => {
            const tr = document.createElement('tr');
            const statusBadge = tx.status === 'Open' ? 'bg-warning' : 'bg-success';
            const typeBadge = tx.type === 'Borrow' ? 'bg-info' : 'bg-primary';
            
            tr.innerHTML = `
                <td>${tx.date}</td>
                <td><span class="badge ${typeBadge}">${tx.type}</span></td>
                <td>${tx.person}</td>
                <td>${tx.description}</td>
                <td>₹ ${Number(tx.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td>${tx.dueDate}</td>
                <td><span class="badge ${statusBadge}">${tx.status}</span></td>
                <td>${tx.returnedDate || '-'}</td>
            `;
            tbody.append(tr);
        });
    } else {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="8" class="text-center text-muted">No borrow/lent transactions found.</td>`;
        tbody.append(tr);
    }
}

function updateSpendingInsights(data) {
    // Top categories
    const topCategoriesDiv = $('#top-categories');
    topCategoriesDiv.empty();
    
    if (data.topCategories && data.topCategories.length > 0) {
        data.topCategories.forEach((cat, index) => {
            const percentage = data.totalExpense > 0 ? ((cat.amount / data.totalExpense) * 100).toFixed(1) : 0;
            const div = `
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="badge" style="background-color: ${chartColors[index % chartColors.length]}">${cat.category}</span>
                    <span class="text-muted">₹ ${Number(cat.amount).toLocaleString(undefined, {minimumFractionDigits: 2})} (${percentage}%)</span>
                </div>
            `;
            topCategoriesDiv.append(div);
        });
    } else {
        topCategoriesDiv.html('<span class="text-muted">No data available</span>');
    }
    
    // Other insights
    $('#avg-daily-spending').text(`₹ ${Number(data.avgDailySpending || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`);
    $('#largest-transaction').text(`₹ ${Number(data.largestTransaction || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`);
    $('#transaction-count').text(data.transactionCount || 0);
}

function updateCategoryChart(categoryData) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    
    // Hide loading indicator
    $('#categoryChartLoading').hide();
    
    if (categoryChart) {
        categoryChart.destroy();
    }
    
    if (categoryData.length === 0) {
        // Show no data message
        ctx.font = '16px Arial';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.fillText('No expense data available', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }
    
    const labels = categoryData.map(item => item.category);
    const data = categoryData.map(item => item.amount);
    const colors = categoryData.map((_, index) => chartColors[index % chartColors.length]);
    
    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ₹ ${Number(value).toLocaleString()} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function updateMonthlyTrendChart(monthlyData) {
    const ctx = document.getElementById('monthlyTrendChart').getContext('2d');
    
    // Hide loading indicator
    $('#monthlyTrendChartLoading').hide();
    
    if (monthlyTrendChart) {
        monthlyTrendChart.destroy();
    }
    
    if (monthlyData.length === 0) {
        // Show no data message
        ctx.font = '16px Arial';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.fillText('No trend data available', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }
    
    const labels = monthlyData.map(item => {
        const [year, month] = item.month.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${monthNames[parseInt(month) - 1]} ${year}`;
    });
    const data = monthlyData.map(item => item.amount);
    
    monthlyTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Monthly Expenses',
                data: data,
                borderColor: '#28a745',
                backgroundColor: 'rgba(40, 167, 69, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#28a745',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `₹ ${Number(context.parsed.y).toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '₹ ' + Number(value).toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function showLoader() {
    $("#globalLoader").fadeIn();
}

function hideLoader() {
    $("#globalLoader").fadeOut();
}