// Firestore-based Index.js
import { 
    getAllDropdownData, 
    addExpense, 
    addIncome, 
    addBorrowLent, 
    getAutoFillData,
    initializeUserData 
} from './firestore-service.js';
import { getUserId } from './auth-helper.js';
import { auth } from './firebase-config.js';

var Global_Response = null;

$(document).ready(function () {
    showLoader();
    initializeApp();
    
    // Set current date for both forms
    document.getElementById('PaymentDate').value = getCurrentDate();
    document.getElementById('IncomeDate').value = getCurrentDate();
});

async function initializeApp() {
    try {
        // Load user profile
        loadUserProfile();
        
        // Initialize user data if needed
        await initializeUserData();
        
        // Get all dropdown data
        await GetAllDropDownData();
        
        // Set up event listeners
        setupEventListeners();
        
        hideLoader();
        if (typeof toastr !== 'undefined') {
            toastr.success('Data loaded successfully!');
        }
    } catch (error) {
        console.error('Error initializing app:', error);
        hideLoader();
        if (typeof toastr !== 'undefined') {
            toastr.error('Failed to load data. Please try again.');
        }
    }
}

function setupEventListeners() {
    $("#PaymentType").change(function () {
        FillPaymnetSubType($(this).val());
    });

    $("#Category").change(function () {
        FillSubCategory($(this).val());
    });

    $("#SaveExpense").click(function () {
        showLoader();
        InsertExpense();
    });

    $("#SaveIncome").click(function () {
        showLoader();
        InsertIncome();
    });

    // Description auto-fill
    $("#Description").blur(function () {
        var description = $(this).val();
        if (description !== null && description !== undefined && description.trim() !== '') {
            showLoader();
            handleDescriptionAutoFill(description);
        }
    });

    // Borrow/Lent form submission
    const borrowLentForm = document.getElementById('borrow-lent-form');
    if (borrowLentForm) {
        borrowLentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            showLoader();
            InsertBorrowLent();
        });
    }
}

async function GetAllDropDownData() {
    try {
        const response = await getAllDropdownData();
        Global_Response = response;

        FillDropDown("PaymentType", response.PaymentType);
        FillPaymnetSubType($("#PaymentType").val());

        FillDropDown("Category", response.Category);
        FillSubCategory($("#Category").val());

        FillDropDown("IncomeCategory", response.IncomeCategory, null, true, "Select Income Source");

        // Populate income account dropdown with bank accounts only
        FillIncomeAccountDropdown(response.PaymentSubType, response.PaymentType);
        
        // Populate borrow/lent account dropdown with bank accounts only
        FillBorrowLentAccountDropdown(response.PaymentSubType, response.PaymentType);
    } catch (error) {
        console.error('Error getting dropdown data:', error);
        throw error;
    }
}

async function handleDescriptionAutoFill(description) {
    try {
        const data = await getAutoFillData(description);
        
        if (data && data.SubPaymentTypeId && data.SubCategoryTypeId) {
            // Find the payment type for this sub payment type
            const subPaymentType = Global_Response.PaymentSubType.find(item => item.Value == data.SubPaymentTypeId);
            if (subPaymentType) {
                $("#PaymentType").val(subPaymentType.PaymentType);
                FillPaymnetSubType($("#PaymentType").val());
                $("#PaymentSubType").val(data.SubPaymentTypeId);
            }
            
            // Find the category for this sub category
            const subCategory = Global_Response.SubCategory.find(item => item.Value == data.SubCategoryTypeId);
            if (subCategory) {
                $("#Category").val(subCategory.CategoryId);
                FillSubCategory($("#Category").val());
                $("#SubCategory").val(data.SubCategoryTypeId);
            }

            $("#SaveExpense").focus();
            if (typeof toastr !== 'undefined') {
                toastr.info('Form auto-filled based on description!');
            }
        }
        hideLoader();
    } catch (error) {
        console.error('Error in auto-fill:', error);
        hideLoader();
    }
}

function FillPaymnetSubType(id) {
    let paymentSubTypeRes = Object.fromEntries(Object.entries(Global_Response.PaymentSubType).filter(([k, v]) => v.PaymentType == id));
    FillDropDown("PaymentSubType", paymentSubTypeRes);
}

function FillSubCategory(id) {
    let subCategoryRes = Object.fromEntries(Object.entries(Global_Response.SubCategory).filter(([k, v]) => v.CategoryId == id));
    FillDropDown("SubCategory", subCategoryRes);
}

function FillIncomeAccountDropdown(paymentSubTypes, paymentTypes) {
    var options = '<option value="" disabled selected>Select Account</option>';
    
    // Filter for bank accounts only (not credit cards)
    var bankAccounts = paymentSubTypes.filter(function(account) {
        // Assuming credit card type is 3, adjust if different
        return account.PaymentType != 3;
    });
    
    $.each(bankAccounts, function (i, val) {
        options += '<option value = "' + val.Value + '" >' + val.Text + '</option>';
    });
    
    $("#IncomeAccount").html(options);
}

function FillBorrowLentAccountDropdown(paymentSubTypes, paymentTypes) {
    var options = '<option value="" disabled selected>Select Account</option>';
    
    // Filter for bank accounts only (not credit cards)
    var bankAccounts = paymentSubTypes.filter(function(account) {
        // Assuming credit card type is 3, adjust if different
        return account.PaymentType != 3;
    });
    
    $.each(bankAccounts, function (i, val) {
        options += '<option value = "' + val.Value + '" >' + val.Text + '</option>';
    });
    
    $("#BorrowLentAccount").html(options);
}

function FillDropDown(id, data, value, hasSelect, defaultText) {
    var options = '';
    if (hasSelect == true) {
        if (defaultText == undefined || defaultText == null)
            defaultText = 'Select';

        options = "<option value=''>" + defaultText + "</option>";
    }

    $.each(data, function (i, val) {
        options += '<option value = "' + val.Value + '" >' + val.Text + '</option>'
    });

    $("#" + id).html(options);

    if (value && value != '' && value != 0) {
        $("#" + id).val(value);
    }

    if ($('#' + id).attr('selval') && $('#' + id).attr('selval') > 0) {
        $("#" + id).val($('#' + id).attr('selval'));
    }

    if ($("#" + id).selectpicker != undefined) {
        $("#" + id).selectpicker('refresh');
    }
}

async function InsertExpense() {
    var amount = $("#Amount").val();
    var paymentType = $("#PaymentType").val();
    var paymentSubType = $("#PaymentSubType").val();
    var category = $("#Category").val();
    var subCategory = $("#SubCategory").val();
    var description = $("#Description").val();
    var paymentDate = $("#PaymentDate").val();

    if (amount > 0 && paymentType > 0 && paymentSubType > 0 && category > 0 && subCategory > 0 && description != null && description != '') {
        try {
            const expenseData = {
                amount: amount,
                paymentType: paymentType,
                subPaymentTypeId: paymentSubType,
                category: category,
                subCategoryTypeId: subCategory,
                description: description,
                paymentDate: paymentDate,
                updateBalance: 'true'
            };

            await addExpense(expenseData);

            // Show success toast
            if (typeof toastr !== 'undefined') {
                toastr.success('Expense data inserted successfully! Account balance updated.');
            } else {
                alert('Expense data inserted successfully! Account balance updated.');
            }
            
            // Clear input fields
            $("#Amount").val('');
            $("#Description").val('');
            hideLoader();
        } catch (error) {
            console.error('Error inserting expense:', error);
            if (typeof toastr !== 'undefined') {
                toastr.error('Error: ' + error.message);
            } else {
                alert('Error: ' + error.message);
            }
            hideLoader();
        }
    } else {
        if (typeof toastr !== 'undefined') {
            toastr.warning("Please fill all required details...");
        } else {
            alert("Please fill all required details...");
        }
        hideLoader();
    }

    $("#Amount").focus();
}

async function InsertIncome() {
    var amount = $("#IncomeAmount").val();
    var description = $("#IncomeDescription").val();
    var incomeCategory = $("#IncomeCategory").val();
    var incomeDate = $("#IncomeDate").val();
    var accountId = $("#IncomeAccount").val();

    if (amount > 0 && incomeCategory > 0 && description != null && description != '' && incomeDate != null && incomeDate != '') {
        try {
            const incomeData = {
                amount: amount,
                description: description,
                incomeSource: incomeCategory,
                date: incomeDate,
                accountId: accountId,
                updateBalance: 'true'
            };

            await addIncome(incomeData);

            if (typeof toastr !== 'undefined') {
                toastr.success('Income data inserted successfully! Account balance updated.');
            } else {
                alert('Income data inserted successfully! Account balance updated.');
            }
            
            $("#IncomeAmount").val('');
            $("#IncomeDescription").val('');
            $("#IncomeCategory").val('');
            $("#IncomeAccount").val('');
            hideLoader();
        } catch (error) {
            console.error('Error inserting income:', error);
            if (typeof toastr !== 'undefined') {
                toastr.error('Error: ' + error.message);
            } else {
                alert('Error: ' + error.message);
            }
            hideLoader();
        }
    } else {
        if (typeof toastr !== 'undefined') {
            toastr.warning("Please fill all required income details...");
        } else {
            alert("Please fill all required income details...");
        }
        hideLoader();
    }

    $("#IncomeAmount").focus();
}

async function InsertBorrowLent() {
    const data = {
        borrowLentType: document.getElementById('BorrowLentType').value,
        person: document.getElementById('BorrowLentPerson').value,
        amount: document.getElementById('BorrowLentAmount').value,
        description: document.getElementById('BorrowLentDescription').value,
        date: document.getElementById('BorrowLentDate').value,
        dueDate: document.getElementById('BorrowLentDueDate').value,
        status: document.getElementById('BorrowLentStatus').value,
        returnedDate: document.getElementById('BorrowLentReturnedDate').value,
        accountId: document.getElementById('BorrowLentAccount').value,
        updateBalance: document.getElementById('BorrowLentUpdateBalance').checked.toString()
    };

    // Validate required fields
    if (!data.borrowLentType || !data.person || !data.amount || !data.description || 
        !data.date || !data.dueDate || !data.status || !data.accountId) {
        if (typeof toastr !== 'undefined') {
            toastr.warning("Please fill all required details...");
        } else {
            alert("Please fill all required details...");
        }
        hideLoader();
        return;
    }

    try {
        await addBorrowLent(data);
        
        if (typeof toastr !== 'undefined') {
            const balanceMessage = data.updateBalance === "true" ? " Account balance updated." : "";
            toastr.success('Borrow/Lent record saved successfully!' + balanceMessage);
        } else {
            const balanceMessage = data.updateBalance === "true" ? " Account balance updated." : "";
            alert('Borrow/Lent record saved successfully!' + balanceMessage);
        }
        
        document.getElementById('borrow-lent-form').reset();
        // Reset the checkbox to checked
        document.getElementById('BorrowLentUpdateBalance').checked = true;
        hideLoader();
    } catch (error) {
        console.error('Error inserting borrow/lent:', error);
        if (typeof toastr !== 'undefined') {
            toastr.error('Failed to save Borrow/Lent record: ' + error.message);
        } else {
            alert('Failed to save Borrow/Lent record: ' + error.message);
        }
        hideLoader();
    }
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
    
    // Initialize Bootstrap dropdown manually if needed
    if (typeof bootstrap !== 'undefined') {
        const dropdownElementList = [].slice.call(document.querySelectorAll('.dropdown-toggle'));
        dropdownElementList.map(function (dropdownToggleEl) {
            return new bootstrap.Dropdown(dropdownToggleEl);
        });
    }
}

function showLoader() {
    $("#globalLoader").fadeIn();
}

function hideLoader() {
    $("#globalLoader").fadeOut();
}

// Handle tab navigation from URL hash
document.addEventListener('DOMContentLoaded', function() {
    const hash = window.location.hash;
    if (hash) {
        const tab = document.querySelector(hash);
        if (tab) {
            const tabInstance = new bootstrap.Tab(tab);
            tabInstance.show();
        }
    }
}); 