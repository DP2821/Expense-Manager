// Timeline Feature Script
import {
    getExpenses,
    getIncome,
    getBorrowLent,
    getBalance,
    getAllDropdownData
} from './firestore-service.js';
import { getUserId } from './auth-helper.js';
import { auth } from './firebase-config.js';

let allTransactions = [];
let balances = [];
let dropdownData = null;
let liquidCashOpen = 0;

$(document).ready(function () {
    // Set default date to today
    document.getElementById('startDate').value = getCurrentDate();

    // Initialize
    initializeTimeline();

    // Event Listeners
    $('#refreshBtn').click(fetchAndRenderTimeline);
});

async function initializeTimeline() {
    showLoader();
    loadUserProfile();

    try {
        // Fetch all necessary data
        const [
            expensesRes,
            incomeRes,
            borrowLentRes,
            balanceRes,
            ddData
        ] = await Promise.all([
            getExpenses(),
            getIncome(),
            getBorrowLent(),
            getBalance(),
            getAllDropdownData()
        ]);

        dropdownData = ddData;
        balances = balanceRes;

        // Process Transactions
        const expenseTxs = expensesRes.map(e => ({
            ...e,
            date: e.paymentDate,
            type: 'Expense',
            amount: -Math.abs(e.amount) // Store expenses as negative for easy sum
        }));

        const incomeTxs = incomeRes.map(i => ({
            ...i,
            date: i.date,
            type: 'Income',
            amount: Math.abs(i.amount)
        }));

        const borrowLentTxs = borrowLentRes.map(bl => {
            // Borrow = Cash In (+)
            // Lent = Cash Out (-)
            const amount = bl.type === 'Borrow' ? Math.abs(bl.amount) : -Math.abs(bl.amount);
            return {
                ...bl,
                date: bl.date,
                type: bl.type, // 'Borrow' or 'Lent'
                amount: amount,
                // Ensure status and dueDate are preserved
                status: bl.status,
                dueDate: bl.dueDate,
                person: bl.person
            };
        });

        // Combine base transactions
        allTransactions = [...expenseTxs, ...incomeTxs, ...borrowLentTxs];

        // Fetch Bill Due Days (will be in dropdownData.PaymentSubType if we save it there) - Logic to be refined
        // For now, we assume user adds bills via future expenses? 
        // User requested: "Manage Credit Card Bill... take Billing Date from user"
        // I will add the projection logic in fetchAndRenderTimeline

        fetchAndRenderTimeline();

    } catch (error) {
        console.error("Error initializing timeline:", error);
        toastr.error("Failed to load data.");
    } finally {
        hideLoader();
    }
}

async function fetchAndRenderTimeline() {
    const startDate = document.getElementById('startDate').value;
    const includeCC = document.getElementById('includeCreditCards').checked;

    const timelineBody = $('#timelineBody');
    timelineBody.empty();

    if (!allTransactions || allTransactions.length === 0) {
        timelineBody.html('<tr><td colspan="5" class="text-center">No transactions found.</td></tr>');
        return;
    }

    // 1. Calculate Initial "Liquid Cash" (Bank Accounts + Cash)
    // We ignore Credit Card 'balances' (which are debt) for the liquid cash calculation, 
    // BUT we must subtract the *current* CC Debt if we are treating "Net Worth" as balance?
    // User asked for "Running Balance". Usually means "Cash in Hand/Bank".
    // So we sum up positive balances from Bank Accounts.

    let currentLiquidCash = 0;

    balances.forEach(b => {
        const account = dropdownData.PaymentSubType.find(a => a.Value == b.accountId);
        if (account) {
            const isCreditCard = account.PaymentType == 3;
            if (!isCreditCard) {
                currentLiquidCash += b.balance;
            }
        }
    });

    // 2. Add Projected CC Bills if enabled
    let displayTransactions = [...allTransactions];

    if (includeCC) {
        balances.forEach(b => {
            const account = dropdownData.PaymentSubType.find(a => a.Value == b.accountId);
            if (account && account.PaymentType == 3 && b.balance > 0) {
                // Check if account has a billDueDay
                if (account.billDueDay) {
                    const dueDay = parseInt(account.billDueDay);
                    let dueDate = new Date();

                    // If today > dueDay, move to next month
                    if (dueDate.getDate() > dueDay) {
                        dueDate.setMonth(dueDate.getMonth() + 1);
                    }
                    dueDate.setDate(dueDay);

                    const dueDateStr = formatDate(dueDate);

                    displayTransactions.push({
                        date: dueDateStr,
                        description: `Type: Credit Card Bill - ${account.Text}`,
                        type: 'CC Bill',
                        amount: -b.balance, // Outflow
                        isProjected: true
                    });
                }
            }
        });
    }

    // 3. Sort all by Date
    displayTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // 4. Calculate Opening Balance relative to Start Date
    // We start with CURRENT Liquid Cash.
    // BUT, the 'currentLiquidCash' includes effects of ALL past transactions?
    // Actually, 'balances' from Firestore are the current snapshot.
    // So if we walk the timeline from Today into Future, we just start with currentLiquidCash.
    // IF we want to show Past transactions in the timeline, we have to "Reverse" the math?
    // Simpler approach:
    // "Timeline" usually implies "Future Projection".

    // Let's filter for transactions Date >= StartDate (defaults to Today).
    // If StartDate is in the past, calculating the "Opening Balance" for that past date is hard 
    // without replaying full history.

    // Compromise: 
    // We Assume "Opening Balance" = Current Liquid Cash.
    // We only show transactions from TODAY onwards.
    // If user selects past date, we warn or just show them but the running balance might be off unless we do the reverse math.

    // Let's implement the "Forward from Today" logic as primary. 
    // If date < today, we don't account for it in "Current -> Future" changes, 
    // because its effect is already in the Current Balance.

    // However, if the user added "Future Expenses" (e.g. next month rent) previously, 
    // those ARE in 'allTransactions'.
    // We need to differentiate "Realized" vs "Unrealized" or just rely on Date.

    // Strategy:
    // Start Balance = Current Liquid Cash.
    // Filter transactions where Date >= T (today or startDate?). 
    // Actually, if a transaction is in the future, it likely hasn't happened yet (Real world).
    // But in the App, if I marked it "Update Balance = True", then the Firestore Balance ALREADY includes it.
    // This is the tricky part. 'addExpense' updates balance immediately.

    // Problem: User adds Rent for Next Month (Update Balance = True). 
    // Current Balance in DB is LOW.
    // Timeline shows Rent transaction next month.
    // If we subtract Rent AGAIN, we double dip.

    // Fix:
    // If `Update Balance` is used, the system is designed for "Cash Accounting" (happened now).
    // For "Planning", user should typically add transactions with Update Balance = False?
    // OR, we assume Future Dated transactions with Update Balance = True are ALREADY reflected in the 'current' balance shown on dashboard.
    // That means the dashboard showing 'Current Balance' is actually 'Projected Balance at end of recorded transactions'.

    // User Requirement: "In the Sheet I Manage my balance in timeline so that I can get an idea when I'm going below targeted amount".

    // Interpretation:
    // The "Current Balance" shown in Dashboard is the True Current Balance.
    // Future transactions should NOT be in the DB yet, OR they are there but we need to know they are future.
    // If the user enters a future date in `addExpense` and checks `Update Balance`, the code updates the balance *now*. 
    // This implies the user treats it as "Paid".

    // To support "Planning" without affecting "Current Balance":
    // 1. User should uncheck "Update Balance".
    // 2. OR, our timeline logic needs to detect "Future dates" that affected balance.

    // Let's assume for this feature:
    // We take the "Current Liquid Cash" (from DB).
    // We loop through All Transactions.
    // If a transaction is in the Future (> Today):
    //    We check if it likely affected the balance. (We don't know for sure without a flag, but usually yes).
    //    IF it affected the balance, then the "Current Balance" is already reduced.
    //    To show the "Trend", we conceptually want to start from "Now" and clear future effects?
    //    OR, simpler: The user adds Future items *without* updating balance?

    // Let's stick to the simplest mental model:
    // Running Balance = Start Balance + Cumulative Delta.
    // If I filter for Transactions >= Start Date.

    // Refined Algorithm:
    // 1. Start Balance = Current Liquid Cash (from Firestore).
    // 2. We want to show the path from "Now" to "Future".
    // 3. Transactions in the future that *already* changed the balance should effectively be "undone" to find the "True Now"? 
    //    No, that's messy.

    // Alternative:
    // The Balance in Firestore is "Balance as of Last Transaction".
    // So, if I have entered transactions up to Dec 31st, the 'Current Balance' is the value on Dec 31st.
    // The timeline should just list the transactions in order, and the "Running Balance" at the bottom of the list should match the Firestore Balance.
    // "Running Balance" at row X = Running Balance at row (X-1) + Amount.
    // We work BACKWARDS? Or start from known initial?
    // No, we don't know initial. We know Final (Current DB State).

    // CORRECT APPROACH given the data model:
    // The "Current Balance" in Firestore is effectively the "End State" of all entered transactions.
    // We have a list of sorted transactions (Past -> Future).
    // We can calculate the Running Balance for every row by:
    //    Final Balance = Firestore Balance.
    //    Walk Backwards from last transaction to first.
    //    RB(i) = RB(i+1) - Amount(i+1). 

    // Let's try Walk Backwards.
    // 1. Get Final Liquid Balance (Sum of Bank Accounts).
    // 2. Sort transactions Ascending.
    // 3. Set RB of last transaction = Final Balance.
    // 4. RB(i-1) = RB(i) - Amount(i).  (Wait, Expense is negative. so RB(i) = RB(i-1) + Amount. => RB(i-1) = RB(i) - Amount.)
    //    Example: 
    //    Start: 100.
    //    Tx1: -10. (RB=90)
    //    Tx2: -20. (RB=70).
    //    Final = 70.
    //    Backwards:
    //    Tx2 (Rb=70). Prev = 70 - (-20) = 90.
    //    Tx1 (Rb=90). Prev = 90 - (-10) = 100.
    // This works perfectly for "Bank Accounts" transactions.

    // Complexity: "Projected CC Bills".
    // These are NOT in the Firestore Balance. They are hypothetical.
    // So we should ADD them to the transaction list.
    // But they offset the 'Final Balance' calculation?
    // If I project a bill next week, it REDUCES my projected balance.
    // So my "Final Balance" (Projected) = Firestore Balance + Sum(Projected Items).
    // Wait, Projected Items are Future. 
    // Firestore Balance does NOT include them.
    // So, "Projected Final Balance" = Current Firestore Balance + Sum(Projected Future items).
    // Then we walk backwards from *that*?

    // Actually, Walking Forwards is easier if we can find a "Start Point".
    // But "Start Point" is hard.
    // Walking Backwards from "Projected End State" seems robust.

    // Let's try:
    // 1. Calc "Current Real Balance" (CRB) = Sum of Bank Accounts.
    // 2. Identify "Recorded Transactions" (in DB) vs "Projected Transactions" (CC Bills not in DB).
    // 3. Sort ALL by date.
    // 4. We need to anchor the RB curve.
    //    The "CRB" corresponds to the state *after* all Restricted Transactions (those with updateBalance=true).
    //    Let's assumes ALL DB transactions updated balance (safe assumption for this app).
    //    So CRB is the balance *after* the last DB transaction.

    //    If we have Projected transactions after the last DB transaction:
    //       Propagate balance forward.
    //    If we have Projected transactions *mixed in* (e.g. Bill due tomorrow, but I entered a Salary for next week):
    //       This gets tricky.

    // Let's simplify:
    // We can determine the Running Balance for *each* transaction row.
    // If we assume the list of transactions covers *everything* that changed the balance...
    // We can walk backwards from the CRB using only the DB transactions.
    // This gives us the RB for every DB transaction.
    // Then, for Projected transactions, we can adjust the stream?

    // BETTER APPROACH:
    // 1. Get List of DB Transactions. Sort by Date.
    // 2. Walk Backwards from CRB to determine the "Balance After" for each DB transaction.
    //    (and also determine the "Balance Before" the first transaction).
    //    Store this "Balance After" in the transaction object.

    // 3. Now insert Projected Transactions into the list (sorted by date).
    // 4. Iterate Forward through the merged list.
    //    Start with the "Balance Before First Transaction" (calculated in step 2).
    //    Update RB cumulatively.

    // Let's Refine Step 2 (Backwards Walk):
    // Transactions: T1, T2, T3 ... Tn.
    // Balance After Tn = CRB.
    // Balance After Tn-1 = CRB - Amount(Tn).
    // ...
    // Balance Before T1 = Balance After T1 - Amount(T1).

    // Step 3 (Merge):
    // Merged List: T1, P1, T2, P2 ...
    // Px are Projected CC bills.

    // Step 4 (Forward Walk):
    // CurrentRB = Balance Before T1.
    // For each Item (T or P):
    //    CurrentRB += Amount.
    //    Item.RunningBalance = CurrentRB.

    // This seems solid.

    // FILTERING:
    // The user wants to filter by Start Date.
    // We still need to do the full calculation to get the correct starting balance for the filtered view.
    // So: Calc ALL, then slice the array for display.

    // Implementation Details:
    // - Need to ensure we correctly identify "Liquid" accounts (PaymentType != 3).
    // - Need to correctly handle Borrow/Lent sign.

    // Let's code this.

    const filteredTransactions = displayTransactions.filter(t => new Date(t.date) >= new Date(startDate));

    // 1. Calculate CRB and Breakdown
    let crb = 0;
    let crbBreakdown = [];

    balances.forEach(b => {
        const account = dropdownData.PaymentSubType.find(a => a.Value == b.accountId);
        if (account && account.PaymentType != 3) {
            const val = b.balance;
            crb += val;
            crbBreakdown.push(`${account.Text}: ${val.toLocaleString()}`);
        }
    });
    const breakdownText = crbBreakdown.join(', ');

    // 2. Separate DB vs Projected
    // Actually, 'allTransactions' are the DB ones.
    // 'displayTransactions' currently has everything (mixed). We should separate first.

    // Let's re-build displayTransactions properly
    let dbTransactions = [...allTransactions];
    dbTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // 3. Walk Backwards on DB Transactions to establish base line
    // We map each DB tx to its "Post-Tx Balance"
    // (Note: This assumes we have ALL history. If we fetch only recent, this breaks.
    // Firestore queries in this app fetch ALL? 
    // 'getExpenses' fetches all? -> yes, 'orderBy paymentDate desc'.
    // BUT we need to reverse it to be ascending for calculation.

    // Wait, if `getExpenses` uses a limit (it doesn't seem to currently), we might miss history.
    // Assuming we have all for now.

    let tempBalance = crb;
    // Walk list from END (Latest) to START (Earliest)
    for (let i = dbTransactions.length - 1; i >= 0; i--) {
        const tx = dbTransactions[i];

        // The tempBalance is the state *after* this tx.
        // We want state *before* this tx for the next iteration.
        // PostBalance = PreBalance + Amount
        // PreBalance = PostBalance - Amount

        tx.postBalance = tempBalance; // Balance after this transaction
        tempBalance = tempBalance - tx.amount;
        tx.preBalance = tempBalance;  // Balance before this transaction
    }

    const balanceAtStartOfTime = tempBalance; // Theoretical balance before any recorded transaction

    // 4. Merge Projected CC Bills
    let projectTxs = [];
    if (includeCC) {
        balances.forEach(b => {
            const account = dropdownData.PaymentSubType.find(a => a.Value == b.accountId);
            // Logic repeated from above
            if (account && account.PaymentType == 3 && b.balance > 0 && account.billDueDay) {
                const dueDay = parseInt(account.billDueDay);
                let dueDate = new Date();
                if (dueDate.getDate() > dueDay) dueDate.setMonth(dueDate.getMonth() + 1);
                dueDate.setDate(dueDay);
                projectTxs.push({
                    date: formatDate(dueDate),
                    description: `Credit Card Bill - ${account.Text}`,
                    type: 'CC Bill',
                    amount: -b.balance,
                    isProjected: true
                });
            }
        });
    }

    // 4b. Merge Projected Borrow/Lent Repayments
    let repaymentTxs = [];
    allTransactions.forEach(tx => {
        if ((tx.type === 'Borrow' || tx.type === 'Lent') && tx.status === 'Open' && tx.dueDate) {
            // Reversal of the original amount
            // Borrow (positive) -> Repay (negative)
            // Lent (negative) -> Receive (positive)
            // So just negate the transaction amount
            const reversalAmount = -tx.amount;

            // Check if due date is valid to avoid errors
            if (new Date(tx.dueDate).toString() !== 'Invalid Date') {
                repaymentTxs.push({
                    date: tx.dueDate,
                    description: `Repayment: ${tx.person} (${tx.type})`,
                    type: 'Repayment',
                    amount: reversalAmount,
                    isProjected: true
                });
            }
        }
    });

    let finalTimeline = [...dbTransactions, ...projectTxs, ...repaymentTxs];
    finalTimeline.sort((a, b) => new Date(a.date) - new Date(b.date));

    // 5. Walk Forward to calc Running Balance containing Projections
    let runningBalance = balanceAtStartOfTime;

    finalTimeline.forEach(tx => {
        runningBalance += tx.amount;
        tx.runningBalance = runningBalance;
    });

    // 6. Filter and Render
    const viewData = finalTimeline.filter(t => new Date(t.date) >= new Date(startDate));

    // Set Opening Balance Badge & Add Row
    let openBal = 0;

    if (viewData.length > 0) {
        const first = viewData[0];
        // runningBalance = Balance AFTER tx.
        // So Balance BEFORE tx = runningBalance - Amount.
        openBal = first.runningBalance - first.amount;

        // Calculate adjustment logic for tooltip
        const diff = openBal - crb;
        let finalTooltip = breakdownText;

        // Detailed Breakdown of Adjustment
        let adjustmentDetails = "";

        // 1. Real DB Transactions occurring ON/AFTER Start Date (Reversed)
        const futureRealTxs = dbTransactions.filter(t => new Date(t.date) >= new Date(startDate));
        futureRealTxs.forEach(tx => {
            // Reversing: If Expense (-), we add back (+). If Income (+), we subtract (-).
            const revAmt = -tx.amount;
            const sign = revAmt > 0 ? '+' : '';
            adjustmentDetails += `\n[Rev] ${tx.description}: ${sign}₹ ${revAmt.toLocaleString()}`;
        });

        // 2. Projected Transactions occurring BEFORE Start Date (Phantom included in Opening)
        const pastProjectedTxs = [...projectTxs, ...repaymentTxs].filter(t => new Date(t.date) < new Date(startDate));
        pastProjectedTxs.forEach(tx => {
            // These are included in Opening but not in CRB (Real). So we just show them as is.
            const sign = tx.amount > 0 ? '+' : '';
            adjustmentDetails += `\n[Proj] ${tx.description}: ${sign}₹ ${tx.amount.toLocaleString()}`;
        });

        if (Math.abs(diff) > 0.01 || adjustmentDetails !== "") {
            const sign = diff > 0 ? '+' : '';
            finalTooltip += `\n\n=== Current Liquid Total: ₹ ${crb.toLocaleString()} ===`;
            if (adjustmentDetails) {
                finalTooltip += `\n\nAdjustments (to reach Opening):${adjustmentDetails}`;
            }
            finalTooltip += `\n\n----------------\nCalculated Opening: ₹ ${openBal.toLocaleString()}`;
        }

        $('#openingBalanceBadge').text(`Opening: ₹ ${openBal.toLocaleString()}`);

        // Add explicit "Opening Balance" row
        viewData.unshift({
            date: startDate,
            description: "Opening Balance",
            breakdown: finalTooltip,
            type: "Balance",
            amount: 0,
            runningBalance: openBal,
            isOpening: true
        });

    } else {
        // Fallback
        $('#openingBalanceBadge').text(`Current Liquid: ₹ ${crb.toLocaleString()}`);

        viewData.unshift({
            date: startDate,
            description: "Opening Balance (Current Liquid)",
            breakdown: breakdownText,
            type: "Balance",
            amount: 0,
            runningBalance: crb,
            isOpening: true
        });
    }

    renderTable(viewData);
}

function renderTable(data) {
    const tbody = $('#timelineBody');
    tbody.empty();

    if (data.length === 0) {
        tbody.html('<tr><td colspan="5" class="text-center">No transactions in range.</td></tr>');
        return;
    }

    data.forEach(tx => {
        let rowClass = '';
        if (tx.isOpening) {
            rowClass = 'table-light fw-bold';
        } else {
            if (tx.runningBalance < 0) rowClass = 'row-alert-danger';
            else if (tx.runningBalance < 10000) rowClass = 'row-alert-warning';
        }

        let typeClass = '';
        if (tx.amount > 0) typeClass = 'text-success';
        if (tx.amount < 0) typeClass = 'text-danger';

        // Enhance Description for Borrow/Lent
        let desc = tx.description;
        if (tx.isOpening && tx.breakdown) {
            desc = `${desc} <i class="material-icons text-muted" style="font-size: 14px; cursor: pointer;" title="${tx.breakdown}">info</i>`;
        }
        if (tx.type === 'Borrow' || tx.type === 'Lent') {
            desc = `${tx.person} (${tx.description})`;
        }
        if (tx.isProjected) {
            desc = `<em>${desc}</em> <span class="badge bg-secondary">Projected</span>`;
        }

        const html = `
            <tr class="${rowClass}">
                <td>${tx.date}</td>
                <td>${desc}</td>
                <td>${tx.type}</td>
                <td class="text-end ${typeClass}">${Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td class="text-end fw-bold">₹ ${Number(tx.runningBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
        `;
        tbody.append(html);
    });
}


function getCurrentDate() {
    const today = new Date();
    return formatDate(today);
}

function formatDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function showLoader() { $("#globalLoader").fadeIn(); }
function hideLoader() { $("#globalLoader").fadeOut(); }

function loadUserProfile() {
    // copy from other files or use shared auth-helper if enhanced
    const existingUserInfo = document.querySelector('.user-info');
    if (existingUserInfo) existingUserInfo.remove();
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
        });
    });
}
