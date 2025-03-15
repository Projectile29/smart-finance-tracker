document.addEventListener("DOMContentLoaded", function () {
    // Sidebar navigation buttons
    const navButtons = document.querySelectorAll(".nav-btn");
    
    navButtons.forEach(button => {
        button.addEventListener("click", function () {
            // Remove active class from all buttons
            navButtons.forEach(btn => btn.classList.remove("active"));
            // Add active class to the clicked button
            this.classList.add("active");

            // Update the content section based on button clicked
            const sectionTitle = document.querySelector(".section-title");
            sectionTitle.textContent = this.textContent + " Reports";
        });
    });

    // Handle report generation
    document.querySelector(".btn-red").addEventListener("click", function () {
        const fromDate = document.getElementById("from-date").value;
        const toDate = document.getElementById("to-date").value;

        if (fromDate && toDate) {
            alert(`Generating report from ${fromDate} to ${toDate}`);
            // Here, you could generate a PDF, fetch report data, etc.
        } else {
            alert("Please select both From and To dates.");
        }
    });
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

