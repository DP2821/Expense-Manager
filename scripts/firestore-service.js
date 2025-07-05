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
};

// Initialize default data for new users
const DEFAULT_DATA = {
  categories: [
    { id: 1, name: "🏠   Home expense" },
    { id: 2, name: "🍔  Food and Drink" },
    { id: 3, name: "⛽   Petrol" },
    { id: 4, name: "🚜  Farming expense" },
    { id: 5, name: "👨‍⚕️   Health" },
    { id: 6, name: "👕  Clothes" },
    { id: 7, name: "🚗  Transport" },
    { id: 8, name: "🧳   Trip & Travels " },
    { id: 9, name: "👪  Society expense" },
    { id: 10, name: "🌏  General" },
    { id: 11, name: "📱    Mobile Recharge" },
    { id: 12, name: "💸   Investment" },
    { id: 13, name: "💇  Saloon and Parlour" },
    { id: 14, name: "🎬   Movies" },
    { id: 15, name: "🅰️   Ahmedabad expenses" },
    { id: 16, name: "🐄   Stable expense" },
    { id: 17, name: "👰‍♂️Marraige, Engagement" },
    { id: 18, name: "👟  Shoes" },
    { id: 18, name: "💵  Debt/EMI" },
  ],
  paymentTypes: [
    { id: 1, name: "UPI" },
    { id: 2, name: "Cash" },
    { id: 3, name: "Credit Card" },
    { id: 4, name: "Cheque" },
  ],
  paymentSubTypes: [
    { id: 1, name: "Kajal ICICI", paymentTypeId: 1 },
    { id: 2, name: "Dhruvil HDFC", paymentTypeId: 1 },
    { id: 3, name: "Dhruvil SBI", paymentTypeId: 1 },
    { id: 4, name: "Rakesh SBI", paymentTypeId: 1 },
    { id: 5, name: "Rakesh SK", paymentTypeId: 1 },
    { id: 6, name: "Rakesh ICICI", paymentTypeId: 1 },
    { id: 7, name: "Rakesh", paymentTypeId: 2 },
    { id: 8, name: "Dhruvil", paymentTypeId: 2 },
    { id: 9, name: "Kajal", paymentTypeId: 2 },
    { id: 10, name: "HDFC RuPay", paymentTypeId: 3 },
    { id: 11, name: "HDFC Visa", paymentTypeId: 3 },
    { id: 12, name: "Dhruvil Indian", paymentTypeId: 1 },
    { id: 13, name: "HDFC Pixel", paymentTypeId: 3 },
    { id: 14, name: "Axis", paymentTypeId: 3 },
  ],
  subCategories: [
    { id: 1, name: "Groceries", categoryId: 1 },
    { id: 2, name: "Vegetables", categoryId: 1 },
    { id: 3, name: "Gas bottle", categoryId: 1 },
    { id: 4, name: "Oil", categoryId: 1 },
    { id: 5, name: "Electricity", categoryId: 1 },
    { id: 6, name: "Hotel", categoryId: 2 },
    { id: 7, name: "FastFood", categoryId: 2 },
    { id: 8, name: "Ice-Cream", categoryId: 2 },
    { id: 9, name: "TVS", categoryId: 3 },
    { id: 10, name: "Hero Splendar", categoryId: 3 },
    { id: 11, name: "Lightbill", categoryId: 4 },
    { id: 12, name: "Seeds", categoryId: 4 },
    { id: 13, name: "Fertilizer", categoryId: 4 },
    { id: 14, name: "Tractor", categoryId: 4 },
    { id: 15, name: "Labour work", categoryId: 4 },
    { id: 16, name: "Rakesh", categoryId: 5 },
    { id: 17, name: "Kajal", categoryId: 5 },
    { id: 18, name: "Dhruvil", categoryId: 5 },
    { id: 19, name: "Rakesh", categoryId: 6 },
    { id: 20, name: "Kajal", categoryId: 6 },
    { id: 21, name: "Dhruvil", categoryId: 6 },
    { id: 22, name: "Rakesh", categoryId: 7 },
    { id: 23, name: "Kajal", categoryId: 7 },
    { id: 24, name: "Dhruvil", categoryId: 7 },
    { id: 25, name: "All", categoryId: 7 },
    { id: 26, name: "Rakesh", categoryId: 8 },
    { id: 27, name: "Kajal", categoryId: 8 },
    { id: 28, name: "Dhruvil", categoryId: 8 },
    { id: 29, name: "All", categoryId: 8 },
    { id: 30, name: "Marriage", categoryId: 9 },
    { id: 31, name: "Other", categoryId: 9 },
    { id: 32, name: "Rakesh", categoryId: 11 },
    { id: 33, name: "Kajal", categoryId: 11 },
    { id: 34, name: "Dhruvil", categoryId: 11 },
    { id: 35, name: "Lunch", categoryId: 15 },
    { id: 36, name: "Transport", categoryId: 15 },
    { id: 37, name: "Room Rent", categoryId: 15 },
    { id: 38, name: "Mutual Fund", categoryId: 12 },
    { id: 39, name: "Stocks", categoryId: 12 },
    { id: 40, name: "General", categoryId: 10 },
    { id: 41, name: "Cow Buffalo", categoryId: 16 },
    { id: 42, name: "PhotoGraphy", categoryId: 17 },
    { id: 43, name: "General", categoryId: 17 },
    { id: 44, name: "Dhruvil", categoryId: 13 },
    { id: 45, name: "Rakesh", categoryId: 13 },
    { id: 46, name: "Kajal", categoryId: 13 },
    { id: 47, name: "Dhruvil", categoryId: 18 },
    { id: 48, name: "Rakesh", categoryId: 18 },
    { id: 49, name: "Kajal", categoryId: 18 },
    { id: 50, name: "Debt/EMI", categoryId: 19 },
    { id: 51, name: "Insurance", categoryId: 12 },
    { id: 52, name: "Kashish", categoryId: 5 },
    { id: 53, name: "Kashish", categoryId: 6 },
    { id: 54, name: "Theater", categoryId: 14 },
    { id: 55, name: "OTT", categoryId: 14 },
    { id: 56, name: "General", categoryId: 15 },
    { id: 57, name: "Kashish", categoryId: 11 },
    { id: 58, name: "Nexon", categoryId: 3 },
  ],
  incomeCategories: [
    { id: 1, name: "Salary" },
    { id: 2, name: "Freelance" },
    { id: 3, name: "Investment" },
    { id: 4, name: "Business" },
    { id: 5, name: "Gift" },
    { id: 6, name: "Other" },
  ],
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
  const userId = await getCurrentUserId();

  try {
    // Check if user data already exists
    const existingData = await getDocs(
      query(
        collection(db, COLLECTIONS.CATEGORIES),
        where("userId", "==", userId)
      )
    );
    if (!existingData.empty) {
      return; // Data already exists
    }

    // Initialize categories
    for (const category of DEFAULT_DATA.categories) {
      await addDoc(collection(db, COLLECTIONS.CATEGORIES), {
        ...category,
        userId,
        createdAt: serverTimestamp(),
      });
    }

    // Initialize payment types
    for (const paymentType of DEFAULT_DATA.paymentTypes) {
      await addDoc(collection(db, COLLECTIONS.PAYMENT_TYPES), {
        ...paymentType,
        userId,
        createdAt: serverTimestamp(),
      });
    }

    // Initialize payment sub types
    for (const paymentSubType of DEFAULT_DATA.paymentSubTypes) {
      await addDoc(collection(db, COLLECTIONS.PAYMENT_SUB_TYPES), {
        ...paymentSubType,
        userId,
        createdAt: serverTimestamp(),
      });
    }

    // Initialize sub categories
    for (const subCategory of DEFAULT_DATA.subCategories) {
      await addDoc(collection(db, COLLECTIONS.SUB_CATEGORIES), {
        ...subCategory,
        userId,
        createdAt: serverTimestamp(),
      });
    }

    // Initialize income categories
    for (const incomeCategory of DEFAULT_DATA.incomeCategories) {
      await addDoc(collection(db, COLLECTIONS.INCOME_CATEGORIES), {
        ...incomeCategory,
        userId,
        createdAt: serverTimestamp(),
      });
    }

    console.log("User data initialized successfully");
  } catch (error) {
    console.error("Error initializing user data:", error);
    throw error;
  }
}

// Get all dropdown data
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
          where("userId", "==", userId)
        )
      ),
      getDocs(
        query(
          collection(db, COLLECTIONS.PAYMENT_TYPES),
          where("userId", "==", userId)
        )
      ),
      getDocs(
        query(
          collection(db, COLLECTIONS.PAYMENT_SUB_TYPES),
          where("userId", "==", userId)
        )
      ),
      getDocs(
        query(
          collection(db, COLLECTIONS.SUB_CATEGORIES),
          where("userId", "==", userId)
        )
      ),
      getDocs(
        query(
          collection(db, COLLECTIONS.INCOME_CATEGORIES),
          where("userId", "==", userId)
        )
      ),
    ]);

    // Convert to the format expected by the frontend
    const result = {
      Category: categories.docs.map((doc) => ({
        Value: doc.data().id,
        Text: doc.data().name,
      })),
      PaymentType: paymentTypes.docs.map((doc) => ({
        Value: doc.data().id,
        Text: doc.data().name,
      })),
      PaymentSubType: paymentSubTypes.docs.map((doc) => ({
        Value: doc.data().id,
        Text: doc.data().name,
        PaymentType: doc.data().paymentTypeId,
      })),
      SubCategory: subCategories.docs.map((doc) => ({
        Value: doc.data().id,
        Text: doc.data().name,
        CategoryId: doc.data().categoryId,
      })),
      IncomeCategory: incomeCategories.docs.map((doc) => ({
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
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(
      collection(db, COLLECTIONS.BORROW_LENT),
      borrowLent
    );
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
  const userId = await getCurrentUserId();

  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.BALANCE), {
      ...balanceData,
      userId,
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
