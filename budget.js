let categories = [];
let editingIndex = -1;

function openAddPopup() {
    document.getElementById('addPopup').style.display = 'block';
}

function closeAddPopup() {
    document.getElementById('addPopup').style.display = 'none';
}

function openEditPopup(index) {
    editingIndex = index;
    document.getElementById('editSpentAmount').value = categories[index].spent;
    document.getElementById('editPopup').style.display = 'block';
}

function closeEditPopup() {
    document.getElementById('editPopup').style.display = 'none';
}

function addCategory() {
    const name = document.getElementById('categoryName').value.trim();
    const budget = parseFloat(document.getElementById('categoryBudget').value);

    if (!name || isNaN(budget) || budget <= 0) {
        alert('Please enter valid details!');
        return;
    }

    categories.push({ name, budget, spent: 0 });
    updateTable();
    closeAddPopup();
}

function updateSpent() {
    const spent = parseFloat(document.getElementById('editSpentAmount').value);

    if (isNaN(spent) || spent < 0) {
        alert('Invalid amount');
        return;
    }

    categories[editingIndex].spent = spent;
    updateTable();
    closeEditPopup();
}

function deleteCategory(index) {
    if (confirm("Are you sure you want to delete this category?")) {
        categories.splice(index, 1);
        updateTable();
    }
}

function updateTable() {
    const table = document.getElementById('categoryTable');
    table.innerHTML = '';

    let totalBudget = 0, totalRemaining = 0;

    categories.forEach((cat, index) => {
        const remaining = cat.budget - cat.spent;
        totalBudget += cat.budget;
        totalRemaining += remaining;

        table.innerHTML += `
            <tr>
                <td>${cat.name}</td>
                <td>₹${cat.budget}</td>
                <td>₹${cat.spent}</td>
                <td>₹${remaining}</td>
                <td>
                    <i class="fas fa-edit edit-icon" onclick="openEditPopup(${index})"></i>
                    <i class="fas fa-trash delete-icon" onclick="deleteCategory(${index})"></i>
                </td>
            </tr>`;
    });

    document.getElementById('totalBudget').innerText = totalBudget.toFixed(2);
    document.getElementById('totalRemaining').innerText = totalRemaining.toFixed(2);
}

document.addEventListener('DOMContentLoaded', updateTable);

// Function to Toggle Notification Panel
function toggleNotifications() {
    let panel = document.getElementById("notificationPanel");
    panel.classList.toggle("show-panel");
}

// Hide Panel When Clicking Outside
document.addEventListener("click", function (event) {
    let panel = document.getElementById("notificationPanel");
    let bell = document.querySelector(".notification-bell");

    if (!panel.contains(event.target) && !bell.contains(event.target)) {
        panel.classList.remove("show-panel");
    }
});

// Load Notifications from Local Storage
function loadNotifications() {
    let notificationList = document.getElementById("notificationList");
    notificationList.innerHTML = ""; // Clear current list

    let notifications = JSON.parse(localStorage.getItem("notifications")) || [];

    notifications.forEach((notification) => {
        let newItem = document.createElement("li");
        newItem.textContent = notification;
        notificationList.appendChild(newItem);
    });
}

// Function to Add a New Notification
function addNotification(message) {
    let notifications = JSON.parse(localStorage.getItem("notifications")) || [];

    notifications.push(message); // Add new message
    localStorage.setItem("notifications", JSON.stringify(notifications)); // Save to storage

    loadNotifications(); // Refresh list
}

// Function to Clear All Notifications
function clearNotifications() {
    localStorage.removeItem("notifications"); // Remove from storage
    loadNotifications(); // Refresh list
}

// Load Notifications When Page Loads
document.addEventListener("DOMContentLoaded", loadNotifications);
