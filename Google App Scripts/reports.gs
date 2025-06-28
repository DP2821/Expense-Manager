function myFunction() {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var expensesSheet = doc.getSheetByName('Expenses');
  
  var data = expensesSheet.getDataRange().getValues();
  var headers = data[0];
  
  // Find the column index for 'PaymentDate' and 'Amount'
  var paymentDateIndex = headers.indexOf('PaymentDate');
  var amountIndex = headers.indexOf('Amount');
  
  // Create a new sheet for the monthly summary
  var summarySheet = doc.getSheetByName('MonthlyExpenseSummary');
  if (summarySheet) {
    doc.deleteSheet(summarySheet);
  }
  summarySheet = doc.insertSheet('MonthlyExpenseSummary');
  
  summarySheet.getRange(1, 1).setValue('Month');
  summarySheet.getRange(1, 2).setValue('Total Expenses');
  
  var monthlyData = {};
  
  for (var i = 1; i < data.length; i++) {
    var date = new Date(data[i][paymentDateIndex]);
    var month = Utilities.formatDate(date, Session.getScriptTimeZone(), 'MMMM yyyy');
    var amount = data[i][amountIndex];
    
    if (!monthlyData[month]) {
      monthlyData[month] = 0;
    }
    
    monthlyData[month] += amount;
  }
  
  var row = 2;
  for (var key in monthlyData) {
    summarySheet.getRange(row, 1).setValue(key);
    summarySheet.getRange(row, 2).setValue(monthlyData[key]);
    row++;
  }
}