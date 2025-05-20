let transactions = [];
let totalAmount = 0;
let showingAll = false;
let transactionsTable;
let viewAllBtn;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchCategories() {
  try {
    const response = await fetch('http://localhost:5000/budgets', {
      headers: { "Content-Type": "application/json" },
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`Failed to fetch categories: ${response.status}`);
    const categories = await response.json();
    return categories.map(budget => budget.name);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
}

async function populateCategories() {
  const categorySelect = document.getElementById("category-select");
  if (!categorySelect) return;

  const categories = await fetchCategories();
  categorySelect.innerHTML = '<option value="">Select a category</option>';
  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });
  const newCategoryOption = document.createElement("option");
  newCategoryOption.value = "new";
  newCategoryOption.textContent = "Add New Category";
  categorySelect.appendChild(newCategoryOption);
}

function toggleNewCategoryInput() {
  const categorySelect = document.getElementById("category-select");
  const newCategoryInput = document.getElementById("new-category-input");
  if (categorySelect.value === "new") {
    newCategoryInput.style.display = "block";
  } else {
    newCategoryInput.style.display = "none";
    document.getElementById("new-category").value = "";
    document.getElementById("new-category-error").textContent = "";
  }
  document.getElementById("category-error").textContent = "";
}

async function fetchTransactions(retryCount = 3, delayMs = 1000) {
  try {
    const response = await fetch(`http://localhost:5000/transactions?_=${Date.now()}`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store"
    });
    if (!response.ok) {
      if (response.status === 429 && retryCount > 0) {
        console.log(`429 Too Many Requests - Retrying in ${delayMs}ms... (${retryCount} retries left)`);
        await delay(delayMs);
        return fetchTransactions(retryCount - 1, delayMs * 2);
      }
      throw new Error(`Server responded with status ${response.status}`);
    }

    const data = await response.json();
    transactions = data.sort((a, b) => new Date(b.date) - new Date(a.date));
    console.log("Fetched transactions:", transactions.map(tx => ({ date: tx.date, category: tx.category, amount: tx.amount })));
    totalAmount = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
    displayTransactions(false);
    updateTotalExpensesUI();

    if (viewAllBtn) {
      viewAllBtn.style.display = transactions.length > 6 ? "block" : "none";
    }
  } catch (error) {
    console.error("Error fetching transactions:", error);
    if (error.message.includes("429")) {
      addNotification("Too many requests to server. Please wait and try again.");
    }
  }
}

function displayTransactions(showAll) {
  const visibleTransactions = showAll ? [...transactions] : transactions.slice(0, 6);

  if (transactionsTable) {
    transactionsTable.innerHTML = visibleTransactions.length > 0
      ? visibleTransactions.map(tx => `
          <tr>
            <td>${tx.transactionId || "N/A"}</td>
            <td>${formatDate(tx.date)}</td>
            <td>${formatTime(tx.date)}</td>
            <td>${tx.category}</td>
            <td>₹${parseFloat(tx.amount || 0).toFixed(2)}</td>
          </tr>`).join("")
      : "<tr><td colspan='5'>No transactions available</td></tr>";
  }

  if (viewAllBtn) {
    viewAllBtn.textContent = showAll ? "Show Less" : "View All";
  }
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return isNaN(date) ? "Invalid Date" : date.toLocaleDateString("en-GB");
}

function formatTime(dateString) {
  const date = new Date(dateString);
  return isNaN(date) ? "Invalid Time" : date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function updateTotalExpensesUI() {
  const totalExpensesDiv = document.getElementById("total-expenses");
  if (totalExpensesDiv) {
    totalExpensesDiv.innerHTML = transactions.length > 0
      ? `Total: ₹${totalAmount.toFixed(2)}`
      : "Total: ₹0.00";
  }
}

function clearFormErrors() {
  document.getElementById("category-error").textContent = "";
  document.getElementById("new-category-error").textContent = "";
  document.getElementById("amount-error").textContent = "";
  document.getElementById("date-error").textContent = "";
}

async function addExpense() {
  clearFormErrors();

  const categorySelect = document.getElementById("category-select");
  const newCategoryInput = document.getElementById("new-category");
  const amountInput = document.getElementById("amount");
  const dateInput = document.getElementById("date");
  const timeInput = document.getElementById("time");

  if (!categorySelect || !newCategoryInput || !amountInput || !dateInput) {
    console.error("Form elements missing:", { categorySelect, newCategoryInput, amountInput, dateInput });
    alert("Error: Expense form is not available. Please try again.");
    return;
  }

  const categoryValue = categorySelect.value;
  const newCategory = newCategoryInput.value.trim();
  const amount = parseFloat(amountInput.value);
  const dateValue = dateInput.value;
  const timeValue = timeInput ? timeInput.value : "";

  let hasError = false;
  let category = categoryValue;

  if (!categoryValue) {
    document.getElementById("category-error").textContent = "Please select a category.";
    hasError = true;
  }

  if (categoryValue === "new") {
    if (!newCategory) {
      document.getElementById("new-category-error").textContent = "Please enter a new category name.";
      hasError = true;
    } else {
      category = newCategory;
      try {
        const response = await fetch('http://localhost:5000/budgets', {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: category, budget: 0, spent: 0 })
        });
        if (!response.ok) throw new Error(`Failed to create category: ${response.status}`);
        console.log(`Created new category: ${category}`);
      } catch (error) {
        console.error("Error creating new budget category:", error);
        document.getElementById("new-category-error").textContent = "Failed to create new category.";
        hasError = true;
      }
    }
  }

  if (isNaN(amount) || amount <= 0) {
    document.getElementById("amount-error").textContent = "Please enter a valid amount.";
    hasError = true;
  }

  if (!dateValue) {
    document.getElementById("date-error").textContent = "Please select a date.";
    hasError = true;
  }

  if (hasError) return;

  const date = new Date(dateValue);
  if (timeValue) {
    const [hours, minutes] = timeValue.split(":").map(Number);
    date.setUTCHours(hours, minutes, 0, 0);
  } else {
    const now = new Date();
    date.setUTCHours(now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds(), 0);
  }

  const newTransaction = {
    category,
    amount: amount.toFixed(2),
    date: date.toISOString()
  };

  try {
    const response = await fetch("http://localhost:5000/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTransaction)
    });

    if (!response.ok) {
      if (response.status === 429) {
        document.getElementById("category-error").textContent = "Too many requests. Please try again later.";
        return;
      }
      throw new Error(`Failed to add transaction: ${response.status}`);
    }

    await fetchTransactions();
    closeExpenseForm();
    window.dispatchEvent(new Event('transactionAdded'));
  } catch (error) {
    console.error("Error adding transaction:", error);
    document.getElementById("category-error").textContent = "Failed to add expense. Please try again.";
  }
}

function openExpenseForm() {
  const form = document.getElementById("expense-form");
  if (form) {
    form.style.display = "block";
    populateCategories();
    clearFormErrors();
  }
}

function closeExpenseForm() {
  const form = document.getElementById("expense-form");
  if (!form) {
    console.error("Expense form not found");
    return;
  }

  form.style.display = "none";

  const inputs = [
    { id: "category-select", value: "" },
    { id: "new-category", value: "" },
    { id: "amount", value: "" },
    { id: "date", value: "" },
    { id: "time", value: "" }
  ];

  inputs.forEach(input => {
    const element = document.getElementById(input.id);
    if (element) element.value = input.value;
  });

  const newCategoryInput = document.getElementById("new-category-input");
  if (newCategoryInput) newCategoryInput.style.display = "none";

  clearFormErrors();
}

document.addEventListener("DOMContentLoaded", async () => {
  transactionsTable = document.getElementById("transactions-body");
  viewAllBtn = document.getElementById("view-all-btn");

  if (viewAllBtn) {
    viewAllBtn.addEventListener("click", () => {
      showingAll = !showingAll;
      displayTransactions(showingAll);
    });
  }

  await fetchTransactions();
});

window.addEventListener('transactionAdded', async () => {
  if (window.location.pathname.includes('budget.html')) {
    await fetchTransactionsForBudget();
    updateTable();
  }
});

// Notification Functions
function addNotification(message) {
  const notificationList = document.getElementById('notificationList');
  const notifications = JSON.parse(localStorage.getItem('notifications') || '[]');
  notifications.push(message);
  localStorage.setItem('notifications', JSON.stringify(notifications));

  const li = document.createElement('li');
  li.textContent = message;
  notificationList.appendChild(li);
}

function toggleNotifications() {
  const panel = document.getElementById('notificationPanel');
  panel.classList.toggle('show-panel');
}

function clearNotifications() {
  localStorage.removeItem('notifications');
  document.getElementById('notificationList').innerHTML = '';
}