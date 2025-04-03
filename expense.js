let transactions = [];
let totalAmount = 0;
let showingAll = false;
let transactionsTable;
let viewAllBtn;

// Retry delay helper (exponential backoff)
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchTransactions(retryCount = 3, delayMs = 1000) {
    try {
        const response = await fetch("http://localhost:5000/transactions");
        if (!response.ok) {
            if (response.status === 429 && retryCount > 0) {
                console.log(`429 Too Many Requests - Retrying in ${delayMs}ms... (${retryCount} retries left)`);
                await delay(delayMs);
                return fetchTransactions(retryCount - 1, delayMs * 2); // Exponential backoff
            }
            throw new Error(`Server responded with status ${response.status}`);
        }

        const data = await response.json();
        transactions = data.sort((a, b) => new Date(b.date) - new Date(a.date));
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
    const visibleTransactions = showAll ? transactions : transactions.slice(0, 6);

    if (transactionsTable) {
        transactionsTable.innerHTML = visibleTransactions.length > 0
            ? visibleTransactions.map(tx => `
                <tr>
                    <td>${tx.transactionId || "N/A"}</td>
                    <td>${formatDate(tx.date)}</td>
                    <td>${tx.category}</td>
                    <td>₹${parseFloat(tx.amount || 0).toFixed(2)}</td>
                </tr>`).join("")
            : "<tr><td colspan='4'>No transactions available</td></tr>";
    }

    if (viewAllBtn) {
        viewAllBtn.textContent = showAll ? "Show Less" : "View All";
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return isNaN(date) ? "Invalid Date" : date.toLocaleDateString("en-GB");
}

function updateTotalExpensesUI() {
    const totalExpensesTable = document.querySelector(".total-expenses tbody");
    if (totalExpensesTable) {
        totalExpensesTable.innerHTML = transactions.length > 0
            ? `<tr><td><strong>Total</strong></td><td></td><td><strong>₹${totalAmount.toFixed(2)}</strong></td></tr>`
            : "<tr><td colspan='3' style='text-align:center;'>No transactions found</td></tr>";
    }
}

async function addExpense() {
    const category = document.getElementById("category").value.trim();
    const amount = parseFloat(document.getElementById("amount").value);
    const date = document.getElementById("date").value;

    if (!category || isNaN(amount) || !date) {
        alert("Please fill all fields!");
        return;
    }

    const newTransaction = { category, amount: amount.toFixed(2), date };

    try {
        const response = await fetch("http://localhost:5000/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newTransaction)
        });

        if (!response.ok) {
            if (response.status === 429) {
                addNotification("Too many requests. Please wait before adding more expenses.");
                return;
            }
            throw new Error("Failed to add transaction");
        }

        alert("Transaction added successfully!");
        await fetchTransactions(); // Refresh transactions
        closeExpenseForm();
        window.dispatchEvent(new Event('transactionAdded'));
    } catch (error) {
        console.error("Error adding transaction:", error);
        alert("Failed to add transaction!");
    }
}

// Notification Functions
function toggleNotifications() {
    const panel = document.getElementById("notificationPanel");
    if (panel) panel.classList.toggle("show-panel");
}

document.addEventListener("click", function (event) {
    const panel = document.getElementById("notificationPanel");
    const bell = document.querySelector(".notification-bell");
    if (panel && bell && !panel.contains(event.target) && !bell.contains(event.target)) {
        panel.classList.remove("show-panel");
    }
});

function loadNotifications() {
    const notificationList = document.getElementById("notificationList");
    if (!notificationList) return;

    notificationList.innerHTML = "";
    const notifications = JSON.parse(localStorage.getItem("notifications")) || [];
    notifications.forEach(notification => {
        const newItem = document.createElement("li");
        newItem.textContent = notification;
        notificationList.appendChild(newItem);
    });
}

function addNotification(message) {
    const notifications = JSON.parse(localStorage.getItem("notifications")) || [];
    notifications.push(message);
    localStorage.setItem("notifications", JSON.stringify(notifications));
    loadNotifications();
}

function clearNotifications() {
    localStorage.removeItem("notifications");
    loadNotifications();
}

// Expense Form
function openExpenseForm() {
    const form = document.getElementById("expense-form");
    if (form) form.style.display = "block";
}

function closeExpenseForm() {
    const form = document.getElementById("expense-form");
    if (form) {
        form.style.display = "none";
        document.getElementById("category").value = "";
        document.getElementById("amount").value = "";
        document.getElementById("date").value = "";
    }
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
    loadNotifications();
});

window.addEventListener('transactionAdded', async () => {
    if (window.location.pathname.includes('budget.html')) {
        await fetchTransactionsForBudget();
        updateTable();
    }
});