document.getElementById("addGoalBtn").addEventListener("click", function () {
  document.getElementById("goalModal").style.display = "block";
});

document.querySelector(".close").addEventListener("click", function () {
  document.getElementById("goalModal").style.display = "none";
});

// Fetch and Display Goals
async function fetchGoals() {
  try {
      const response = await fetch("http://localhost:5000/goals");
      const goals = await response.json();
      const goalsContainer = document.getElementById("goalsContainer");

      goalsContainer.innerHTML = ""; // Clear previous entries

      goals.forEach(goal => {
          const goalCard = document.createElement("div");
          goalCard.classList.add("goal-card");

          goalCard.innerHTML = `
              <h3>${goal.name} 
                  <span class="edit-icon"><i class="fas fa-edit"></i></span> 
                  <span class="delete-icon" data-id="${goal._id}"><i class="fas fa-trash"></i></span>
              </h3>
              <p><strong>Target Amount:</strong> ₹${goal.targetAmount}</p>
              <p><strong>Current Savings:</strong> ₹<span class="current-savings">${goal.currentSavings}</span></p>
              <div class="progress-bar"><div class="progress" style="width: ${(goal.currentSavings / goal.targetAmount) * 100}%"></div></div>
          `;

          goalsContainer.appendChild(goalCard);
      });

      // Attach delete event listeners after rendering elements
      document.querySelectorAll(".delete-icon").forEach(button => {
          button.addEventListener("click", async (e) => {
              const goalId = e.target.closest(".delete-icon").dataset.id;
              await deleteGoal(goalId);
          });
      });

  } catch (error) {
      console.error("Error fetching goals:", error);
  }
}

// Delete Goal
async function deleteGoal(goalId) {
  if (!goalId) return;

  document.getElementById("deleteModal").style.display = "block";

  document.getElementById("confirmDelete").onclick = async function () {
      try {
          await fetch(`http://localhost:5000/goals/${goalId}`, { method: "DELETE" });
          document.getElementById("deleteModal").style.display = "none";
          fetchGoals();
      } catch (error) {
          console.error("Error deleting goal:", error);
      }
  };

  document.getElementById("cancelDelete").onclick = function () {
      document.getElementById("deleteModal").style.display = "none";
  };
}

// Add Goal
document.getElementById("saveGoalBtn").onclick = async function () {
  const name = document.getElementById("goalName").value.trim();
  const targetAmount = parseInt(document.getElementById("targetAmount").value, 10);
  const currentSavings = parseInt(document.getElementById("currentSavings").value, 10);

  if (!name || isNaN(targetAmount) || isNaN(currentSavings)) {
      alert("Please enter valid details.");
      return;
  }

  const newGoal = { name, targetAmount, currentSavings };

  try {
      await fetch("http://localhost:5000/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newGoal),
      });

      document.getElementById("goalModal").style.display = "none";
      fetchGoals();
  } catch (error) {
      console.error("Error adding goal:", error);
  }
};

// Initial Load
document.addEventListener("DOMContentLoaded", fetchGoals);

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

