// ============================================
// BANKING SYSTEM - Core Functions
// ============================================

// LOCAL STORAGE KEYS
const STORAGE_KEYS = {
  users: 'bassline_users',
  transactions: 'bassline_transactions',
  loans: 'bassline_loans',
  currentUser: 'bassline_current_user'
};

// Merchant bank details - REPLACE these placeholders with your real bank details
// Do NOT commit real credentials to a public repo. Keep them on the server or
// in an environment-specific config when you deploy.
const MERCHANT_BANK_DETAILS = {
  accountName: 'Bassline Customs',
  bankName: 'Capitec Bank',
  accountNumber: '2238307539',
  branchCode: '470010',
  referencePrefix: 'BLC'
};

// Email that will be allowed to perform merchant/admin actions in the UI.
// Change this to the email you use for the merchant account in your test environment.
const MERCHANT_ADMIN_EMAIL = 'addminbasline@gmail.com';

function generateBankReference(transactionId) {
  return `${MERCHANT_BANK_DETAILS.referencePrefix}-${transactionId.slice(-8)}`;
}

// ============================================
// USER MANAGEMENT
// ============================================

function registerNewUser(name, email, phone, password) {
  const users = getAllUsers();
  
  // Check if email already exists
  if (users.find(u => u.email === email)) {
    return null;
  }

  const newUser = {
    id: generateId(),
    name: name,
    email: email,
    phone: phone,
    password: hashPassword(password),
    balance: 0,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
  
  return {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    phone: newUser.phone,
    balance: newUser.balance
  };
}

function authenticateUser(email, password) {
  const users = getAllUsers();
  const user = users.find(u => u.email === email && u.password === hashPassword(password));
  
  if (user) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      balance: user.balance
    };
  }
  return null;
}

function getAllUsers() {
  const data = localStorage.getItem(STORAGE_KEYS.users);
  return data ? JSON.parse(data) : [];
}

function getUserById(userId) {
  const users = getAllUsers();
  return users.find(u => u.id === userId);
}

function updateUserBalance(userId, amount) {
  const users = getAllUsers();
  const user = users.find(u => u.id === userId);
  
  if (user) {
    user.balance += amount;
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
  }
}

// ============================================
// SESSION MANAGEMENT
// ============================================

function setCurrentUser(user) {
  localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user));
}

function getCurrentUser() {
  const data = localStorage.getItem(STORAGE_KEYS.currentUser);
  return data ? JSON.parse(data) : null;
}

function clearCurrentUser() {
  localStorage.removeItem(STORAGE_KEYS.currentUser);
}

// ============================================
// TRANSACTION MANAGEMENT
// ============================================

function processTransaction(userId, details) {
  const transactions = getTransactions(userId);
  
  const transaction = {
    id: generateId(),
    userId: userId,
    service: details.service || details.services || '',
    amount: details.amount,
    method: details.method, // 'full' or 'installment'
    term: details.term || 0,
    interestRate: details.interestRate || 0,
    status: details.status || 'pending',
    date: new Date().toISOString()
  };

  transactions.push(transaction);
  localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));

  // If bank transfer, generate and attach a bank reference to the transaction
  if (details.method === 'bank') {
    transaction.bankReference = generateBankReference(transaction.id);
    localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
  }

  // Create loan if installment
  if (details.method === 'installment') {
    createLoan(userId, transaction.id, details.amount, details.interestRate, details.term);
  }

  return transaction;
}

// Retrieve a transaction by its id (searches all transactions)
function getTransactionById(transactionId) {
  const data = localStorage.getItem(STORAGE_KEYS.transactions);
  const allTransactions = data ? JSON.parse(data) : [];
  return allTransactions.find(t => t.id === transactionId) || null;
}

// Update a transaction status (e.g. from 'pending' -> 'completed')
function updateTransactionStatus(transactionId, newStatus) {
  const data = localStorage.getItem(STORAGE_KEYS.transactions);
  const allTransactions = data ? JSON.parse(data) : [];
  const tx = allTransactions.find(t => t.id === transactionId);
  if (!tx) return false;

  tx.status = newStatus;

  // When marking completed, optionally update user balance or related records
  if (newStatus === 'completed') {
    // For now we simply persist the status change. If you want to credit
    // the merchant or update other systems, add that logic here.
  }

  localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(allTransactions));
  return true;
}

function getTransactions(userId) {
  const data = localStorage.getItem(STORAGE_KEYS.transactions);
  const allTransactions = data ? JSON.parse(data) : [];
  return allTransactions.filter(t => t.userId === userId);
}

// ============================================
// FINANCING/LOANS
// ============================================

function createLoan(userId, transactionId, amount, interestRate, term) {
  const loans = getAllLoans();
  const interest = amount * interestRate;
  const totalAmount = amount + interest;
  const monthlyPayment = totalAmount / term;

  const loan = {
    id: generateId(),
    userId: userId,
    transactionId: transactionId,
    originalAmount: amount,
    totalAmount: totalAmount,
    interestRate: interestRate,
    monthlyPayment: monthlyPayment,
    term: term,
    termRemaining: term,
    status: 'active',
    startDate: new Date().toISOString(),
    nextPaymentDate: getNextPaymentDate(),
    payments: []
  };

  loans.push(loan);
  localStorage.setItem(STORAGE_KEYS.loans, JSON.stringify(loans));
  
  return loan;
}

function getActiveLoans(userId) {
  const data = localStorage.getItem(STORAGE_KEYS.loans);
  const allLoans = data ? JSON.parse(data) : [];
  return allLoans.filter(l => l.userId === userId && l.status === 'active');
}

function getAllLoans() {
  const data = localStorage.getItem(STORAGE_KEYS.loans);
  return data ? JSON.parse(data) : [];
}

function makePayment(loanId, amount) {
  const loans = getAllLoans();
  const loan = loans.find(l => l.id === loanId);

  if (loan) {
    loan.payments.push({
      date: new Date().toISOString(),
      amount: amount
    });
    
    loan.termRemaining -= 1;
    if (loan.termRemaining <= 0) {
      loan.status = 'completed';
    }

    localStorage.setItem(STORAGE_KEYS.loans, JSON.stringify(loans));
    return true;
  }
  return false;
}

function getLoanDetails(loanId) {
  const loans = getAllLoans();
  return loans.find(l => l.id === loanId);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function generateId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function hashPassword(password) {
  // Simple hash - in production, use proper hashing library
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
}

function getNextPaymentDate() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toISOString();
}

function formatCurrency(amount) {
  return `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-ZA');
}

// ============================================
// REPORTS & ANALYTICS
// ============================================

function getAccountSummary(userId) {
  const transactions = getTransactions(userId);
  const activeLoans = getActiveLoans(userId);
  
  const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);
  const outstandingBalance = activeLoans.reduce((sum, l) => sum + (l.monthlyPayment * l.termRemaining), 0);

  return {
    totalSpent: totalSpent,
    transactionCount: transactions.length,
    activeLoans: activeLoans.length,
    outstandingBalance: outstandingBalance,
    lastTransaction: transactions.length > 0 ? transactions[transactions.length - 1] : null
  };
}

function getMonthlySummary(userId, year, month) {
  const transactions = getTransactions(userId);
  const monthTransactions = transactions.filter(t => {
    const date = new Date(t.date);
    return date.getFullYear() === year && date.getMonth() === month - 1;
  });

  const totalAmount = monthTransactions.reduce((sum, t) => sum + t.amount, 0);
  return {
    month: month,
    year: year,
    transactions: monthTransactions,
    totalAmount: totalAmount
  };
}
