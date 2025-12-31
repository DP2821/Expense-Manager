
export async function parsePaytmExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function (e) {
            try {
                const data = new Uint8Array(e.target.result);
                // Ensure XLSX is available
                if (typeof XLSX === 'undefined') {
                    throw new Error("SheetJS (XLSX) library is not loaded.");
                }

                const workbook = XLSX.read(data, { type: 'array' });

                // Target specific sheet
                const sheetName = "Passbook Payment History";
                if (!workbook.Sheets[sheetName]) {
                    throw new Error(`Sheet "${sheetName}" not found in the Excel file.`);
                }

                const worksheet = workbook.Sheets[sheetName];

                // Convert to JSON with raw values to handle dates better if possible, 
                // but usually raw=false is safer for simple text. 
                // Let's use header:0 to get array of objects.
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

                const transactions = extractTransactionsFromExcel(jsonData);
                resolve(transactions);

            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = function (error) {
            reject(error);
        };

        reader.readAsArrayBuffer(file);
    });
}

function extractTransactionsFromExcel(data) {
    const transactions = [];

    data.forEach(row => {
        // Expected Columns based on user image:
        // Date, Time, Transaction Details, Other Transaction Details, Your Account, Amount, UPI Ref No., Order ID, Remarks, Tags, Comment

        // 1. Parse Date
        let dateStr = row["Date"]; // e.g. "27/12/2025"
        let parsedType = "Expense";
        let parsedAmount = 0;
        let parsedDesc = "";
        let paymentMethod = "";

        // Skip if essential data is missing
        if (!dateStr || !row["Amount"]) return;

        // Normalize Date to YYYY-MM-DD
        // Assuming DD/MM/YYYY format from the image
        const dateParts = dateStr.split('/');
        if (dateParts.length === 3) {
            // DD/MM/YYYY -> YYYY-MM-DD
            dateStr = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
        }

        // 2. Parse Amount & Type
        // Amount string might be "-260.00" or "+50,000.00" or just numbers
        // Remove commas first
        let amountRaw = row["Amount"].toString().replace(/,/g, '');
        parsedAmount = parseFloat(amountRaw);

        if (isNaN(parsedAmount)) {
            return; // Skip invalid amounts
        }

        if (parsedAmount > 0) {
            parsedType = "Income";
        } else {
            parsedType = "Expense";
            parsedAmount = Math.abs(parsedAmount); // Store absolute value for the system
        }

        // 3. Determine Description (Prioritize Remarks)
        const remarks = row["Remarks"] ? row["Remarks"].trim() : "";
        const txDetails = row["Transaction Details"] ? row["Transaction Details"].trim() : "";

        // Logic: Remarks > Transaction Details
        if (remarks && remarks.length > 0) {
            parsedDesc = remarks;
        } else {
            parsedDesc = txDetails || "Transaction";
        }

        // 4. Payment Method Context (UPI Ref, etc)
        // We can store this to help with matching or just ignore it. 
        // Let's try to extract something if possible, but the user image shows standard UPI refs.
        // We might not map this directly to "Payment Method" in our system unless it matches a known bank.
        // But the system will try to auto-map based on description anyway.
        // Let's store UPI Ref as paymentMethod for potential matching if needed, or just leave blank.
        if (row["UPI Ref No."]) {
            paymentMethod = "UPI: " + row["UPI Ref No."];
        }

        transactions.push({
            date: dateStr,
            amount: parsedAmount,
            description: parsedDesc,
            type: parsedType,
            paymentMethod: paymentMethod,
            originalString: JSON.stringify(row),
            // We pass both for the specific logic requested
            remarks: remarks,
            txDetails: txDetails,
            accountName: row["Your Account"] || ""
        });
    });

    return transactions;
}
