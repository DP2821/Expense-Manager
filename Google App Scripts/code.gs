// Post: Insert Data
function doPost(data) {
  if (data.parameter.type === 'borrowlent') {
    var id = getNextBorrowLentId();
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = doc.getSheetByName('BorrowLent');
    var newRow = [
      id,
      data.parameter.borrowLentType, // Type (Borrow/Lent)
      data.parameter.person,
      data.parameter.amount,
      data.parameter.description,
      data.parameter.date,
      data.parameter.dueDate,
      data.parameter.status,
      data.parameter.returnedDate
    ];
    sheet.appendRow(newRow);
    return ContentService.createTextOutput(JSON.stringify({ 'msg': 'Borrow/Lent record inserted successfully.' }))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (data.parameter.type === 'income') {
    var id = getNextIncomeId();
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = doc.getSheetByName('Income');
    var newRow = [
      id,
      data.parameter.amount,
      data.parameter.description,
      data.parameter.incomeSource,
      data.parameter.date,
      getCurrentDate()
    ];
    sheet.appendRow(newRow);
    
    // Update balance automatically if requested and account is specified
    if (data.parameter.updateBalance === 'true' && data.parameter.accountId) {
      updateAccountBalanceForIncome(data.parameter.accountId, data.parameter.amount);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ 'msg': 'Income record inserted successfully.' }))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (data.parameter.type === 'balance') {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = doc.getSheetByName('Balance');
    
    // Check if balance already exists for this account
    var existingRow = findBalanceRow(data.parameter.accountId);
    
    if (existingRow) {
      // Update existing balance
      sheet.getRange(existingRow, 2).setValue(data.parameter.balance);
      sheet.getRange(existingRow, 3).setValue(data.parameter.creditLimit);
      sheet.getRange(existingRow, 4).setValue(data.parameter.lastUpdated);
    } else {
      // Add new balance
      var newRow = [
        data.parameter.accountId,
        data.parameter.balance,
        data.parameter.creditLimit,
        data.parameter.lastUpdated
      ];
      sheet.appendRow(newRow);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ 'msg': 'Balance saved successfully.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // Handle expense insertion with automatic balance update
  var id = getNextId();
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = doc.getSheetByName('Expenses'); // Replace 'YourSheetName' with the actual sheet name

  var newRow = [id, data.parameter.amount, data.parameter.subPaymentTypeId, data.parameter.subCategoryTypeId, data.parameter.description, data.parameter.paymentDate, getCurrentDate()];
  sheet.appendRow(newRow);

  // Update balance automatically if requested
  if (data.parameter.updateBalance === 'true') {
    updateAccountBalance(data.parameter.subPaymentTypeId, data.parameter.amount);
  }

  return ContentService.createTextOutput(JSON.stringify({ 'msg': 'Data inserted successfully.' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getNextId() {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = doc.getSheetByName('Expenses');
  var data = sheet.getDataRange().getValues();

  if (data.length === 0) {
    return 1;
  }

  var lastId = data[data.length - 1][0];
  return lastId + 1;
}

function getNextBorrowLentId() {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = doc.getSheetByName('BorrowLent');
  var data = sheet.getDataRange().getValues();
  if (data.length === 0) {
    return 1;
  }
  var lastId = data[data.length - 1][0];
  return lastId + 1;
}

function getNextIncomeId() {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = doc.getSheetByName('Income');
  var data = sheet.getDataRange().getValues();
  if (data.length === 0) {
    return 1;
  }
  var lastId = data[data.length - 1][0];
  return lastId + 1;
}

function findBalanceRow(accountId) {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = doc.getSheetByName('Balance');
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == accountId) {
      return i + 1; // Return 1-based row number
    }
  }
  return null; // Not found
}

function updateAccountBalance(accountId, expenseAmount) {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var balanceSheet = doc.getSheetByName('Balance');
  var paymentSubTypeSheet = doc.getSheetByName('PaymentSubtype');
  
  // Get account type information
  var paymentSubTypeData = paymentSubTypeSheet.getDataRange().getValues();
  var accountType = null;
  
  // Find the account type (bank account vs credit card)
  for (var i = 1; i < paymentSubTypeData.length; i++) {
    if (paymentSubTypeData[i][0] == accountId) { // Assuming Value is in first column
      accountType = paymentSubTypeData[i][1]; // Assuming PaymentType is in second column
      break;
    }
  }
  
  // Find existing balance row
  var existingRow = findBalanceRow(accountId);
  
  if (existingRow) {
    // Update existing balance
    var currentBalance = parseFloat(balanceSheet.getRange(existingRow, 2).getValue() || 0);
    var creditLimit = parseFloat(balanceSheet.getRange(existingRow, 3).getValue() || 0);
    
    if (accountType == 3) { // Credit card (assuming 3 is credit card type)
      // For credit cards: increase the used amount (balance field stores used amount)
      var newUsedAmount = currentBalance + parseFloat(expenseAmount);
      balanceSheet.getRange(existingRow, 2).setValue(newUsedAmount);
    } else {
      // For bank accounts: decrease the balance
      var newBalance = currentBalance - parseFloat(expenseAmount);
      balanceSheet.getRange(existingRow, 2).setValue(newBalance);
    }
    
    // Update last updated date
    balanceSheet.getRange(existingRow, 4).setValue(getCurrentDate());
  } else {
    // Create new balance entry if it doesn't exist
    var newBalance = 0;
    var creditLimit = 0;
    
    if (accountType == 3) { // Credit card
      // For credit cards: set initial used amount
      newBalance = parseFloat(expenseAmount);
      // You might want to set a default credit limit or leave it 0
    } else {
      // For bank accounts: set negative balance (assuming this is the first transaction)
      newBalance = -parseFloat(expenseAmount);
    }
    
    var newRow = [
      accountId,
      newBalance,
      creditLimit,
      getCurrentDate()
    ];
    balanceSheet.appendRow(newRow);
  }
}

function getCurrentDate() {
  const date = new Date();

  let currentDay = String(date.getDate()).padStart(2, '0');

  let currentMonth = String(date.getMonth() + 1).padStart(2, "0");

  let currentYear = date.getFullYear();

  let currentDate = `${currentYear}-${currentMonth}-${currentDay}`;

  return currentDate;
}

// Get: Get Data
function doGet(e) {
  if (e.parameter.description) {
    var description = e.parameter.description;
    var expenseDetails = getExpenseDetailsByDescription(description);
    return ContentService.createTextOutput(JSON.stringify(expenseDetails))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (e.parameter.report === 'monthlyExpenseSummary') {
    var monthlySummary = getMonthlyExpenseSummary();
    return ContentService.createTextOutput(JSON.stringify(monthlySummary))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (e.parameter.dashboard == '1') {
    var dashboardData = getDashboardData();
    return ContentService.createTextOutput(JSON.stringify(dashboardData))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (e.parameter.analytics == '1') {
    var startDate = e.parameter.startDate || '';
    var endDate = e.parameter.endDate || '';
    var analyticsData = getAnalyticsData(startDate, endDate);
    return ContentService.createTextOutput(JSON.stringify(analyticsData))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (e.parameter.borrowlent == '1') {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = doc.getSheetByName('BorrowLent');
    var data = sheet.getDataRange().getValues();
    return ContentService.createTextOutput(JSON.stringify(dataToJSON(data)))
      .setMimeType(ContentService.MimeType.JSON);
  } else {
    var doc = SpreadsheetApp.getActiveSpreadsheet();

    var paymentTypeSheet = doc.getSheetByName('PaymentType');
    var paymentSubTypeSheet = doc.getSheetByName('PaymentSubtype');
    var categorySheet = doc.getSheetByName('Category');
    var subCategorySheet = doc.getSheetByName('SubCategory');
    var incomeCategorySheet = doc.getSheetByName('IncomeCategory');
    var balanceSheet = doc.getSheetByName('Balance');

    var paymentTypeData = paymentTypeSheet.getDataRange().getValues();
    var paymentSubTypeDate = paymentSubTypeSheet.getDataRange().getValues();
    var categoryData = categorySheet.getDataRange().getValues();
    var subCategoryData = subCategorySheet.getDataRange().getValues();
    var incomeCategoryData = incomeCategorySheet ? incomeCategorySheet.getDataRange().getValues() : [];
    var balanceData = balanceSheet ? balanceSheet.getDataRange().getValues() : [];

    var jsonData = {
      'PaymentType': dataToJSON(paymentTypeData),
      'PaymentSubType': dataToJSON(paymentSubTypeDate),
      'Category': dataToJSON(categoryData),
      'SubCategory': dataToJSON(subCategoryData),
      'IncomeCategory': dataToJSON(incomeCategoryData),
      'Balance': dataToJSON(balanceData)
    }

    return ContentService.createTextOutput(JSON.stringify(jsonData))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function dataToJSON(data) {
  var headers = data[0];
  var jsonData = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rowObject = {};

    for (var j = 0; j < headers.length; j++) {
      rowObject[headers[j]] = row[j];
    }

    jsonData.push(rowObject);
  }

  return jsonData;
}

function getExpenseDetailsByDescription(description) {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var expensesSheet = doc.getSheetByName('Expenses');
  var data = expensesSheet.getDataRange().getValues();
  var headers = data[0];
  var descriptionIndex = headers.indexOf('Description');
  var paymentTypeIndex = headers.indexOf('SubPaymentTypeId');
  var subCategoryIndex = headers.indexOf('SubCategoryTypeId');


  var result = {
    SubPaymentTypeId: '',
    SubCategoryTypeId: ''
  };

  for (var i = 1; i < data.length; i++) {
    if (data[i][descriptionIndex].toString().toLowerCase().trim() === description.toString().toLowerCase().trim()) {
      result.SubPaymentTypeId = data[i][paymentTypeIndex];
      result.SubCategoryTypeId = data[i][subCategoryIndex];
      break;
    }
  }
  return result;
}

function getMonthlyExpenseSummary() {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var expensesSheet = doc.getSheetByName('Expenses');
  var data = expensesSheet.getDataRange().getValues();
  var headers = data[0];
  var dateIndex = headers.indexOf('PaymentDate');
  var amountIndex = headers.indexOf('Amount');

  var summary = {};

  for (var i = 1; i < data.length; i++) {
    var date = new Date(data[i][dateIndex]);
    var month = date.getMonth() + 1; // Months are zero-indexed
    var year = date.getFullYear();
    var key = year + '-' + month;

    if (!summary[key]) {
      summary[key] = 0;
    }

    summary[key] += data[i][amountIndex];
  }

  return summary;
}

function getDashboardData() {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var expensesSheet = doc.getSheetByName('Expenses');
  var incomeSheet = doc.getSheetByName('Income');
  var borrowLentSheet = doc.getSheetByName('BorrowLent');
  var balanceSheet = doc.getSheetByName('Balance');

  var expensesData = expensesSheet ? expensesSheet.getDataRange().getValues() : [];
  var incomeData = incomeSheet ? incomeSheet.getDataRange().getValues() : [];
  var borrowLentData = borrowLentSheet ? borrowLentSheet.getDataRange().getValues() : [];
  var balanceData = balanceSheet ? balanceSheet.getDataRange().getValues() : [];

  // Get headers
  var expenseHeaders = expensesData.length > 0 ? expensesData[0] : [];
  var incomeHeaders = incomeData.length > 0 ? incomeData[0] : [];
  var borrowLentHeaders = borrowLentData.length > 0 ? borrowLentData[0] : [];
  var balanceHeaders = balanceData.length > 0 ? balanceData[0] : [];

  // Helper to get column index
  function idx(headers, name) {
    return headers.indexOf(name);
  }

  // Get current month/year
  var now = new Date();
  var thisMonth = now.getMonth();
  var thisYear = now.getFullYear();

  // Calculate totals
  var totalExpense = 0, monthExpense = 0;
  var totalIncome = 0, monthIncome = 0;
  var totalBorrowed = 0, totalLent = 0, openBorrowLent = 0;
  var currentBalance = 0;
  var transactions = [];
  var borrowLentTransactions = [];

  // Calculate current balance from balance sheet
  for (var i = 1; i < balanceData.length; i++) {
    var row = balanceData[i];
    var accountId = row[0];
    var balance = parseFloat(row[1] || 0);
    var creditLimit = parseFloat(row[2] || 0);
    
    // For credit cards, available balance is credit limit - used amount
    // For bank accounts, balance is the actual balance
    if (creditLimit > 0) {
      // Credit card - available is credit limit - used amount
      currentBalance += creditLimit - balance;
    } else {
      // Bank account - actual balance
      currentBalance += balance;
    }
  }

  // Expenses
  for (var i = 1; i < expensesData.length; i++) {
    var row = expensesData[i];
    var amount = parseFloat(row[idx(expenseHeaders, 'Amount')] || 0);
    var date = new Date(row[idx(expenseHeaders, 'PaymentDate')]);
    var description = row[idx(expenseHeaders, 'Description')] || '';
    var category = row[idx(expenseHeaders, 'SubCategoryTypeId')] || '';
    totalExpense += amount;
    if (date.getMonth() === thisMonth && date.getFullYear() === thisYear) {
      monthExpense += amount;
    }
    transactions.push({
      date: formatDateForDashboard(date),
      description: description,
      type: 'Expense',
      category: category,
      amount: -amount
    });
  }

  // Income
  for (var i = 1; i < incomeData.length; i++) {
    var row = incomeData[i];
    var amount = parseFloat(row[idx(incomeHeaders, 'Amount')] || 0);
    var date = new Date(row[idx(incomeHeaders, 'Date')]);
    var description = row[idx(incomeHeaders, 'Description')] || '';
    var source = row[idx(incomeHeaders, 'IncomeSource')] || '';
    totalIncome += amount;
    if (date.getMonth() === thisMonth && date.getFullYear() === thisYear) {
      monthIncome += amount;
    }
    transactions.push({
      date: formatDateForDashboard(date),
      description: description,
      type: 'Income',
      category: source,
      amount: amount
    });
  }

  // Borrow/Lent
  for (var i = 1; i < borrowLentData.length; i++) {
    var row = borrowLentData[i];
    var type = row[idx(borrowLentHeaders, 'Type')] || '';
    var person = row[idx(borrowLentHeaders, 'Person')] || '';
    var amount = parseFloat(row[idx(borrowLentHeaders, 'Amount')] || 0);
    var description = row[idx(borrowLentHeaders, 'Description')] || '';
    var date = new Date(row[idx(borrowLentHeaders, 'Date')]);
    var dueDate = new Date(row[idx(borrowLentHeaders, 'DueDate')]);
    var status = row[idx(borrowLentHeaders, 'Status')] || '';
    var returnedDate = row[idx(borrowLentHeaders, 'ReturnedDate')] || '';
    
    if (status === 'Open') {
      openBorrowLent++;
      if (type === 'Borrow') {
        totalBorrowed += amount;
      } else if (type === 'Lent') {
        totalLent += amount;
      }
    }
    
    borrowLentTransactions.push({
      date: formatDateForDashboard(date),
      type: type,
      person: person,
      description: description,
      amount: amount,
      dueDate: formatDateForDashboard(dueDate),
      status: status,
      returnedDate: returnedDate ? formatDateForDashboard(new Date(returnedDate)) : ''
    });
  }

  // Sort transactions by date descending
  transactions.sort(function(a, b) {
    return new Date(b.date) - new Date(a.date);
  });

  // Sort borrow/lent transactions by date descending
  borrowLentTransactions.sort(function(a, b) {
    return new Date(b.date) - new Date(a.date);
  });

  // Take last 10 for recent transactions
  var recentTransactions = transactions.slice(0, 10);

  return {
    currentBalance: currentBalance,
    monthExpense: monthExpense,
    monthIncome: monthIncome,
    borrowLentBalance: totalLent - totalBorrowed,
    openBorrowLent: openBorrowLent,
    recentTransactions: recentTransactions,
    borrowLentTransactions: borrowLentTransactions
  };
}

function formatDateForDashboard(date) {
  if (!(date instanceof Date) || isNaN(date)) return '';
  var yyyy = date.getFullYear();
  var mm = String(date.getMonth() + 1).padStart(2, '0');
  var dd = String(date.getDate()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd;
}

function getAnalyticsData(startDate, endDate) {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var expensesSheet = doc.getSheetByName('Expenses');
  var incomeSheet = doc.getSheetByName('Income');
  var categorySheet = doc.getSheetByName('Category');
  var subCategorySheet = doc.getSheetByName('SubCategory');

  var expensesData = expensesSheet ? expensesSheet.getDataRange().getValues() : [];
  var incomeData = incomeSheet ? incomeSheet.getDataRange().getValues() : [];
  var categoryData = categorySheet ? categorySheet.getDataRange().getValues() : [];
  var subCategoryData = subCategorySheet ? subCategorySheet.getDataRange().getValues() : [];

  // Get headers
  var expenseHeaders = expensesData.length > 0 ? expensesData[0] : [];
  var incomeHeaders = incomeData.length > 0 ? incomeData[0] : [];
  var categoryHeaders = categoryData.length > 0 ? categoryData[0] : [];
  var subCategoryHeaders = subCategoryData.length > 0 ? subCategoryData[0] : [];

  // Helper to get column index
  function idx(headers, name) {
    return headers.indexOf(name);
  }

  // Parse dates
  var startDateObj = startDate ? new Date(startDate) : null;
  var endDateObj = endDate ? new Date(endDate) : null;

  // Filter function
  function isInDateRange(dateStr) {
    if (!startDateObj && !endDateObj) return true;
    var date = new Date(dateStr);
    if (startDateObj && date < startDateObj) return false;
    if (endDateObj && date > endDateObj) return false;
    return true;
  }

  // Process expenses
  var categoryBreakdown = {};
  var monthlyTrends = {};
  var filteredExpenses = [];
  var totalExpense = 0;
  var totalIncome = 0;
  var largestTransaction = 0;
  var transactionCount = 0;

  // Process expenses
  for (var i = 1; i < expensesData.length; i++) {
    var row = expensesData[i];
    var amount = parseFloat(row[idx(expenseHeaders, 'Amount')] || 0);
    var date = row[idx(expenseHeaders, 'PaymentDate')];
    var subCategoryId = row[idx(expenseHeaders, 'SubCategoryTypeId')];
    var description = row[idx(expenseHeaders, 'Description')] || '';

    if (isInDateRange(date)) {
      totalExpense += amount;
      transactionCount++;
      largestTransaction = Math.max(largestTransaction, amount);

      // Category breakdown
      var subCategory = subCategoryData.find(function(sc, index) {
        return index > 0 && sc[idx(subCategoryHeaders, 'Value')] == subCategoryId;
      });
      
      if (subCategory) {
        var categoryName = subCategory[idx(subCategoryHeaders, 'Text')];
        if (!categoryBreakdown[categoryName]) {
          categoryBreakdown[categoryName] = 0;
        }
        categoryBreakdown[categoryName] += amount;
      }

      // Monthly trends
      var dateObj = new Date(date);
      var monthKey = dateObj.getFullYear() + '-' + String(dateObj.getMonth() + 1).padStart(2, '0');
      if (!monthlyTrends[monthKey]) {
        monthlyTrends[monthKey] = 0;
      }
      monthlyTrends[monthKey] += amount;

      // Add to filtered expenses
      filteredExpenses.push({
        date: formatDateForDashboard(dateObj),
        description: description,
        type: 'Expense',
        category: subCategory ? subCategory[idx(subCategoryHeaders, 'Text')] : 'Unknown',
        amount: -amount
      });
    }
  }

  // Process income
  for (var i = 1; i < incomeData.length; i++) {
    var row = incomeData[i];
    var amount = parseFloat(row[idx(incomeHeaders, 'Amount')] || 0);
    var date = row[idx(incomeHeaders, 'Date')];
    var source = row[idx(incomeHeaders, 'IncomeSource')] || '';
    var description = row[idx(incomeHeaders, 'Description')] || '';

    if (isInDateRange(date)) {
      totalIncome += amount;
      transactionCount++;
      largestTransaction = Math.max(largestTransaction, amount);

      // Add to filtered expenses (for display)
      filteredExpenses.push({
        date: formatDateForDashboard(new Date(date)),
        description: description,
        type: 'Income',
        category: source,
        amount: amount
      });
    }
  }

  // Sort transactions by date descending
  filteredExpenses.sort(function(a, b) {
    return new Date(b.date) - new Date(a.date);
  });

  // Convert category breakdown to array format for charts
  var categoryChartData = [];
  for (var category in categoryBreakdown) {
    categoryChartData.push({
      category: category,
      amount: categoryBreakdown[category]
    });
  }
  categoryChartData.sort(function(a, b) {
    return b.amount - a.amount;
  });

  // Convert monthly trends to array format for charts
  var monthlyChartData = [];
  for (var month in monthlyTrends) {
    monthlyChartData.push({
      month: month,
      amount: monthlyTrends[month]
    });
  }
  monthlyChartData.sort(function(a, b) {
    return a.month.localeCompare(b.month);
  });

  // Calculate average daily spending
  var avgDailySpending = 0;
  if (startDateObj && endDateObj) {
    var daysDiff = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) + 1;
    avgDailySpending = totalExpense / daysDiff;
  }

  return {
    categoryBreakdown: categoryChartData,
    monthlyTrends: monthlyChartData,
    filteredTransactions: filteredExpenses.slice(0, 20), // Top 20 transactions
    totalExpense: totalExpense,
    totalIncome: totalIncome,
    largestTransaction: largestTransaction,
    transactionCount: transactionCount,
    avgDailySpending: avgDailySpending,
    topCategories: categoryChartData.slice(0, 5) // Top 5 categories
  };
}

function updateAccountBalanceForIncome(accountId, incomeAmount) {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var balanceSheet = doc.getSheetByName('Balance');
  var paymentSubTypeSheet = doc.getSheetByName('PaymentSubtype');
  
  // Get account type information
  var paymentSubTypeData = paymentSubTypeSheet.getDataRange().getValues();
  var accountType = null;
  
  // Find the account type (bank account vs credit card)
  for (var i = 1; i < paymentSubTypeData.length; i++) {
    if (paymentSubTypeData[i][0] == accountId) { // Assuming Value is in first column
      accountType = paymentSubTypeData[i][1]; // Assuming PaymentType is in second column
      break;
    }
  }
  
  // Only update bank accounts (not credit cards)
  if (accountType == 3) { // Credit card
    return; // Don't update credit card balances for income
  }
  
  // Find existing balance row
  var existingRow = findBalanceRow(accountId);
  
  if (existingRow) {
    // Update existing balance
    var currentBalance = parseFloat(balanceSheet.getRange(existingRow, 2).getValue() || 0);
    
    // For bank accounts: increase the balance
    var newBalance = currentBalance + parseFloat(incomeAmount);
    balanceSheet.getRange(existingRow, 2).setValue(newBalance);
    
    // Update last updated date
    balanceSheet.getRange(existingRow, 4).setValue(getCurrentDate());
  } else {
    // Create new balance entry if it doesn't exist
    var newBalance = parseFloat(incomeAmount);
    var creditLimit = 0;
    
    var newRow = [
      accountId,
      newBalance,
      creditLimit,
      getCurrentDate()
    ];
    balanceSheet.appendRow(newRow);
  }
}




