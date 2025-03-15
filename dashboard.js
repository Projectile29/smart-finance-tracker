const tabButtons = document.querySelectorAll('.tab-btn');

tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    tabButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
  });
});

document.addEventListener("DOMContentLoaded", async () => {
  const totalExpensesCard = document.querySelector(".dashboard .card:first-child"); 

  async function fetchTotalExpenses() {
      try {
          const response = await fetch("http://localhost:5000/transactions");
          if (!response.ok) throw new Error("Failed to fetch transactions");

          const transactions = await response.json();
          
          // Ensure transactions have valid amounts
          const totalAmount = transactions.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);

          // Update the Total Expenses card dynamically
          totalExpensesCard.innerHTML = `Total Expenses<br>₹${totalAmount.toFixed(2)}`;
      } catch (error) {
          console.error("Error fetching total expenses:", error);
          totalExpensesCard.innerHTML = "Total Expenses<br>₹0.00"; // Show 0 if error occurs
      }
  }

  fetchTotalExpenses(); 
});

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

addNotification("Test Message 1");
addNotification("Test Message 2");
addNotification("Test Message 3");
addNotification("Test Message 4");