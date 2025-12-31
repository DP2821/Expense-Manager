// Firestore Data Service
import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getUserId } from "./auth-helper.js";

// Collection names
const COLLECTIONS = {
  EXPENSES: "expenses",
  INCOME: "income",
  BORROW_LENT: "borrowLent",
  BALANCE: "balance",
  CATEGORIES: "categories",
  PAYMENT_TYPES: "paymentTypes",
  PAYMENT_SUB_TYPES: "paymentSubTypes",
  SUB_CATEGORIES: "subCategories",
  INCOME_CATEGORIES: "incomeCategories",
  TRANSACTION_MAPPINGS: "transactionMappings",
};

// Helper function to get user ID
async function getCurrentUserId() {
  const userId = await getUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }
  return userId;
}

// Initialize user data (run once for new users)
export async function initializeUserData() {
  // New user starts with empty data. 
  // Custom categories/types must be added via "Manage Data" page.
  console.log("User data initialization skipped (Clean Start Policy)");
  return;
}

// Get all dropdown data (Excludes soft-deleted items)
export async function getAllDropdownData() {
  const userId = await getCurrentUserId();

  try {
    // Get all data in parallel
    const [
      categories,
      paymentTypes,
      paymentSubTypes,
      subCategories,
      incomeCategories,
    ] = await Promise.all([
      getDocs(
        query(
          collection(db, COLLECTIONS.CATEGORIES),
          where("userId", "==", userId),
          orderBy("id", "asc")
        )
      ),
      getDocs(
        query(
          collection(db, COLLECTIONS.PAYMENT_TYPES),
          where("userId", "==", userId),
          orderBy("id", "asc")
        )
      ),
      getDocs(
        query(
          collection(db, COLLECTIONS.PAYMENT_SUB_TYPES),
          where("userId", "==", userId),
          orderBy("id", "asc")
        )
      ),
      getDocs(
        query(
          collection(db, COLLECTIONS.SUB_CATEGORIES),
          where("userId", "==", userId),
          orderBy("id", "asc")
        )
      ),
      getDocs(
        query(
          collection(db, COLLECTIONS.INCOME_CATEGORIES),
          where("userId", "==", userId),
          orderBy("id", "asc")
        )
      ),
    ]);

    // Convert to the format expected by the frontend and deduplicate
    // Filter out items where isDeleted is true

    const uniqueMap = (docs, keyField = "id") => {
      const seen = new Set();
      return docs.filter(doc => {
        const data = doc.data();
        if (data.isDeleted) return false; // Filter out soft deleted items

        const val = data[keyField];
        if (seen.has(val)) return false;

        seen.add(val);
        return true;
      });
    };

    const result = {
      Category: uniqueMap(categories.docs).map((doc) => ({
        Value: doc.data().id,
        Text: doc.data().name,
      })),
      PaymentType: uniqueMap(paymentTypes.docs).map((doc) => ({
        Value: doc.data().id,
        Text: doc.data().name,
      })),
      PaymentSubType: uniqueMap(paymentSubTypes.docs).map((doc) => ({
        Value: doc.data().id,
        Text: doc.data().name,
        PaymentType: doc.data().paymentTypeId,
        billDueDay: doc.data().billDueDay // Include query field
      })),
      SubCategory: uniqueMap(subCategories.docs).map((doc) => ({
        Value: doc.data().id,
        Text: doc.data().name,
        CategoryId: doc.data().categoryId,
      })),
      IncomeCategory: uniqueMap(incomeCategories.docs).map((doc) => ({
        Value: doc.data().id,
        Text: doc.data().name,
      })),
    };

    return result;
  } catch (error) {
    console.error("Error getting dropdown data:", error);
    throw error;
  }
}

// --- Generic Master Data CRUD (for ManageData page) ---

// Get all master data (Including deleted, for management)
export async function getAllMasterData(collectionName) {
  const userId = await getCurrentUserId();
  try {
    const q = query(
      collection(db, collectionName),
      where("userId", "==", userId),
      orderBy("id", "asc")
      // Note: You might want to order by createdAt or name depending on UI
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`Error getting all data for ${collectionName}:`, error);
    throw error;
  }
}

// Add generic master data
export async function addMasterData(collectionName, data) {
  const userId = await getCurrentUserId();
  try {
    // Find max ID for auto-increment (naive approach, okay for low volume)
    // Ideally use a counter or transaction, but relying on client-side check of existing data is "okay" for single user app
    // Actually, let's just use existing ID logic if passed, or find max. 
    // For safety, let's find the max numeric ID existing in the collection for this user.

    const allDocsSnapshot = await getDocs(query(collection(db, collectionName), where("userId", "==", userId)));
    let maxId = 0;
    allDocsSnapshot.forEach(doc => {
      const d = doc.data();
      if (d.id && typeof d.id === 'number' && d.id > maxId) {
        maxId = d.id;
      }
    });

    const newItem = {
      ...data,
      id: maxId + 1, // Auto-increment ID
      userId,
      createdAt: serverTimestamp(),
      isDeleted: false
    };

    const docRef = await addDoc(collection(db, collectionName), newItem);
    return { id: docRef.id, ...newItem };
  } catch (error) {
    console.error(`Error adding to ${collectionName}:`, error);
    throw error;
  }
}

// Update generic master data
export async function updateMasterData(collectionName, docId, data) {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
    return { id: docId, ...data };
  } catch (error) {
    console.error(`Error updating ${collectionName}:`, error);
    throw error;
  }
}

// Soft delete generic master data
export async function softDeleteMasterData(collectionName, docId) {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      isDeleted: true,
      updatedAt: serverTimestamp()
    });
    return { id: docId, isDeleted: true };
  } catch (error) {
    console.error(`Error soft deleting from ${collectionName}:`, error);
    throw error;
  }
}

// Restore soft deleted data
export async function restoreMasterData(collectionName, docId) {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      isDeleted: false,
      updatedAt: serverTimestamp()
    });
    return { id: docId, isDeleted: false };
  } catch (error) {
    console.error(`Error restoring ${collectionName}:`, error);
    throw error;
  }
}

// --- End Generic CRUD ---

// Add expense
export async function addExpense(expenseData) {
  const userId = await getCurrentUserId();

  try {
    const expense = {
      userId,
      amount: parseFloat(expenseData.amount),
      paymentTypeId: parseInt(expenseData.paymentType),
      paymentSubTypeId: parseInt(expenseData.subPaymentTypeId),
      categoryId: parseInt(expenseData.category),
      subCategoryId: parseInt(expenseData.subCategoryTypeId),
      description: expenseData.description,
      paymentDate: expenseData.paymentDate,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.EXPENSES), expense);

    // Update balance if requested
    if (expenseData.updateBalance === "true") {
      await updateAccountBalance(
        expenseData.subPaymentTypeId,
        expenseData.amount
      );
    }

    return { id: docRef.id, ...expense };
  } catch (error) {
    console.error("Error adding expense:", error);
    throw error;
  }
}

// Add income
export async function addIncome(incomeData) {
  const userId = await getCurrentUserId();

  try {
    const income = {
      userId,
      amount: parseFloat(incomeData.amount),
      description: incomeData.description,
      incomeSourceId: parseInt(incomeData.incomeSource),
      accountId: parseInt(incomeData.accountId),
      date: incomeData.date,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.INCOME), income);

    // Update balance if requested
    if (incomeData.updateBalance === "true" && incomeData.accountId) {
      await updateAccountBalanceForIncome(
        incomeData.accountId,
        incomeData.amount
      );
    }

    return { id: docRef.id, ...income };
  } catch (error) {
    console.error("Error adding income:", error);
    throw error;
  }
}

// Add borrow/lent
export async function addBorrowLent(borrowLentData) {
  const userId = await getCurrentUserId();

  try {
    const borrowLent = {
      userId,
      type: borrowLentData.borrowLentType,
      person: borrowLentData.person,
      amount: parseFloat(borrowLentData.amount),
      description: borrowLentData.description,
      date: borrowLentData.date,
      dueDate: borrowLentData.dueDate,
      status: borrowLentData.status,
      returnedDate: borrowLentData.returnedDate || null,
      accountId: borrowLentData.accountId ? parseInt(borrowLentData.accountId) : null,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(
      collection(db, COLLECTIONS.BORROW_LENT),
      borrowLent
    );

    // Update balance if account is selected and updateBalance is true
    if (borrowLentData.updateBalance === "true" && borrowLentData.accountId) {
      if (borrowLentData.borrowLentType === "Borrow") {
        // When borrowing money, add to account balance (money coming in)
        await updateAccountBalanceForIncome(borrowLentData.accountId, borrowLentData.amount);
      } else if (borrowLentData.borrowLentType === "Lent") {
        // When lending money, subtract from account balance (money going out)
        await updateAccountBalance(borrowLentData.accountId, borrowLentData.amount);
      }
    }

    return { id: docRef.id, ...borrowLent };
  } catch (error) {
    console.error("Error adding borrow/lent:", error);
    throw error;
  }
}

// Get expenses with optional date filter
export async function getExpenses(startDate = null, endDate = null) {
  const userId = await getCurrentUserId();

  try {
    let q = query(
      collection(db, COLLECTIONS.EXPENSES),
      where("userId", "==", userId),
      orderBy("paymentDate", "desc")
    );

    if (startDate && endDate) {
      q = query(
        collection(db, COLLECTIONS.EXPENSES),
        where("userId", "==", userId),
        where("paymentDate", ">=", startDate),
        where("paymentDate", "<=", endDate),
        orderBy("paymentDate", "desc")
      );
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error getting expenses:", error);
    throw error;
  }
}

// Get income with optional date filter
export async function getIncome(startDate = null, endDate = null) {
  const userId = await getCurrentUserId();

  try {
    let q = query(
      collection(db, COLLECTIONS.INCOME),
      where("userId", "==", userId),
      orderBy("date", "desc")
    );

    if (startDate && endDate) {
      q = query(
        collection(db, COLLECTIONS.INCOME),
        where("userId", "==", userId),
        where("date", ">=", startDate),
        where("date", "<=", endDate),
        orderBy("date", "desc")
      );
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error getting income:", error);
    throw error;
  }
}

// Get borrow/lent records
export async function getBorrowLent() {
  const userId = await getCurrentUserId();

  try {
    const q = query(
      collection(db, COLLECTIONS.BORROW_LENT),
      where("userId", "==", userId),
      orderBy("date", "desc")
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error getting borrow/lent:", error);
    throw error;
  }
}

// Get balance for accounts
export async function getBalance() {
  const userId = await getCurrentUserId();

  try {
    const q = query(
      collection(db, COLLECTIONS.BALANCE),
      where("userId", "==", userId)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error getting balance:", error);
    throw error;
  }
}

// Update account balance for expenses
async function updateAccountBalance(accountId, expenseAmount) {
  const userId = await getCurrentUserId();

  try {
    // Get account type
    const accountQuery = query(
      collection(db, COLLECTIONS.PAYMENT_SUB_TYPES),
      where("userId", "==", userId),
      where("id", "==", parseInt(accountId))
    );
    const accountSnapshot = await getDocs(accountQuery);

    if (accountSnapshot.empty) {
      throw new Error("Account not found");
    }

    const account = accountSnapshot.docs[0].data();
    const isCreditCard = account.paymentTypeId === 3;

    // Find existing balance
    const balanceQuery = query(
      collection(db, COLLECTIONS.BALANCE),
      where("userId", "==", userId),
      where("accountId", "==", parseInt(accountId))
    );
    const balanceSnapshot = await getDocs(balanceQuery);

    if (balanceSnapshot.empty) {
      // Create new balance entry
      const newBalance = isCreditCard
        ? parseFloat(expenseAmount)
        : -parseFloat(expenseAmount);
      await addDoc(collection(db, COLLECTIONS.BALANCE), {
        userId,
        accountId: parseInt(accountId),
        balance: newBalance,
        creditLimit: 0,
        lastUpdated: serverTimestamp(),
      });
    } else {
      // Update existing balance
      const balanceDoc = balanceSnapshot.docs[0];
      const currentBalance = balanceDoc.data().balance || 0;

      let newBalance;
      if (isCreditCard) {
        // For credit cards: increase used amount
        newBalance = currentBalance + parseFloat(expenseAmount);
      } else {
        // For bank accounts: decrease balance
        newBalance = currentBalance - parseFloat(expenseAmount);
      }

      await updateDoc(doc(db, COLLECTIONS.BALANCE, balanceDoc.id), {
        balance: newBalance,
        lastUpdated: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("Error updating account balance:", error);
    throw error;
  }
}

// Update account balance for income
async function updateAccountBalanceForIncome(accountId, incomeAmount) {
  const userId = await getCurrentUserId();

  try {
    // Find existing balance
    const balanceQuery = query(
      collection(db, COLLECTIONS.BALANCE),
      where("userId", "==", userId),
      where("accountId", "==", parseInt(accountId))
    );
    const balanceSnapshot = await getDocs(balanceQuery);

    if (balanceSnapshot.empty) {
      // Create new balance entry
      await addDoc(collection(db, COLLECTIONS.BALANCE), {
        userId,
        accountId: parseInt(accountId),
        balance: parseFloat(incomeAmount),
        creditLimit: 0,
        lastUpdated: serverTimestamp(),
      });
    } else {
      // Update existing balance
      const balanceDoc = balanceSnapshot.docs[0];
      const currentBalance = balanceDoc.data().balance || 0;
      const newBalance = currentBalance + parseFloat(incomeAmount);

      await updateDoc(doc(db, COLLECTIONS.BALANCE, balanceDoc.id), {
        balance: newBalance,
        lastUpdated: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("Error updating account balance for income:", error);
    throw error;
  }
}

// Get auto-fill data based on description
export async function getAutoFillData(description) {
  const userId = await getCurrentUserId();

  try {
    // Search for similar descriptions in expenses
    const q = query(
      collection(db, COLLECTIONS.EXPENSES),
      where("userId", "==", userId),
      where("description", "==", description),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const expense = querySnapshot.docs[0].data();
      return {
        SubPaymentTypeId: expense.paymentSubTypeId,
        SubCategoryTypeId: expense.subCategoryId,
      };
    }

    return null;
  } catch (error) {
    console.error("Error getting auto-fill data:", error);
    return null;
  }
}

// Calculate current balance
export async function calculateCurrentBalance() {
  try {
    const [expenses, income] = await Promise.all([getExpenses(), getIncome()]);

    const totalExpenses = expenses.reduce(
      (sum, expense) => sum + expense.amount,
      0
    );
    const totalIncome = income.reduce((sum, inc) => sum + inc.amount, 0);

    return totalIncome - totalExpenses;
  } catch (error) {
    console.error("Error calculating current balance:", error);
    throw error;
  }
}

// Add balance
export async function addBalance(balanceData) {
  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.BALANCE), {
      ...balanceData,
      createdAt: serverTimestamp(),
    });

    return { id: docRef.id, ...balanceData };
  } catch (error) {
    console.error("Error adding balance:", error);
    throw error;
  }
}

// Update balance
export async function updateBalance(balanceId, balanceData) {
  try {
    const balanceRef = doc(db, COLLECTIONS.BALANCE, balanceId);
    await updateDoc(balanceRef, {
      ...balanceData,
      updatedAt: serverTimestamp(),
    });

    return { id: balanceId, ...balanceData };
  } catch (error) {
    console.error("Error updating balance:", error);
    throw error;
  }
}

// Update expense with balance adjustment
export async function updateExpense(expenseId, expenseData) {
  const userId = await getCurrentUserId();

  try {
    // Get the original expense to calculate balance adjustment
    const originalExpenseQuery = query(
      collection(db, COLLECTIONS.EXPENSES),
      where("userId", "==", userId),
      where("__name__", "==", expenseId)
    );
    const originalExpenseSnapshot = await getDocs(originalExpenseQuery);

    if (originalExpenseSnapshot.empty) {
      throw new Error("Expense not found");
    }

    const originalExpense = originalExpenseSnapshot.docs[0].data();
    const originalAmount = originalExpense.amount;
    const originalAccountId = originalExpense.paymentSubTypeId;
    const newAmount = parseFloat(expenseData.amount);
    const newAccountId = parseInt(expenseData.subPaymentTypeId);

    // Update the expense
    const expenseRef = doc(db, COLLECTIONS.EXPENSES, expenseId);
    const updatedExpense = {
      amount: newAmount,
      paymentTypeId: parseInt(expenseData.paymentType),
      paymentSubTypeId: newAccountId,
      categoryId: parseInt(expenseData.category),
      subCategoryId: parseInt(expenseData.subCategoryTypeId),
      description: expenseData.description,
      paymentDate: expenseData.paymentDate,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(expenseRef, updatedExpense);

    // Update balances if requested
    if (expenseData.updateBalance === "true") {
      // Reverse the original transaction
      await reverseAccountBalance(originalAccountId, originalAmount);
      // Apply the new transaction
      await updateAccountBalance(newAccountId, newAmount);
    }

    return { id: expenseId, ...updatedExpense };
  } catch (error) {
    console.error("Error updating expense:", error);
    throw error;
  }
}

// Update account metadata (e.g. Bill Due Day)
export async function updateAccountMetadata(accountId, metadata) {
  const userId = await getCurrentUserId();

  try {
    // Find the payment sub type doc
    const q = query(
      collection(db, COLLECTIONS.PAYMENT_SUB_TYPES),
      where("userId", "==", userId),
      where("id", "==", accountId)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new Error("Account not found");
    }

    const docRef = querySnapshot.docs[0].ref;

    await updateDoc(docRef, {
      ...metadata,
      updatedAt: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error("Error updating account metadata:", error);
    throw error;
  }
}

// Update income with balance adjustment
export async function updateIncome(incomeId, incomeData) {
  const userId = await getCurrentUserId();

  try {
    // Get the original income to calculate balance adjustment
    const originalIncomeQuery = query(
      collection(db, COLLECTIONS.INCOME),
      where("userId", "==", userId),
      where("__name__", "==", incomeId)
    );
    const originalIncomeSnapshot = await getDocs(originalIncomeQuery);

    if (originalIncomeSnapshot.empty) {
      throw new Error("Income not found");
    }

    const originalIncome = originalIncomeSnapshot.docs[0].data();
    const originalAmount = originalIncome.amount;
    const originalAccountId = originalIncome.accountId;
    const newAmount = parseFloat(incomeData.amount);
    const newAccountId = parseInt(incomeData.accountId);

    // Update the income
    const incomeRef = doc(db, COLLECTIONS.INCOME, incomeId);
    const updatedIncome = {
      amount: newAmount,
      description: incomeData.description,
      incomeSourceId: parseInt(incomeData.incomeSource),
      accountId: newAccountId,
      date: incomeData.date,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(incomeRef, updatedIncome);

    // Update balances if requested
    if (incomeData.updateBalance === "true" && newAccountId) {
      // Reverse the original transaction
      await reverseAccountBalanceForIncome(originalAccountId, originalAmount);
      // Apply the new transaction
      await updateAccountBalanceForIncome(newAccountId, newAmount);
    }

    return { id: incomeId, ...updatedIncome };
  } catch (error) {
    console.error("Error updating income:", error);
    throw error;
  }
}

// Save transaction mapping (Learning feature)
export async function saveTransactionMapping(mappingData) {
  const userId = await getCurrentUserId();

  try {
    const mapping = {
      userId,
      originalDescription: mappingData.originalDescription,
      mappedDescription: mappingData.mappedDescription,
      categoryId: parseInt(mappingData.categoryId),
      subCategoryId: parseInt(mappingData.subCategoryId),
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.TRANSACTION_MAPPINGS), mapping);
    return { id: docRef.id, ...mapping };
  } catch (error) {
    console.error("Error saving transaction mapping:", error);
    throw error;
  }
}

// Get transaction mapping (Learning feature)
export async function getTransactionMapping(originalDescription) {
  const userId = await getCurrentUserId();

  try {
    const q = query(
      collection(db, COLLECTIONS.TRANSACTION_MAPPINGS),
      where("userId", "==", userId),
      where("originalDescription", "==", originalDescription),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data();
    }

    return null;
  } catch (error) {
    console.error("Error getting transaction mapping:", error);
    return null; // Don't throw, just return null if not found or error
  }
}

// Delete expense with balance adjustment
export async function deleteExpense(expenseId) {
  const userId = await getCurrentUserId();

  try {
    // Get the expense to calculate balance adjustment
    const expenseQuery = query(
      collection(db, COLLECTIONS.EXPENSES),
      where("userId", "==", userId),
      where("__name__", "==", expenseId)
    );
    const expenseSnapshot = await getDocs(expenseQuery);

    if (expenseSnapshot.empty) {
      throw new Error("Expense not found");
    }

    const expense = expenseSnapshot.docs[0].data();
    const expenseRef = doc(db, COLLECTIONS.EXPENSES, expenseId);

    // Delete the expense
    await deleteDoc(expenseRef);

    // Reverse the balance adjustment
    await reverseAccountBalance(expense.paymentSubTypeId, expense.amount);

    return { success: true, message: "Expense deleted successfully" };
  } catch (error) {
    console.error("Error deleting expense:", error);
    throw error;
  }
}

// Delete income with balance adjustment
export async function deleteIncome(incomeId) {
  const userId = await getCurrentUserId();

  try {
    // Get the income to calculate balance adjustment
    const incomeQuery = query(
      collection(db, COLLECTIONS.INCOME),
      where("userId", "==", userId),
      where("__name__", "==", incomeId)
    );
    const incomeSnapshot = await getDocs(incomeQuery);

    if (incomeSnapshot.empty) {
      throw new Error("Income not found");
    }

    const income = incomeSnapshot.docs[0].data();
    const incomeRef = doc(db, COLLECTIONS.INCOME, incomeId);

    // Delete the income
    await deleteDoc(incomeRef);

    // Reverse the balance adjustment
    if (income.accountId) {
      await reverseAccountBalanceForIncome(income.accountId, income.amount);
    }

    return { success: true, message: "Income deleted successfully" };
  } catch (error) {
    console.error("Error deleting income:", error);
    throw error;
  }
}

// Search transactions by description or amount
export async function searchTransactions(searchTerm, startDate = null, endDate = null) {
  const userId = await getCurrentUserId();

  try {
    // Get all categories for mapping id -> name
    const categoriesSnapshot = await getDocs(
      query(
        collection(db, COLLECTIONS.CATEGORIES),
        where("userId", "==", userId)
      )
    );
    const categoryMap = {};
    categoriesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      categoryMap[data.id] = data.name.toLowerCase();
    });

    // Get expenses and income
    let expensesQuery = query(
      collection(db, COLLECTIONS.EXPENSES),
      where("userId", "==", userId),
      orderBy("paymentDate", "desc")
    );

    let incomeQuery = query(
      collection(db, COLLECTIONS.INCOME),
      where("userId", "==", userId),
      orderBy("date", "desc")
    );

    // Apply date filter if provided
    if (startDate && endDate) {
      expensesQuery = query(
        collection(db, COLLECTIONS.EXPENSES),
        where("userId", "==", userId),
        where("paymentDate", ">=", startDate),
        where("paymentDate", "<=", endDate),
        orderBy("paymentDate", "desc")
      );

      incomeQuery = query(
        collection(db, COLLECTIONS.INCOME),
        where("userId", "==", userId),
        where("date", ">=", startDate),
        where("date", "<=", endDate),
        orderBy("date", "desc")
      );
    }

    const [expensesSnapshot, incomeSnapshot] = await Promise.all([
      getDocs(expensesQuery),
      getDocs(incomeQuery)
    ]);

    // Filter by search term (description, amount, category name)
    const searchLower = searchTerm.toLowerCase();
    const filteredExpenses = expensesSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(expense => {
        const categoryName = categoryMap[expense.categoryId] || "";
        return (
          (expense.description && expense.description.toLowerCase().includes(searchLower)) ||
          (expense.amount && expense.amount.toString().includes(searchTerm)) ||
          (categoryName && categoryName.includes(searchLower))
        );
      });

    const filteredIncome = incomeSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(income =>
        (income.description && income.description.toLowerCase().includes(searchLower)) ||
        (income.amount && income.amount.toString().includes(searchTerm))
      );

    return {
      expenses: filteredExpenses,
      income: filteredIncome
    };
  } catch (error) {
    console.error("Error searching transactions:", error);
    throw error;
  }
}

// Helper function to reverse account balance for expenses
async function reverseAccountBalance(accountId, expenseAmount) {
  const userId = await getCurrentUserId();

  try {
    // Get account type
    const accountQuery = query(
      collection(db, COLLECTIONS.PAYMENT_SUB_TYPES),
      where("userId", "==", userId),
      where("id", "==", parseInt(accountId))
    );
    const accountSnapshot = await getDocs(accountQuery);

    if (accountSnapshot.empty) {
      return; // Account not found, skip balance update
    }

    const account = accountSnapshot.docs[0].data();
    const isCreditCard = account.paymentTypeId === 3;

    // Find existing balance
    const balanceQuery = query(
      collection(db, COLLECTIONS.BALANCE),
      where("userId", "==", userId),
      where("accountId", "==", parseInt(accountId))
    );
    const balanceSnapshot = await getDocs(balanceQuery);

    if (!balanceSnapshot.empty) {
      // Update existing balance
      const balanceDoc = balanceSnapshot.docs[0];
      const currentBalance = balanceDoc.data().balance || 0;

      let newBalance;
      if (isCreditCard) {
        // For credit cards: decrease used amount (reverse the expense)
        newBalance = currentBalance - parseFloat(expenseAmount);
      } else {
        // For bank accounts: increase balance (reverse the expense)
        newBalance = currentBalance + parseFloat(expenseAmount);
      }

      await updateDoc(doc(db, COLLECTIONS.BALANCE, balanceDoc.id), {
        balance: newBalance,
        lastUpdated: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("Error reversing account balance:", error);
    throw error;
  }
}

// Helper function to reverse account balance for income
async function reverseAccountBalanceForIncome(accountId, incomeAmount) {
  const userId = await getCurrentUserId();

  try {
    // Find existing balance
    const balanceQuery = query(
      collection(db, COLLECTIONS.BALANCE),
      where("userId", "==", userId),
      where("accountId", "==", parseInt(accountId))
    );
    const balanceSnapshot = await getDocs(balanceQuery);

    if (!balanceSnapshot.empty) {
      // Update existing balance
      const balanceDoc = balanceSnapshot.docs[0];
      const currentBalance = balanceDoc.data().balance || 0;
      const newBalance = currentBalance - parseFloat(incomeAmount); // Reverse the income

      await updateDoc(doc(db, COLLECTIONS.BALANCE, balanceDoc.id), {
        balance: newBalance,
        lastUpdated: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("Error reversing account balance for income:", error);
    throw error;
  }
}

// Update borrow/lent with balance adjustment
export async function updateBorrowLent(borrowLentId, borrowLentData) {
  const userId = await getCurrentUserId();

  try {
    // Get the original borrow/lent to calculate balance adjustment
    const originalBorrowLentQuery = query(
      collection(db, COLLECTIONS.BORROW_LENT),
      where("userId", "==", userId),
      where("__name__", "==", borrowLentId)
    );
    const originalBorrowLentSnapshot = await getDocs(originalBorrowLentQuery);

    if (originalBorrowLentSnapshot.empty) {
      throw new Error("Borrow/Lent record not found");
    }

    const originalBorrowLent = originalBorrowLentSnapshot.docs[0].data();
    const originalAmount = originalBorrowLent.amount;
    const originalAccountId = originalBorrowLent.accountId;
    const originalType = originalBorrowLent.type;
    const newAmount = parseFloat(borrowLentData.amount);
    const newAccountId = borrowLentData.accountId ? parseInt(borrowLentData.accountId) : null;
    const newType = borrowLentData.borrowLentType;

    // Update the borrow/lent record
    const borrowLentRef = doc(db, COLLECTIONS.BORROW_LENT, borrowLentId);
    const updatedBorrowLent = {
      type: newType,
      person: borrowLentData.person,
      amount: newAmount,
      description: borrowLentData.description,
      date: borrowLentData.date,
      dueDate: borrowLentData.dueDate,
      status: borrowLentData.status,
      returnedDate: borrowLentData.returnedDate || null,
      accountId: newAccountId,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(borrowLentRef, updatedBorrowLent);

    // Update balances if requested
    if (borrowLentData.updateBalance === "true") {
      // Reverse the original transaction
      if (originalAccountId) {
        if (originalType === "Borrow") {
          await reverseAccountBalanceForIncome(originalAccountId, originalAmount);
        } else if (originalType === "Lent") {
          await reverseAccountBalance(originalAccountId, originalAmount);
        }
      }

      // Apply the new transaction
      if (newAccountId) {
        if (newType === "Borrow") {
          await updateAccountBalanceForIncome(newAccountId, newAmount);
        } else if (newType === "Lent") {
          await updateAccountBalance(newAccountId, newAmount);
        }
      }
    }

    return { id: borrowLentId, ...updatedBorrowLent };
  } catch (error) {
    console.error("Error updating borrow/lent:", error);
    throw error;
  }
}

// Delete borrow/lent with balance adjustment
export async function deleteBorrowLent(borrowLentId) {
  const userId = await getCurrentUserId();

  try {
    // Get the borrow/lent to calculate balance adjustment
    const borrowLentQuery = query(
      collection(db, COLLECTIONS.BORROW_LENT),
      where("userId", "==", userId),
      where("__name__", "==", borrowLentId)
    );
    const borrowLentSnapshot = await getDocs(borrowLentQuery);

    if (borrowLentSnapshot.empty) {
      throw new Error("Borrow/Lent record not found");
    }

    const borrowLent = borrowLentSnapshot.docs[0].data();
    const borrowLentRef = doc(db, COLLECTIONS.BORROW_LENT, borrowLentId);

    // Delete the borrow/lent record
    await deleteDoc(borrowLentRef);

    // Reverse the balance adjustment
    if (borrowLent.accountId) {
      if (borrowLent.type === "Borrow") {
        await reverseAccountBalanceForIncome(borrowLent.accountId, borrowLent.amount);
      } else if (borrowLent.type === "Lent") {
        await reverseAccountBalance(borrowLent.accountId, borrowLent.amount);
      }
    }

    return { success: true, message: "Borrow/Lent record deleted successfully" };
  } catch (error) {
    console.error("Error deleting borrow/lent:", error);
    throw error;
  }
}
