// Global Variables
let transactions = [];
let totalAmount = 0;
let showingAll = false;
let transactionsTable;
let viewAllBtn;

// Fetch transactions from server and update the UI
async function fetchTransactions() {
    try {
        const response = await fetch("http://localhost:5000/transactions");
        transactions = (await response.json()).sort((a, b) => new Date(b.date) - new Date(a.date));

        totalAmount = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
        displayTransactions(false);
        updateTotalExpensesUI();

        if (viewAllBtn) {
            viewAllBtn.style.display = transactions.length > 6 ? "block" : "none";
        }
    } catch (error) {
        console.error("Error fetching transactions:", error);
    }
}

// Function to display transactions
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

// Function to format date properly
function formatDate(dateString) {
    const date = new Date(dateString);
    return isNaN(date) ? "Invalid Date" : date.toLocaleDateString("en-GB");
}

// Function to update total expenses UI
function updateTotalExpensesUI() {
    const totalExpensesTable = document.querySelector(".total-expenses tbody");
    if (totalExpensesTable) {
        totalExpensesTable.innerHTML = transactions.length > 0
            ? `<tr><td><strong>Total</strong></td><td></td><td><strong>₹${totalAmount.toFixed(2)}</strong></td></tr>`
            : "<tr><td colspan='3' style='text-align:center;'>No transactions found</td></tr>";
    }
}

// Add Expense
async function addExpense() {
    let category = document.getElementById("category").value;
    let amount = document.getElementById("amount").value;
    let date = document.getElementById("date").value;

    if (!category || !amount || !date) {
        alert("Please fill all fields!");
        return;
    }

    let newTransaction = { category, amount: parseFloat(amount).toFixed(2), date };

    try {
        const response = await fetch("http://localhost:5000/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newTransaction)
        });

        if (response.ok) {
            alert("Transaction added successfully!");
            await fetchTransactions(); // Refresh the transactions list
            closeExpenseForm();
        } else {
            alert("Failed to add transaction!");
        }
    } catch (error) {
        console.error("Error adding transaction:", error);
    }
}



// Notification Panel
function toggleNotifications() {
    let panel = document.getElementById("notificationPanel");
    if (panel) {
        panel.classList.toggle("show-panel");
    }
}

document.addEventListener("click", function (event) {
    let panel = document.getElementById("notificationPanel");
    let bell = document.querySelector(".notification-bell");

    if (panel && bell && !panel.contains(event.target) && !bell.contains(event.target)) {
        panel.classList.remove("show-panel");
    }
});

// Notifications
function loadNotifications() {
    let notificationList = document.getElementById("notificationList");
    if (!notificationList) return;

    notificationList.innerHTML = "";
    let notifications = JSON.parse(localStorage.getItem("notifications")) || [];

    notifications.forEach((notification) => {
        let newItem = document.createElement("li");
        newItem.textContent = notification;
        notificationList.appendChild(newItem);
    });
}

function addNotification(message) {
    let notifications = JSON.parse(localStorage.getItem("notifications")) || [];
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
    let form = document.getElementById("expense-form");
    if (form) form.style.display = "block";
}

function closeExpenseForm() {
    let form = document.getElementById("expense-form");
    if (form) form.style.display = "none";
}

// Wait for the DOM to load before setting event listeners
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
