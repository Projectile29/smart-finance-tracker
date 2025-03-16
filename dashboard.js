document.addEventListener("DOMContentLoaded", async () => {
  const totalExpensesCard = document.querySelector(".dashboard .card:first-child"); 
  const incomeCard = document.getElementById("income-card"); // Use ID for safety

  // ✅ Fetch and update total expenses
  async function fetchTotalExpenses() {
      try {
          console.log("Fetching total expenses...");  // Debug Log

          const response = await fetch("http://localhost:5000/transactions");
          if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);

          const transactions = await response.json();
          console.log("Fetched Transactions:", transactions); // Debug Response
          
          // Ensure transactions have valid amounts
          const totalAmount = transactions.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);

          // Update the Total Expenses card dynamically
          if (totalExpensesCard) {
              totalExpensesCard.innerHTML = `Total Expenses<br>₹${totalAmount.toFixed(2)}`;
          } else {
              console.error("Total Expenses card element not found!");
          }
      } catch (error) {
          console.error("Error fetching total expenses:", error);
          if (totalExpensesCard) {
              totalExpensesCard.innerHTML = "Total Expenses<br>₹0.00"; // Show 0 if error occurs
          }
      }
  }

  // ✅ Fetch and update salary dynamically
  async function fetchAndUpdateSalary() {
      try {
          const userEmail = localStorage.getItem("userEmail");  
          if (!userEmail) {
              console.error("User email not found in local storage!");
              return;
          }

          console.log("Fetching salary for:", userEmail); // ✅ Debug Email

          const response = await fetch(`http://localhost:5000/salary?email=${userEmail}`);
          if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);

          const data = await response.json();
          console.log("Fetched Salary Data:", data); // ✅ Debug Response

          if (data.salary === undefined) {
              console.error("Salary data is undefined!");
              return;
          }

          // Update Income Card
          if (incomeCard) {
              incomeCard.innerHTML = `Income<br>₹${data.salary}`;
          } else {
              console.error("Income card element not found!");
          }
      } catch (error) {
          console.error("Error fetching salary data:", error);
      }
  }

  // ✅ Call functions on page load
  await fetchTotalExpenses(); 
  await fetchAndUpdateSalary();
});

// ✅ Tab Switching Logic
const tabButtons = document.querySelectorAll('.tab-btn');

tabButtons.forEach(button => {
  button.addEventListener('click', () => {
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
  });
});

// ✅ Function to Toggle Notification Panel
function toggleNotifications() {
  let panel = document.getElementById("notificationPanel");
  if (panel) {
      panel.classList.toggle("show-panel");
  }
}

// ✅ Hide Panel When Clicking Outside
document.addEventListener("click", function (event) {
  let panel = document.getElementById("notificationPanel");
  let bell = document.querySelector(".notification-bell");

  if (panel && bell && !panel.contains(event.target) && !bell.contains(event.target)) {
      panel.classList.remove("show-panel");
  }
});

// ✅ Load Notifications from Local Storage
function loadNotifications() {
  let notificationList = document.getElementById("notificationList");
  if (!notificationList) {
      console.error("Notification list element not found!");
      return;
  }

  notificationList.innerHTML = ""; // Clear current list

  let notifications = JSON.parse(localStorage.getItem("notifications")) || [];

  notifications.forEach((notification) => {
      let newItem = document.createElement("li");
      newItem.textContent = notification;
      notificationList.appendChild(newItem);
  });
}

// ✅ Function to Add a New Notification
function addNotification(message) {
  let notifications = JSON.parse(localStorage.getItem("notifications")) || [];
  notifications.push(message); // Add new message
  localStorage.setItem("notifications", JSON.stringify(notifications)); // Save to storage
  loadNotifications(); // Refresh list
}

// ✅ Function to Clear All Notifications
function clearNotifications() {
  localStorage.removeItem("notifications"); // Remove from storage
  loadNotifications(); // Refresh list
}

// ✅ Load Notifications When Page Loads
document.addEventListener("DOMContentLoaded", loadNotifications);

function logoutUser() {
  // Remove user data from storage
  localStorage.removeItem("userEmail");
  localStorage.removeItem("notifications");
  sessionStorage.removeItem("userEmail"); 

  // Redirect to login page
  window.location.href = "login.html";  // Change this to your actual login page
}

// Attach logout function to a button
document.getElementById("logout-btn").addEventListener("click", logoutUser);
