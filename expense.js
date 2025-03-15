document.addEventListener("DOMContentLoaded", async () => {
  const transactionsTable = document.getElementById("transactions-body");
  const totalExpensesTable = document.querySelector(".total-expenses tbody"); // Select total expenses table
  const viewAllBtn = document.getElementById("view-all-btn");

  let transactions = []; // Store transactions globally
  let showingAll = false; // Track state
  let totalAmount = 0; // Variable to store total expense

  // Fetch transactions from server
  async function fetchTransactions() {
      try {
          const response = await fetch("http://localhost:5000/transactions");
          transactions = (await response.json()).sort((a, b) => new Date(b.date) - new Date(a.date));

          // Calculate total expenses
          totalAmount = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);

          // Display only the latest 6 transactions initially
          displayTransactions(false);

          // Update Total Expenses Table
          totalExpensesTable.innerHTML = transactions.length > 0 ? `
              <tr>
                  <td colspan="2"><strong>Total</strong></td>
                  <td><strong>₹${totalAmount.toFixed(2)}</strong></td>
              </tr>` : "<tr><td colspan='3'>No transactions found</td></tr>";

          // Hide "View All" button if transactions are 6 or fewer
          if (viewAllBtn) {
              viewAllBtn.style.display = transactions.length > 6 ? "block" : "none";
          }
      } catch (error) {
          console.error("Error fetching transactions:", error);
      }
  }

  // Function to display transactions
  function displayTransactions(showAll) {
      const visibleTransactions = showAll ? transactions : transactions.slice(0, 6); // Show all or limit to 6

      transactionsTable.innerHTML = visibleTransactions.length > 0 ? visibleTransactions
          .map(tx => `
              <tr>
                  <td>${tx.transactionId || "N/A"}</td>
                  <td>${formatDate(tx.date)}</td>
                  <td>${tx.category}</td>
                  <td>₹${parseFloat(tx.amount || 0).toFixed(2)}</td>
              </tr>`).join("") : "<tr><td colspan='4'>No transactions available</td></tr>";

      // Change button text
      if (viewAllBtn) {
          viewAllBtn.textContent = showAll ? "Show Less" : "View All";
      }
  }

  // Function to format date (dd-mm-yyyy)
  function formatDate(dateString) {
      const date = new Date(dateString);
      return isNaN(date) ? "Invalid Date" : date.toLocaleDateString("en-GB"); // Converts to dd-mm-yyyy
  }

  // Toggle transactions view
  if (viewAllBtn) {
      viewAllBtn.addEventListener("click", () => {
          showingAll = !showingAll;
          displayTransactions(showingAll);
      });
  }

  // Initial fetch
  fetchTransactions();
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
