
export async function parsePhonePeStatement(file) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();

        fileReader.onload = async function () {
            try {
                const typedarray = new Uint8Array(this.result);
                // Ensure pdfjsLib is available
                if (typeof pdfjsLib === 'undefined') {
                    throw new Error("PDF.js library is not loaded.");
                }
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                let fullText = [];

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str);
                    fullText = fullText.concat(pageText);
                }

                const transactions = extractTransactions(fullText);
                resolve(transactions);
            } catch (error) {
                reject(error);
            }
        };

        fileReader.readAsArrayBuffer(file);
    });
}

function extractTransactions(textItems) {
    const transactions = [];

    // Regex Definitions
    const dateRegex = /^[A-Z][a-z]{2}\s\d{1,2},\s\d{4}$/; // "Dec 08, 2025"
    const timeRegex = /^\d{1,2}:\d{2}\s[ap]m$/i; // "02:44 pm" or "09:45 am"
    // Strict amount: Must have ₹ OR have decimal point. 
    // Avoids purely integer years/numbers like "2025" or "24" appearing in desc.
    const amountRegex = /^(₹\s?[\d,]+(\.\d*)?|[\d,]+\.\d{2})$/;
    const typeRegex = /^(CREDIT|DEBIT)$/i;
    // Account pattern: usually XXXXXX1234
    const accountRegex = /XXXXXX\d{4}/i;

    // Prefixes
    const methodPrefixes = ["Paid by", "Credited to", "Debited from"];
    const descPrefixes = ["Paid to", "Received from", "Transfer to"];

    let i = 0;
    while (i < textItems.length) {
        let item = textItems[i].trim();
        if (dateRegex.test(item)) {
            let tx = {
                date: item,
                amount: null,
                description: "",
                type: "Expense", // Default
                paymentMethod: "",
                originalString: item
            };

            let descParts = [];
            let j = i + 1;
            let isCurrencySymbol = false;

            while (j < textItems.length && j < i + 30) {
                let sub = textItems[j].trim();

                // Break on next transaction
                if (dateRegex.test(sub)) break;

                // Handle split currency symbol
                if (sub === '₹') {
                    isCurrencySymbol = true;
                    j++;
                    continue;
                }

                let isAmount = false;
                if (isCurrencySymbol) {
                    if (/^[\d,]+(\.\d*)?$/.test(sub)) {
                        tx.amount = parseAmount(sub);
                        isAmount = true;
                    }
                    isCurrencySymbol = false;
                } else if (!tx.amount && amountRegex.test(sub)) {
                    tx.amount = parseAmount(sub);
                    isAmount = true;
                }

                if (isAmount) {
                    j++;
                    continue;
                }

                let subUpper = sub.toUpperCase();
                let subLower = sub.toLowerCase();

                // Skip technical fields
                if (timeRegex.test(sub) ||
                    sub.startsWith("Transaction ID") ||
                    sub.startsWith("UTR No.") ||
                    subUpper === "SUCCESS" ||
                    subUpper === "FAILED" ||
                    subUpper === "PROCESSED") {
                    j++;
                    continue;
                }

                if (typeRegex.test(sub)) {
                    tx.type = subUpper === "CREDIT" ? "Income" : "Expense";
                    j++;
                    continue;
                }

                let isMethodLine = false;

                // 1. Check for explicit Payment Method prefixes
                for (let prefix of methodPrefixes) {
                    if (subLower.includes(prefix.toLowerCase())) {
                        isMethodLine = true;
                        let val = sub.replace(new RegExp(prefix, "gi"), "").trim();
                        // Handle split line
                        if (val.length < 2 && j + 1 < textItems.length) {
                            let nextSub = textItems[j + 1].trim();
                            if (!dateRegex.test(nextSub) && !amountRegex.test(nextSub)) {
                                val = nextSub;
                                j++; // Consume next
                            }
                        }
                        if (val && !tx.paymentMethod) tx.paymentMethod = val;
                        break;
                    }
                }

                // 2. Check for explicit Payment keywords (UPI Lite, Rupay)
                if (!isMethodLine && (subLower.includes("upi lite") || subLower.includes("rupay"))) {
                    // Check if this is a description line (e.g. "Received from UPI Lite User") - unlikely but possible
                    // Assuming "UPI Lite" or "Rupay" usually indicates the method
                    if (!tx.paymentMethod) tx.paymentMethod = sub;
                    isMethodLine = true;
                }

                // 3. Check for Account Number (e.g. XXXXXX1234)
                if (!isMethodLine && accountRegex.test(sub)) {
                    // CRITICAL: Ensure this is NOT a description line (e.g. "Transfer to XXXXXX1234")
                    let isDesc = false;
                    for (let dp of descPrefixes) {
                        if (subLower.includes(dp.toLowerCase())) isDesc = true;
                    }

                    if (!isDesc) {
                        if (!tx.paymentMethod) tx.paymentMethod = sub;
                        isMethodLine = true;
                    }
                    // If it IS a description, isMethodLine remains false, so it drops to description logic below
                }

                if (isMethodLine) {
                    j++;
                    continue;
                }

                // Description Logic
                // Remove prefixes like "Paid to", "Received from"
                let cleanedSub = sub;
                for (let prefix of descPrefixes) {
                    if (subLower.includes(prefix.toLowerCase())) {
                        cleanedSub = sub.replace(new RegExp(prefix, "gi"), "").trim();
                    }
                }

                // Filter out noise
                // Only add if it's not a known payment keyword (unless it wasn't captured as payment method)
                if (!cleanedSub.toLowerCase().includes("upi lite") &&
                    !cleanedSub.toLowerCase().includes("rupay") &&
                    !cleanedSub.includes("Wallet") &&
                    cleanedSub.length > 0) {
                    descParts.push(cleanedSub);
                }

                j++;
            }

            tx.description = descParts.join(" ").trim() || "Transaction";

            if (tx.amount !== null) {
                transactions.push(tx);
                i = j - 1;
            }
        }
        i++;
    }
    return transactions;
}

function parseAmount(amountStr) {
    // Remove ₹, spaces, commas
    return parseFloat(amountStr.replace(/[₹,\s]/g, ''));
}
