var URL_Main = 'https://script.google.com/macros/s/AKfycbwWIHyqrYr6nvO8rVL3J0Vfi5kwibefcrcHxw-s16-FRw99aH35S7KgBJONOiLmUl_q/exec';

    var Global_Response = null;

    $(document).ready(function () {
        showLoader()
        GetAllDropDownData()

        $("#PaymentType").change(function () {
            FillPaymnetSubType($(this).val());
        });

        $("#Category").change(function () {
            FillSubCategory($(this).val());
        });

        $("#SaveExpense").click(function () {
            showLoader();
            InsertExpense()
        });

        // Add Income form submission
        $("#SaveIncome").click(function () {
            showLoader();
            InsertIncome();
        });

        // Set current date for both forms
        document.getElementById('PaymentDate').value = getCurrentDate();
        document.getElementById('IncomeDate').value = getCurrentDate();
    });

    function GetAllDropDownData() {
        $.ajax({
            url: URL_Main,
            type: "GET",
            success: function (response) {
                Global_Response = response;

                FillDropDown("PaymentType", response.PaymentType);
                FillPaymnetSubType($("#PaymentType").val());

                FillDropDown("Category", response.Category);
                FillSubCategory($("#Category").val());

                FillDropDown("IncomeCategory", response.IncomeCategory, null, true, "Select Income Source");

                // Populate income account dropdown with bank accounts only
                FillIncomeAccountDropdown(response.PaymentSubType, response.PaymentType);

                hideLoader();
                if (typeof toastr !== 'undefined') {
                    toastr.success('Data loaded successfully!');
                } else {
                    console.log('Data loaded successfully!');
                }
            },
            error: function (xhr, status, error) {
                console.error("AJAX request error", error);
                hideLoader();
                if (typeof toastr !== 'undefined') {
                    toastr.error('Failed to load data. Please try again.');
                } else {
                    console.error('Failed to load data. Please try again.');
                }
            }
        });
    }

    $("#Description").blur(function () {
        var description = $(this).val();
        if(description !== null && description !== undefined && description.trim() !== ''){
            showLoader();
            $.ajax({
                url: URL_Main,
                type: 'GET',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data:
                {
                    description: description
                },
                success: function (data) {
                    
                    if(data !== null && data.SubPaymentTypeId !== null && data.SubPaymentTypeId !== undefined && data.SubPaymentTypeId.toString().trim() !== ''){
                        $("#PaymentType").val(Global_Response.PaymentSubType[data.SubPaymentTypeId - 1].PaymentType);
                        FillPaymnetSubType($("#PaymentType").val());
                        $("#PaymentSubType").val(data.SubPaymentTypeId);
                        
                        $("#Category").val(Global_Response.SubCategory[data.SubCategoryTypeId - 1].CategoryId);
                        FillSubCategory($("#Category").val());
                        $("#SubCategory").val(data.SubCategoryTypeId);

                        $("#SaveExpense").focus();
                        if (typeof toastr !== 'undefined') {
                            toastr.info('Form auto-filled based on description!');
                        } else {
                            console.log('Form auto-filled based on description!');
                        }
                    }
                    hideLoader();
                },
                error: function (xhr, status, error) {
                    if (typeof toastr !== 'undefined') {
                        toastr.error('Error: ' + error.msg);
                    } else {
                        console.error('Error: ' + error.msg);
                    }
                    hideLoader();
                }
            });
        }
    });

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

    function InsertExpense() {

        var amount = $("#Amount").val();
        var paymentType = $("#PaymentType").val();
        var paymentSubType = $("#PaymentSubType").val();
        var category = $("#Category").val();
        var subCategory = $("#SubCategory").val();
        var description = $("#Description").val();
        var paymentDate = $("#PaymentDate").val();

        if (amount > 0 && paymentType > 0 && paymentSubType > 0 && category > 0 && subCategory > 0 && description != null && description != '') {

            $.ajax({
                url: URL_Main,
                type: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data:
                {
                    amount: amount,
                    paymentType: paymentType,
                    subPaymentTypeId: paymentSubType,
                    category: category,
                    subCategoryTypeId: subCategory,
                    description: description,
                    paymentDate: paymentDate,
                    updateBalance: 'true' // Flag to indicate balance should be updated
                },
                success: function (data) {
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
                },
                error: function (xhr, status, error) {
                    if (typeof toastr !== 'undefined') {
                        toastr.error('Error: ' + error.msg);
                    } else {
                        alert('Error: ' + error.msg);
                    }
                    hideLoader();
                }
            });
        }
        else {
            if (typeof toastr !== 'undefined') {
                toastr.warning("Please fill all required details...");
            } else {
                alert("Please fill all required details...");
            }
            hideLoader()
        }

        $("#Amount").focus();
    }

    function InsertIncome() {
        var amount = $("#IncomeAmount").val();
        var description = $("#IncomeDescription").val();
        var incomeCategory = $("#IncomeCategory").val();
        var incomeDate = $("#IncomeDate").val();
        var accountId = $("#IncomeAccount").val();

        if (amount > 0 && incomeCategory > 0 && description != null && description != '' && incomeDate != null && incomeDate != '') {
            $.ajax({
                url: URL_Main,
                type: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: {
                    type: 'income',
                    amount: amount,
                    description: description,
                    incomeSource: incomeCategory,
                    date: incomeDate,
                    accountId: accountId,
                    updateBalance: 'true'
                },
                success: function (data) {
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
                },
                error: function (xhr, status, error) {
                    if (typeof toastr !== 'undefined') {
                        toastr.error('Error: ' + error.msg);
                    } else {
                        alert('Error: ' + error.msg);
                    }
                    hideLoader();
                }
            });
        }
        else {
            if (typeof toastr !== 'undefined') {
                toastr.warning("Please fill all required income details...");
            } else {
                alert("Please fill all required income details...");
            }
            hideLoader();
        }

        $("#IncomeAmount").focus();
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

    // Borrow/Lent form submission
    const borrowLentForm = document.getElementById('borrow-lent-form');
    if (borrowLentForm) {
        borrowLentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            showLoader();
            
            const data = {
                type: 'borrowlent',
                borrowLentType: document.getElementById('BorrowLentType').value,
                person: document.getElementById('BorrowLentPerson').value,
                amount: document.getElementById('BorrowLentAmount').value,
                description: document.getElementById('BorrowLentDescription').value,
                date: document.getElementById('BorrowLentDate').value,
                dueDate: document.getElementById('BorrowLentDueDate').value,
                status: document.getElementById('BorrowLentStatus').value,
                returnedDate: document.getElementById('BorrowLentReturnedDate').value
            };
            
            fetch(URL_Main, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams(data)
            })
            .then(() => {
                if (typeof toastr !== 'undefined') {
                    toastr.success('Borrow/Lent record saved successfully!');
                } else {
                    alert('Borrow/Lent record saved successfully!');
                }
                borrowLentForm.reset();
                hideLoader();
            })
            .catch(() => {
                if (typeof toastr !== 'undefined') {
                    toastr.error('Failed to save Borrow/Lent record.');
                } else {
                    alert('Failed to save Borrow/Lent record.');
                }
                hideLoader();
            });
        });
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