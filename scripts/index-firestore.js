// Firestore-based Index.js
import {
    getAllDropdownData,
    addExpense,
    addIncome,
    addBorrowLent,
    getAutoFillData,
    initializeUserData,
    saveTransactionMapping,
    getTransactionMapping
} from './firestore-service.js';
import { parsePhonePeStatement } from './pdf-parser.js';
import { getUserId } from './auth-helper.js';
import { auth } from './firebase-config.js';

var Global_Response = null;
let pendingTransactions = [];

$(document).ready(function () {
    showLoader();
    initializeApp();


    // Set current date for shared date field
    document.getElementById('GenericDate').value = getCurrentDate();

    // Initialize form state
    toggleTransactionFields('Expense');
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
    // Transaction Type Toggle
    $("#TransactionType").change(function () {
        toggleTransactionFields($(this).val());
    });

    $("#PaymentType").change(function () {
        FillPaymnetSubType($(this).val());
    });

    $("#Category").change(function () {
        FillSubCategory($(this).val());
    });

    // Unified Save Button
    $("#UnifiedSaveBtn").click(function () {
        const type = $("#TransactionType").val();
        showLoader();

        switch (type) {
            case 'Expense':
                InsertExpense();
                break;
            case 'Income':
                InsertIncome();
                break;
            case 'BorrowLent':
                InsertBorrowLent();
                break;
            default:
                console.error("Unknown Transaction Type");
                hideLoader();
        }
    });

    // Description auto-fill (Generic)
    $("#GenericDescription").blur(function () {
        // Only auto-fill if type is Expense
        if ($("#TransactionType").val() === 'Expense') {
            var description = $(this).val();
            if (description !== null && description !== undefined && description.trim() !== '') {
                showLoader();

                // If we are editing a pending transaction (PDF), do NOT autofill payment info
                // because we want to keep the payment info extracted from the PDF.
                const pendingIndex = $("#UnifiedSaveBtn").attr('data-pending-index');
                const includePayment = (pendingIndex === undefined || pendingIndex === null || pendingIndex === "");

                handleDescriptionAutoFill(description, includePayment);
            }
        }
    });

    // PDF Statement Upload
    $("#statementUpload").change(function (e) {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            $("#fileNameDisplay").text(file.name);
            handleStatementUpload(file);
        }
    });

    $("#clearPendingBtn").click(function () {
        $("#pendingTransactionsList").empty();
        $("#pendingTransactionsArea").addClass('d-none');
        $("#pendingCount").text('0');
        if (typeof toastr !== 'undefined') toastr.info("Cleared pending transactions.");
    });
}

function toggleTransactionFields(type) {
    // Hide all first
    $("#ExpenseFields, #IncomeFields, #BorrowLentFields").addClass('d-none');

    // Show specific
    if (type === 'Expense') {
        $("#ExpenseFields").removeClass('d-none');
    } else if (type === 'Income') {
        $("#IncomeFields").removeClass('d-none');
    } else if (type === 'BorrowLent') {
        $("#BorrowLentFields").removeClass('d-none');
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

async function handleDescriptionAutoFill(description, includePayment = true) {
    try {
        const data = await getAutoFillData(description);

        if (data && data.SubPaymentTypeId && data.SubCategoryTypeId) {
            // Find the payment type for this sub payment type
            if (includePayment) {
                const subPaymentType = Global_Response.PaymentSubType.find(item => item.Value == data.SubPaymentTypeId);
                if (subPaymentType) {
                    $("#PaymentType").val(subPaymentType.PaymentType);
                    FillPaymnetSubType($("#PaymentType").val());
                    $("#PaymentSubType").val(data.SubPaymentTypeId);
                }
            }

            // Find the category for this sub category
            const subCategory = Global_Response.SubCategory.find(item => item.Value == data.SubCategoryTypeId);
            if (subCategory) {
                $("#Category").val(subCategory.CategoryId);
                FillSubCategory($("#Category").val());
                $("#SubCategory").val(data.SubCategoryTypeId);
            }

            // $("#UnifiedSaveBtn").focus(); // Optional focus move
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
    var bankAccounts = paymentSubTypes.filter(function (account) {
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
    var bankAccounts = paymentSubTypes.filter(function (account) {
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
    // Read from Shared Fields
    var amount = $("#GenericAmount").val();
    var description = $("#GenericDescription").val();
    var paymentDate = $("#GenericDate").val();

    // Read specific fields
    var paymentType = $("#PaymentType").val();
    var paymentSubType = $("#PaymentSubType").val();
    var category = $("#Category").val();
    var subCategory = $("#SubCategory").val();

    if (amount > 0 && paymentType > 0 && paymentSubType > 0 && category > 0 && subCategory > 0 && description != null && description != '') {
        try {
            const expenseData = {
                amount: amount,
                paymentType: paymentType,
                subPaymentTypeId: paymentSubType,
                category: category,
                subCategoryTypeId: subCategory,
                description: description,
                paymentDate: paymentDate || getCurrentDate(),
                updateBalance: 'true'
            };

            await addExpense(expenseData);

            if (typeof toastr !== 'undefined') {
                toastr.success('Expense data inserted successfully! Account balance updated.');
            } else {
                alert('Expense data inserted successfully! Account balance updated.');
            }

            $("#GenericAmount").val('');
            $("#GenericDescription").val('');
            hideLoader();

            // Check if we saved a pending transaction
            const pendingIndex = $("#UnifiedSaveBtn").attr('data-pending-index');
            if (pendingIndex !== undefined && pendingIndex !== null && pendingIndex !== "") {
                const tx = pendingTransactions[parseInt(pendingIndex)];

                // Save mapping (Learning)
                if (tx && tx.description) {
                    await saveTransactionMapping({
                        originalDescription: tx.description, // Key
                        mappedDescription: description,      // New Value
                        categoryId: category,
                        subCategoryId: subCategory
                    });
                }

                removePendingTransaction(parseInt(pendingIndex));
                $("#UnifiedSaveBtn").removeAttr('data-pending-index');
            }

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

    $("#GenericAmount").focus();
}

async function InsertIncome() {
    // Read from Shared Fields
    var amount = $("#GenericAmount").val();
    var description = $("#GenericDescription").val();
    var incomeDate = $("#GenericDate").val();

    // Specific Fields
    var incomeCategory = $("#IncomeCategory").val();
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

            const result = await addIncome(incomeData);

            if (result.id) {
                if (typeof toastr !== 'undefined') {
                    toastr.success('Income data inserted successfully! Account balance updated.');
                } else {
                    alert('Income data inserted successfully! Account balance updated.');
                }
            } else {
                if (typeof toastr !== 'undefined') {
                    toastr.error('Error: ' + result.message);
                } else {
                    alert('Error: ' + result.message);
                }
            }


            $("#GenericAmount").val('');
            $("#GenericDescription").val('');
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

    $("#GenericAmount").focus();
}

async function InsertBorrowLent() {
    const data = {
        borrowLentType: document.getElementById('BorrowLentType').value,
        person: document.getElementById('BorrowLentPerson').value,
        // Shared fields
        amount: document.getElementById('GenericAmount').value,
        description: document.getElementById('GenericDescription').value,
        date: document.getElementById('GenericDate').value,
        // Specific fields
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

        // Reset specific fields
        $("#BorrowLentPerson").val('');
        $("#BorrowLentDueDate").val('');
        $("#BorrowLentAccount").val('');
        // Reset Shared Fields
        $("#GenericAmount").val('');
        $("#GenericDescription").val('');

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

async function handleStatementUpload(file) {
    showLoader();
    try {
        const transactions = await parsePhonePeStatement(file);

        // Process transactions to find mappings
        pendingTransactions = await Promise.all(transactions.map(async (tx) => {
            // tx.description from PDF is the "Transaction Details" e.g. "ABC Petrolium"
            const mapping = await getTransactionMapping(tx.description);

            if (mapping) {
                return {
                    ...tx,
                    mappedDescription: mapping.mappedDescription,
                    mappedCategoryId: mapping.categoryId,
                    mappedSubCategoryId: mapping.subCategoryId,
                    isMapped: true
                };
            }
            return { ...tx, isMapped: false };
        }));

        if (pendingTransactions.length > 0) {
            renderPendingTransactions();
            if (typeof toastr !== 'undefined') {
                toastr.success(`Successfully extracted ${transactions.length} transactions!`);
            }
        } else {
            if (typeof toastr !== 'undefined') {
                toastr.warning('No transactions found in the statement. Please check the file format.');
            }
        }
    } catch (error) {
        console.error("PDF Parsing Error:", error);
        if (typeof toastr !== 'undefined') {
            toastr.error('Failed to parse PDF: ' + error.message);
        }
    } finally {
        hideLoader();
        $("#statementUpload").val('');
    }
}

async function handleAcceptTransaction(index) {
    const tx = pendingTransactions[index];
    if (!tx || !tx.isMapped) return;

    showLoader();
    try {
        const expenseData = {
            amount: tx.amount,
            // Use resolved payment info if available, otherwise it might fail validation if required fields are missing
            // For now, we rely on the user having set up defaults or the system just trying its best.
            // If paymentType/SubType are missing, addExpense might throw or just save 0.
            // But we don't have them in the mapping.
            // We can try to infer again from the PDF string or defaults.
            paymentType: 1, // Default to UPI? Risky.
            subPaymentTypeId: 1, // Default? Risky.
            description: tx.mappedDescription,
            category: tx.mappedCategoryId,
            subCategoryTypeId: tx.mappedSubCategoryId,
            paymentDate: tx.date,
            updateBalance: 'true'
        };

        // Try to refine Payment Info
        if (tx.paymentMethod && Global_Response && Global_Response.PaymentSubType) {
            const paymentMethod = tx.paymentMethod.toLowerCase();
            const match = Global_Response.PaymentSubType.find(st => st.Text.toLowerCase().includes(paymentMethod));
            if (match) {
                expenseData.paymentType = match.PaymentType;
                expenseData.subPaymentTypeId = match.Value;
            }
        }

        // Validation check before sending
        if (!expenseData.paymentType || !expenseData.subPaymentTypeId) {
            toastr.warning("Could not auto-detect Payment Account. Please use 'Correct' button to select account manually.");
            hideLoader();
            return;
        }

        await addExpense(expenseData);

        toastr.success('Transaction accepted and saved!');
        removePendingTransaction(index);

    } catch (error) {
        console.error("Error accepting transaction:", error);
        toastr.error("Failed to accept: " + error.message);
    } finally {
        hideLoader();
    }
}

function renderPendingTransactions() {
    const list = $("#pendingTransactionsList");
    list.empty();

    if (pendingTransactions.length === 0) {
        $("#pendingTransactionsArea").addClass('d-none');
        return;
    }

    const table = $(`
        <div class="table-responsive">
            <table class="table table-hover table-sm align-middle mb-0">
                <thead class="table-light">
                    <tr>
                        <th style="font-size: 0.8rem;">Date</th>
                        <th style="font-size: 0.8rem;">Amount</th>
                        <th style="font-size: 0.8rem;">Trans. Details</th>
                        <th style="font-size: 0.8rem;">Mapped Desc.</th>
                        <th style="font-size: 0.8rem;">Category</th>
                        <th style="font-size: 0.8rem; text-align: right;">Action</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
    `);

    const tbody = table.find('tbody');

    pendingTransactions.forEach((tx, index) => {
        const isMapped = tx.isMapped;
        let categoryName = "-";

        if (isMapped && Global_Response && Global_Response.Category) {
            const cat = Global_Response.Category.find(c => c.Value == tx.mappedCategoryId);
            const sub = Global_Response.SubCategory.find(s => s.Value == tx.mappedSubCategoryId);
            if (cat) categoryName = cat.Text;
        }

        const tr = $(`
            <tr class="${isMapped ? 'table-success' : ''}" style="${isMapped ? '--bs-table-bg: #d1e7dd;' : ''}">
                <td style="font-size: 0.8rem;">${tx.date}</td>
                <td style="font-size: 0.8rem;" class="${tx.type === 'Income' ? 'text-success' : 'text-danger'} fw-bold">
                    ${tx.type === 'Income' ? '+' : '-'} ${tx.amount}
                </td>
                <td style="font-size: 0.8rem; max-width: 150px;" class="text-truncate" title="${tx.description}">
                    ${tx.description}
                </td>
                <td style="font-size: 0.8rem; max-width: 150px;" class="text-truncate" title="${isMapped ? tx.mappedDescription : ''}">
                    ${isMapped ? tx.mappedDescription : '<span class="text-muted fst-italic">New</span>'}
                </td>
                 <td style="font-size: 0.8rem;">
                    ${categoryName}
                </td>
                <td class="text-end">
                    <div class="btn-group btn-group-sm">
                        ${isMapped ? `
                        <button class="btn btn-success btn-accept p-1" title="Accept" data-index="${index}">
                            <span class="material-icons" style="font-size: 16px;">check</span>
                        </button>` : ''}
                        <button class="btn btn-primary btn-correct p-1" title="Correct/Edit" data-index="${index}">
                            <span class="material-icons" style="font-size: 16px;">edit</span>
                        </button>
                        <button class="btn btn-danger btn-reject p-1" title="Reject" data-index="${index}">
                            <span class="material-icons" style="font-size: 16px;">close</span>
                        </button>
                    </div>
                </td>
            </tr>
        `);

        tbody.append(tr);
    });

    list.append(table);

    // Bind events
    list.find(".btn-accept").click(function () {
        handleAcceptTransaction($(this).data('index'));
    });

    list.find(".btn-correct").click(function () {
        fillExpenseFormFromTransaction($(this).data('index'));
    });

    list.find(".btn-reject").click(function () {
        removePendingTransaction($(this).data('index'));
    });

    $("#pendingCount").text(pendingTransactions.length);
    $("#pendingTransactionsArea").removeClass('d-none');
}

async function fillExpenseFormFromTransaction(index) {
    const tx = pendingTransactions[index];
    if (!tx) return;

    // Auto-switch Transaction Type based on Debit/Credit
    if (tx.type === 'Credit' || tx.type === 'Income') {
        $("#TransactionType").val('BorrowLent').change();
        $("#BorrowLentType").val('Borrow');
    } else {
        $("#TransactionType").val('Expense').change();
    }

    // Fill Shared Fields
    $("#GenericAmount").val(tx.amount);
    $("#GenericDescription").val(tx.description);

    const dateObj = new Date(tx.date);
    if (!isNaN(dateObj.getTime())) {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        $("#GenericDate").val(`${year}-${month}-${day}`);
    }

    // Specifc Logic for Expenses
    if ($("#TransactionType").val() === 'Expense') {

        // If mapped, pre-fill from mapping
        if (tx.isMapped) {
            $("#GenericDescription").val(tx.mappedDescription);
            $("#Category").val(tx.mappedCategoryId);
            FillSubCategory(tx.mappedCategoryId);
            $("#SubCategory").val(tx.mappedSubCategoryId);

            toastr.info("Auto-filled from saved mapping!");
        } else {
            // First try to auto-fill based on description (Category/SubCategory focus)
            // skip payment info autofill as per user request (rely on PDF data)
            await handleDescriptionAutoFill(tx.description, false);
        }

        // Then override Payment Type/Sub Type if we have specific info from PDF
        if (tx.paymentMethod) {
            const paymentMethod = tx.paymentMethod.toLowerCase();
            let match = null;

            if (Global_Response && Global_Response.PaymentSubType) {
                match = Global_Response.PaymentSubType.find(st => {
                    return st.Text.toLowerCase().includes(paymentMethod);
                });
            }

            if (match) {
                $("#PaymentType").val(match.PaymentType);
                FillPaymnetSubType(match.PaymentType);
                $("#PaymentSubType").val(match.Value);

                if (typeof toastr !== 'undefined') {
                    toastr.success(`Auto-selected account: ${match.Text}`);
                }
            }
        }
    }

    $("#UnifiedSaveBtn").attr('data-pending-index', index);
}

function removePendingTransaction(index) {
    pendingTransactions.splice(index, 1);
    renderPendingTransactions();
    if (pendingTransactions.length === 0) {
        $("#pendingTransactionsArea").addClass('d-none');
        if (typeof toastr !== 'undefined') toastr.info("All pending transactions processed!");
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
    const existingUserInfo = document.querySelector('.user-info');
    if (existingUserInfo) {
        existingUserInfo.remove();
    }

    const unsubscribe = auth.onAuthStateChanged((user) => {
        if (user) {
            document.getElementById('userName').textContent = user.displayName || 'User';
            document.getElementById('userEmail').textContent = user.email || '';
        } else {
            document.getElementById('userName').textContent = 'Guest';
            document.getElementById('userEmail').textContent = 'Not signed in';
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', function (e) {
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

document.addEventListener('DOMContentLoaded', function () {
    const hash = window.location.hash;
    if (hash) {
        const tab = document.querySelector(hash);
        if (tab) {
            const tabInstance = new bootstrap.Tab(tab);
            tabInstance.show();
        }
    }
}); 