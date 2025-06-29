const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwWIHyqrYr6nvO8rVL3J0Vfi5kwibefcrcHxw-s16-FRw99aH35S7KgBJONOiLmUl_q/exec';

let Global_Response = null;
let selectedAccountId = null;

$(document).ready(function() {
    showLoader();
    loadBalanceData();
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
});

function loadBalanceData() {
    $.ajax({
        url: APPS_SCRIPT_URL,
        type: "GET",
        success: function(response) {
            Global_Response = response;
            populateAccountDropdown();
            loadBalanceTable();
            calculateSummary();
            hideLoader();
            if (typeof toastr !== 'undefined') {
                toastr.success('Balance data loaded successfully!');
            } else {
                console.log('Balance data loaded successfully!');
            }
        },
        error: function(xhr, status, error) {
            console.error("AJAX request error", error);
            if (typeof toastr !== 'undefined') {
                toastr.error('Error loading balance data. Please try again.');
            } else {
                console.error('Error loading balance data. Please try again.');
            }
            hideLoader();
        }
    });
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
    if (Global_Response && Global_Response.Balance) {
        const accountBalance = Global_Response.Balance.find(b => b.AccountId == accountId);
        if (accountBalance) {
            $('#balanceAmount').val(accountBalance.Balance || 0);
            $('#creditLimit').val(accountBalance.CreditLimit || 0);
            $('#lastUpdated').val(accountBalance.LastUpdated || getCurrentDate());
        } else {
            $('#balanceAmount').val('');
            $('#creditLimit').val('');
            $('#lastUpdated').val(getCurrentDate());
        }
    }
}

function loadBalanceTable() {
    const tbody = $('#balance-table');
    tbody.empty();
    
    if (Global_Response && Global_Response.Balance && Global_Response.Balance.length > 0) {
        Global_Response.Balance.forEach(function(balance) {
            console.log(balance);
            const account = Global_Response.PaymentSubType.find(a => a.Value == balance.AccountId);
            const paymentType = Global_Response.PaymentType.find(p => p.Value == account.PaymentType);
            
            const accountType = paymentType ? paymentType.Text : 'Unknown';
            const isCreditCard = account.PaymentType == 3; // Assuming 3 is credit card type
            const available = isCreditCard ? (balance.CreditLimit - balance.Balance) : balance.Balance;
            
            // Format balance display based on account type
            let balanceDisplay = '';
            if (isCreditCard) {
                balanceDisplay = `Used: ₹ ${Number(balance.Balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`;
            } else {
                balanceDisplay = `₹ ${Number(balance.Balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`;
            }
            
            const tr = `
                <tr>
                    <td>${account ? account.Text : 'Unknown'}</td>
                    <td><span class="badge bg-${isCreditCard ? 'warning' : 'primary'}">${accountType}</span></td>
                    <td>${balanceDisplay}</td>
                    <td>${isCreditCard ? '₹ ' + Number(balance.CreditLimit || 0).toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}</td>
                    <td class="${available < 0 ? 'text-danger' : 'text-success'}">₹ ${Number(available).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td>${balance.LastUpdated || 'Not set'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="editBalance(${balance.AccountId})">
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
    let totalAvailable = 0;
    
    if (Global_Response && Global_Response.Balance) {
        Global_Response.Balance.forEach(function(balance) {
            const account = Global_Response.PaymentSubType.find(a => a.Value == balance.AccountId);
            const isCreditCard = account && account.PaymentType == 3;
            
            if (isCreditCard) {
                totalCreditLimit += parseFloat(balance.CreditLimit || 0);
                totalAvailable += parseFloat(balance.CreditLimit || 0) - parseFloat(balance.Balance || 0);
            } else {
                totalBankBalance += parseFloat(balance.Balance || 0);
                totalAvailable += parseFloat(balance.Balance || 0);
            }
        });
    }
    
    $('#total-bank-balance').text(`₹ ${totalBankBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
    $('#total-credit-limit').text(`₹ ${totalCreditLimit.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
    $('#net-available').text(`₹ ${totalAvailable.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
}

function saveBalance() {
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
    
    const data = {
        type: 'balance',
        accountId: accountId,
        balance: balanceAmount,
        creditLimit: creditLimit || 0,
        lastUpdated: lastUpdated
    };
    
    $.ajax({
        url: APPS_SCRIPT_URL,
        type: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: data,
        success: function(response) {
            if (typeof toastr !== 'undefined') {
                toastr.success('Balance saved successfully!');
            } else {
                alert('Balance saved successfully!');
            }
            resetForm();
            loadBalanceData(); // Reload all data
        },
        error: function(xhr, status, error) {
            if (typeof toastr !== 'undefined') {
                toastr.error('Error saving balance: ' + error);
            } else {
                alert('Error saving balance: ' + error);
            }
            hideLoader();
        }
    });
}

function editBalance(accountId) {
    $('#accountSelect').val(accountId);
    selectedAccountId = accountId;
    loadAccountBalance(accountId);
    
    // Scroll to form
    $('html, body').animate({
        scrollTop: $('#balance-form').offset().top - 100
    }, 500);
    
    if (typeof toastr !== 'undefined') {
        toastr.info('Account selected for editing');
    } else {
        console.log('Account selected for editing');
    }
}

function resetForm() {
    $('#balance-form')[0].reset();
    $('#accountSelect').val('');
    selectedAccountId = null;
    setCurrentDate();
    if (typeof toastr !== 'undefined') {
        toastr.info('Form reset successfully');
    } else {
        console.log('Form reset successfully');
    }
}

function setCurrentDate() {
    $('#lastUpdated').val(getCurrentDate());
}

function getCurrentDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function showLoader() {
    $("#globalLoader").fadeIn();
}

function hideLoader() {
    $("#globalLoader").fadeOut();
}