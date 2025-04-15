document.addEventListener("DOMContentLoaded", function () {
    // Chart instances
    let charts = {};
  
    // Fetch data from API
    async function fetchReportData(fromDate, toDate, type = "both") {
      try {
        showLoader();
        const response = await fetch(
          `http://localhost:5000/api/reports/summary?from=${fromDate}&to=${toDate}&type=${type}`,
          { headers: { "Content-Type": "application/json" } }
        );
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        showErrorMessage(`Failed to load report data: ${error.message}`);
        return null;
      } finally {
        hideLoader();
      }
    }
  
    // Initialize Charts
    function initializeCharts(data) {
      // Destroy existing charts to prevent canvas reuse errors
      Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
      });
      charts = {};
  
      if (!data) {
        showErrorMessage("No data to display.");
        return;
      }
  
      // Daily Expenses (Bar Chart)
      charts.dailyExpenses = new Chart(document.getElementById("dailyExpensesChart"), {
        type: "bar",
        data: {
          labels: data.dailyExpenses.length ? data.dailyExpenses.map(d => d.date) : ["No Data"],
          datasets: [{
            label: "Daily Expenses (₹)",
            data: data.dailyExpenses.length ? data.dailyExpenses.map(d => d.amount) : [0],
            backgroundColor: "#dc3545",
          }],
        },
        options: {
          responsive: true,
          scales: { y: { beginAtZero: true } },
          plugins: { legend: { display: false } },
        },
      });
  
      // Weekly Expenses & Income (Line Chart)
      charts.weekly = new Chart(document.getElementById("weeklyChart"), {
        type: "line",
        data: {
          labels: data.weekly.length ? data.weekly.map(w => w.week) : ["No Data"],
          datasets: [
            {
              label: "Expenses (₹)",
              data: data.weekly.length ? data.weekly.map(w => w.expenses) : [0],
              borderColor: "#dc3545",
              fill: false,
            },
            {
              label: "Income (₹)",
              data: data.weekly.length ? data.weekly.map(w => w.income) : [0],
              borderColor: "#28a745",
              fill: false,
            },
          ],
        },
        options: {
          responsive: true,
          scales: { y: { beginAtZero: true } },
        },
      });
  
      // Monthly Expenses & Income (Line Chart)
      charts.monthly = new Chart(document.getElementById("monthlyChart"), {
        type: "line",
        data: {
          labels: data.monthly.length ? data.monthly.map(m => m.month) : ["No Data"],
          datasets: [
            {
              label: "Expenses (₹)",
              data: data.monthly.length ? data.monthly.map(m => m.expenses) : [0],
              borderColor: "#dc3545",
              fill: false,
            },
            {
              label: "Income (₹)",
              data: data.monthly.length ? data.monthly.map(m => m.income) : [0],
              borderColor: "#28a745",
              fill: false,
            },
          ],
        },
        options: {
          responsive: true,
          scales: { y: { beginAtZero: true } },
        },
      });
  
      // Yearly Expenses & Income (Bar Chart)
      charts.yearly = new Chart(document.getElementById("yearlyChart"), {
        type: "bar",
        data: {
          labels: data.yearly.length ? data.yearly.map(y => y.year) : ["No Data"],
          datasets: [
            {
              label: "Expenses (₹)",
              data: data.yearly.length ? data.yearly.map(y => y.expenses) : [0],
              backgroundColor: "#dc3545",
            },
            {
              label: "Income (₹)",
              data: data.yearly.length ? data.yearly.map(y => y.income) : [0],
              backgroundColor: "#28a745",
            },
          ],
        },
        options: {
          responsive: true,
          scales: { y: { beginAtZero: true } },
        },
      });
  
      // Category Breakdown (Pie Chart)
      charts.category = new Chart(document.getElementById("categoryChart"), {
        type: "pie",
        data: {
          labels: data.categories.length ? data.categories.map(c => c.category) : ["No Data"],
          datasets: [{
            data: data.categories.length ? data.categories.map(c => c.amount) : [1],
            backgroundColor: data.categories.length
              ? ["#dc3545", "#28a745", "#ffc107", "#17a2b8", "#6f42c1"]
              : ["#ccc"],
          }],
        },
        options: {
          responsive: true,
          plugins: { legend: { position: "right" } },
        },
      });
  
      // Trend Analysis (Line Chart)
      charts.trend = new Chart(document.getElementById("trendChart"), {
        type: "line",
        data: {
          labels: data.trends.length ? data.trends.map(t => t.month) : ["No Data"],
          datasets: [{
            label: "Net Cash Flow (₹)",
            data: data.trends.length ? data.trends.map(t => t.net) : [0],
            borderColor: "#007bff",
            fill: false,
          }],
        },
        options: {
          responsive: true,
          scales: { y: { beginAtZero: false } },
        },
      });
    }
  
    // Update Summary Cards
    function updateSummaries(data) {
      document.getElementById("prev-day-expenses").textContent = data && data.prevDayExpenses !== undefined
        ? `₹${Math.round(data.prevDayExpenses)}`
        : "₹0";
      document.getElementById("total-expenses").textContent = data && data.totalExpenses !== undefined
        ? `₹${Math.round(data.totalExpenses)}`
        : "₹0";
      document.getElementById("total-income").textContent = data && data.totalIncome !== undefined
        ? `₹${Math.round(data.totalIncome)}`
        : "₹0";
    }
  
    // Apply Filters
    window.applyFilters = async function () {
      const fromDate = document.getElementById("from-date").value;
      const toDate = document.getElementById("to-date").value;
      const reportType = document.getElementById("report-type").value || "both";
  
      if (!fromDate || !toDate) {
        showErrorMessage("Please select both From and To dates.");
        return;
      }
  
      const data = await fetchReportData(fromDate, toDate, reportType);
      if (data) {
        initializeCharts(data);
        updateSummaries(data);
        showInfoMessage("Filters applied successfully!");
      }
    };
  
    // Download Report
    window.downloadReport = async function (format) {
      const fromDate = document.getElementById("from-date").value;
      const toDate = document.getElementById("to-date").value;
  
      if (!fromDate || !toDate) {
        showErrorMessage("Please select a date range to download the report.");
        return;
      }
  
      try {
        showLoader();
        const response = await fetch(
          `http://localhost:5000/api/reports/download?from=${fromDate}&to=${toDate}&format=${format}`,
          { headers: { "Content-Type": "application/json" } }
        );
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `report.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showInfoMessage(`Downloaded ${format.toUpperCase()} report successfully!`);
      } catch (error) {
        showErrorMessage(`Failed to download report: ${error.message}`);
      } finally {
        hideLoader();
      }
    };
  
    // Notification Functions
    window.toggleNotifications = function () {
      document.getElementById("notificationPanel").classList.toggle("show-panel");
    };
  
    document.addEventListener("click", function (event) {
      const panel = document.getElementById("notificationPanel");
      const bell = document.querySelector(".notification-bell");
      if (!panel.contains(event.target) && !bell.contains(event.target)) {
        panel.classList.remove("show-panel");
      }
    });
  
    function loadNotifications() {
      const notificationList = document.getElementById("notificationList");
      notificationList.innerHTML = "";
      const notifications = JSON.parse(localStorage.getItem("notifications")) || [];
      notifications.forEach(notification => {
        const li = document.createElement("li");
        li.textContent = notification;
        notificationList.appendChild(li);
      });
    }
  
    window.addNotification = function (message) {
      const notifications = JSON.parse(localStorage.getItem("notifications")) || [];
      notifications.push(message);
      localStorage.setItem("notifications", JSON.stringify(notifications));
      loadNotifications();
    };
  
    window.clearNotifications = function () {
      localStorage.removeItem("notifications");
      loadNotifications();
    };
  
    // UI Helpers
    function showLoader() {
      const container = document.querySelector(".container");
      const loader = document.createElement("div");
      loader.className = "loader";
      container.prepend(loader);
    }
  
    function hideLoader() {
      const loader = document.querySelector(".loader");
      if (loader) loader.remove();
    }
  
    function showErrorMessage(message) {
      const div = document.createElement("div");
      div.className = "error-message";
      div.textContent = message;
      document.querySelector(".container").prepend(div);
      setTimeout(() => div.remove(), 5000);
    }
  
    function showInfoMessage(message) {
      const div = document.createElement("div");
      div.className = "info-message";
      div.textContent = message;
      document.querySelector(".container").prepend(div);
      setTimeout(() => div.remove(), 3000);
    }
  
    // Initialize with default date range (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    document.getElementById("from-date").value = thirtyDaysAgo.toISOString().slice(0, 10);
    document.getElementById("to-date").value = today.toISOString().slice(0, 10);
    document.getElementById("report-type").value = "both";
    applyFilters();
    loadNotifications();
  });