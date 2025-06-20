let transactions = [];

// Define income categories to exclude
const incomeCategories = ['Salary', 'Freelance', 'Investment'];

document.addEventListener("DOMContentLoaded", async () => {
    await fetchTransactions();
    await createCategoriesFromTransactions();
    await updateTable();
});

// Popup Functions
function openAddPopup() {
    document.getElementById('addPopup').style.display = 'block';
    document.getElementById('backdrop').classList.add('active');
}

function closeAddPopup() {
    document.getElementById('addPopup').style.display = 'none';
    document.getElementById('backdrop').classList.remove('active');
    document.getElementById('categoryName').value = '';
    document.getElementById('categoryBudget').value = '';
}

function openEditPopup(budgetId) {
    console.log("Opening edit popup for budgetId:", budgetId);
    const editPopup = document.getElementById('editPopup');
    if (!editPopup) {
        console.error("Edit popup element not found");
        return;
    }

    document.getElementById('backdrop').classList.add('active');

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
        console.log("Fetched budget:", budget);
        const editBudgetInput = document.getElementById('editBudgetAmount');
        const editSpentInput = document.getElementById('editSpentAmount');
        if (!editBudgetInput || !editSpentInput) {
            console.error("Edit inputs not found");
            return;
        }
        editBudgetInput.value = budget.budget || 0;
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
    if (editPopup) {
        editPopup.style.display = 'none';
        document.getElementById('backdrop').classList.remove('active');
    }
}

// Add Category (POST to /budgets) with Sync
function addCategory() {
    const name = document.getElementById('categoryName').value.trim();
    const budget = parseFloat(document.getElementById('categoryBudget').value);

    if (!name || isNaN(budget) || budget <= 0 || incomeCategories.includes(name)) {
        alert('Please enter valid details or avoid income categories!');
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
    .then(async () => {
        await fetchTransactions();
        await syncBudgetsWithTransactions();
        closeAddPopup();
    })
    .catch(error => {
        console.error("Error adding budget:", error);
        alert('Failed to add category');
    });
}

// Update Budget and Spent Amount (PUT to /budgets/:id)
function updateBudget() {
    const editPopup = document.getElementById('editPopup');
    const budget = parseFloat(document.getElementById('editBudgetAmount').value);
    const spent = parseFloat(document.getElementById('editSpentAmount').value);
    const budgetId = editPopup.dataset.budgetId;

    if (isNaN(budget) || budget < 0 || isNaN(spent) || spent < 0) {
        alert('Invalid budget or spent amount');
        return;
    }

    fetch(`http://localhost:5000/budgets/${budgetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget, spent })
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to update budget');
        return response.json();
    })
    .then(() => {
        updateTable();
        closeEditPopup();
    })
    .catch(error => {
        console.error("Error updating budget:", error);
        alert('Failed to update budget');
    });
}

// Fetch Transactions
async function fetchTransactions() {
    try {
        const response = await fetch('http://localhost:5000/transactions');
        if (!response.ok) throw new Error('Network response was not ok');
        transactions = await response.json();
        console.log("Fetched transactions:", transactions.map(tx => ({ date: tx.date, category: tx.category })));
    } catch (error) {
        console.error("Error fetching transactions:", error);
    }
}

// Create Budget Categories from Transactions
async function createCategoriesFromTransactions() {
    try {
        const transactionCategories = [...new Set(transactions.map(tx => tx.category))]
            .filter(category => !incomeCategories.includes(category));
        const currentMonth = new Date().toISOString().slice(0, 7);
        const budgetsResponse = await fetch('http://localhost:5000/budgets');
        if (!budgetsResponse.ok) throw new Error('Failed to fetch budgets');
        const budgets = await budgetsResponse.json();
        const existingCategories = budgets.map(budget => budget.name);
        const categoriesToCreate = transactionCategories.filter(category => !existingCategories.includes(category));

        for (const category of categoriesToCreate) {
            await fetch('http://localhost:5000/budgets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: category, budget: 0, spent: 0, month: currentMonth })
            });
        }
        await syncBudgetsWithTransactions();
    } catch (error) {
        console.error("Error creating categories from transactions:", error);
    }
}

// Sync Budgets with Transactions
async function syncBudgetsWithTransactions() {
    try {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999);

        const currentMonthTransactions = transactions.filter(tx => {
            const txDate = new Date(tx.date);
            return txDate >= monthStart && txDate <= monthEnd && !incomeCategories.includes(tx.category);
        });

        const spentByCategory = currentMonthTransactions.reduce((acc, tx) => {
            acc[tx.category] = (acc[tx.category] || 0) + parseFloat(tx.amount);
            return acc;
        }, {});

        const budgetsResponse = await fetch('http://localhost:5000/budgets');
        if (!budgetsResponse.ok) throw new Error('Failed to fetch budgets');
        const budgets = await budgetsResponse.json();

        // Get all unique categories from transactions
        const transactionCategories = [...new Set(transactions.map(tx => tx.category))]
            .filter(category => !incomeCategories.includes(category));

        // Recreate deleted categories that have transactions
        const existingCategoryNames = budgets.map(b => b.name);
        for (const category of transactionCategories) {
            if (!existingCategoryNames.includes(category)) {
                await fetch('http://localhost:5000/budgets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: category, budget: 0, spent: 0, month: currentMonth })
                });
            }
        }

        for (const budget of budgets) {
            if (!incomeCategories.includes(budget.name)) {
                const newSpent = spentByCategory[budget.name] || 0;
                if (newSpent !== budget.spent) {
                    await fetch(`http://localhost:5000/budgets/${budget._id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ budget: budget.budget, spent: newSpent })
                    });
                }
            }
        }
        await updateTable();
    } catch (error) {
        console.error("Error syncing budgets with transactions:", error);
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

// Update Table with Budget Data, Sorted by Latest Transaction
async function updateTable() {
    const table = document.getElementById('categoryTable');
    table.innerHTML = '';

    let totalBudget = 0, totalRemaining = 0;

    try {
        const response = await fetch('http://localhost:5000/budgets');
        if (!response.ok) throw new Error('Failed to fetch budgets');
        let budgets = await response.json();

        // Filter out income categories and deduplicate by _id
        budgets = budgets.filter(budget => !incomeCategories.includes(budget.name));
        budgets = Array.from(new Map(budgets.map(b => [b._id, b])).values());

        const latestTransactionDates = {};
        transactions.forEach(tx => {
            if (!incomeCategories.includes(tx.category)) {
                const txDate = new Date(tx.date).getTime();
                if (!latestTransactionDates[tx.category] || txDate > latestTransactionDates[tx.category]) {
                    latestTransactionDates[tx.category] = txDate;
                }
            }
        });
        console.log("Latest transaction dates by category:", latestTransactionDates);

        budgets.sort((a, b) => {
            const dateA = latestTransactionDates[a.name] || 0;
            const dateB = latestTransactionDates[b.name] || 0;
            return dateB - dateA;
        });
        console.log("Sorted budgets:", budgets.map(b => ({ name: b.name, latestTransactionDate: latestTransactionDates[b.name] ? new Date(latestTransactionDates[b.name]).toISOString() : 'None' })));

        budgets.forEach(budget => {
            const remaining = Math.max(0, budget.budget - budget.spent);
            totalBudget += budget.budget;
            totalRemaining += remaining;

            if (budget.spent > budget.budget) {
                addNotification(`Warning: ${budget.name} has exceeded its budget by ₹${(budget.spent - budget.budget).toFixed(2)}!`);
            }

            const overspentClass = budget.spent > budget.budget ? 'overspent' : '';
            const row = `
                <tr data-budget-id="${budget._id}" class="${overspentClass}">
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

// Trigger Sync on Transaction Add
window.addEventListener('transactionAdded', async () => {
    console.log("Received transactionAdded event on Budget page");
    await fetchTransactions();
    await createCategoriesFromTransactions();
    await syncBudgetsWithTransactions();
});

// Manual Sync
function manualSync() {
    syncBudgetsWithTransactions();
}

// Toggle Dark Mode
function toggleDarkMode() {
    document.body.classList.toggle('dark');
}