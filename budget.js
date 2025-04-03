let transactions = [];

document.addEventListener("DOMContentLoaded", async () => {
    await fetchTransactionsForBudget();
    await updateTable();
});

// Popup Functions
function openAddPopup() {
    document.getElementById('addPopup').style.display = 'block';
}

function closeAddPopup() {
    document.getElementById('addPopup').style.display = 'none';
    document.getElementById('categoryName').value = '';
    document.getElementById('categoryBudget').value = '';
}

function openEditPopup(budgetId) {
    console.log("Opening edit popup for budgetId:", budgetId); // Debug ID
    const editPopup = document.getElementById('editPopup');
    if (!editPopup) {
        console.error("Edit popup element not found");
        return;
    }

    fetch(`http://localhost:5000/budgets/${budgetId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                throw new Error(`HTTP error! Status: ${response.status}, Response: ${text}`);
            });
        }
        return response.json();
    })
    .then(budget => {
        console.log("Fetched budget:", budget); // Debug response
        const editSpentInput = document.getElementById('editSpentAmount');
        if (!editSpentInput) {
            console.error("editSpentAmount input not found");
            return;
        }
        editSpentInput.value = budget.spent || 0;
        editPopup.dataset.budgetId = budgetId;
        editPopup.style.display = 'block';
    })
    .catch(error => {
        console.error("Error fetching budget for edit:", error.message);
        alert(`Unable to load budget data: ${error.message}`);
    });
}

function closeEditPopup() {
    const editPopup = document.getElementById('editPopup');
    if (editPopup) editPopup.style.display = 'none';
}

// Add Category (POST to /budgets)
function addCategory() {
    const name = document.getElementById('categoryName').value.trim();
    const budget = parseFloat(document.getElementById('categoryBudget').value);

    if (!name || isNaN(budget) || budget <= 0) {
        alert('Please enter valid details!');
        return;
    }

    fetch('http://localhost:5000/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, budget, spent: 0 })
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to add budget');
        return response.json();
    })
    .then(() => {
        updateTable();
        closeAddPopup();
    })
    .catch(error => {
        console.error("Error adding budget:", error);
        alert('Failed to add category');
    });
}

// Update Spent Amount (PUT to /budgets/:id)
function updateSpent() {
    const editPopup = document.getElementById('editPopup');
    const spent = parseFloat(document.getElementById('editSpentAmount').value);
    const budgetId = editPopup.dataset.budgetId;

    if (isNaN(spent) || spent < 0) {
        alert('Invalid amount');
        return;
    }

    fetch(`http://localhost:5000/budgets/${budgetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spent })
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to update spent amount');
        return response.json();
    })
    .then(() => {
        updateTable();
        closeEditPopup();
    })
    .catch(error => {
        console.error("Error updating spent:", error);
        alert('Failed to update spent amount');
    });
}

// Fetch Transactions and Update Budget Spent
async function fetchTransactionsForBudget() {
    try {
        const response = await fetch('http://localhost:5000/transactions');
        if (!response.ok) throw new Error('Network response was not ok');
        transactions = await response.json();

        const spentByCategory = transactions.reduce((acc, tx) => {
            acc[tx.category] = (acc[tx.category] || 0) + parseFloat(tx.amount);
            return acc;
        }, {});

        const budgetsResponse = await fetch('http://localhost:5000/budgets');
        const budgets = await budgetsResponse.json();

        for (const budget of budgets) {
            const newSpent = spentByCategory[budget.name] || budget.spent || 0;
            if (newSpent !== budget.spent) {
                await fetch(`http://localhost:5000/budgets/${budget._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ spent: newSpent })
                });
            }
        }
    } catch (error) {
        console.error("Error fetching transactions:", error);
    }
}

// Delete Category
function deleteCategory(budgetId) {
    const row = document.querySelector(`tr[data-budget-id="${budgetId}"]`);
    const categoryName = row ? row.querySelector('td:first-child').textContent : '';
    const hasExpenses = transactions.some(tx => tx.category === categoryName);

    if (hasExpenses) {
        alert("You cannot delete this category because there are transactions linked to it.");
        return;
    }

    if (confirm("Are you sure you want to delete this category?")) {
        fetch(`http://localhost:5000/budgets/${budgetId}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to delete budget');
            updateTable();
        })
        .catch(error => {
            console.error("Error deleting budget:", error);
            alert('Failed to delete category');
        });
    }
}

// Update Table with Budget Data
async function updateTable() {
    await fetchTransactionsForBudget();
    const table = document.getElementById('categoryTable');
    table.innerHTML = '';

    let totalBudget = 0, totalRemaining = 0;

    try {
        const response = await fetch('http://localhost:5000/budgets');
        if (!response.ok) throw new Error('Failed to fetch budgets');
        const budgets = await response.json();

        budgets.forEach(budget => {
            const remaining = budget.budget - budget.spent;
            totalBudget += budget.budget;
            totalRemaining += remaining;

            if (budget.spent > budget.budget) {
                addNotification(`Warning: ${budget.name} has exceeded its budget by ₹${(budget.spent - budget.budget).toFixed(2)}!`);
            }

            const row = `
                <tr data-budget-id="${budget._id}">
                    <td>${budget.name}</td>
                    <td>₹${budget.budget.toFixed(2)}</td>
                    <td>₹${budget.spent.toFixed(2)}</td>
                    <td>₹${remaining.toFixed(2)}</td>
                    <td>
                        <button onclick="openEditPopup('${budget._id}')">Edit</button>
                        <button onclick="deleteCategory('${budget._id}')">Delete</button>
                    </td>
                </tr>
            `;
            table.innerHTML += row;
        });

        document.getElementById('totalBudget').innerText = totalBudget.toFixed(2);
        document.getElementById('totalRemaining').innerText = totalRemaining.toFixed(2);
    } catch (error) {
        console.error("Error updating table:", error);
        table.innerHTML = '<tr><td colspan="5">Error loading budgets</td></tr>';
    }
}

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

window.addEventListener('transactionAdded', async () => {
    await updateTable();
});