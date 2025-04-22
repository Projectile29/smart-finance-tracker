document.addEventListener("DOMContentLoaded", function () {
  let charts = {};

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
      const data = await response.json();
      console.log("API Response:", data);
      return data;
    } catch (error) {
      console.error("Fetch Error:", error);
      showErrorMessage(`Failed to load report data: ${error.message}`);
      return null;
    } finally {
      hideLoader();
    }
  }

  function initializeCharts(data) {
    Object.values(charts).forEach(chart => chart?.destroy());
    charts = {};

    if (!data || Object.keys(data).length === 0) {
      showErrorMessage("No data to display.");
      return;
    }

    // Daily Expenses (Bar chart with time)
    charts.dailyExpenses = new Chart(document.getElementById("dailyExpensesChart"), {
      type: "bar",
      data: {
        labels: data.dailyExpenses?.length ? data.dailyExpenses.map(d => d.time) : ["No Data"],
        datasets: [{
          label: "Today's Expenses (₹)",
          data: data.dailyExpenses?.length ? data.dailyExpenses.map(d => d.amount) : [0],
          backgroundColor: "#dc3545",
        }],
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true } },
        plugins: { legend: { display: false } },
      },
    });

    // Weekly Expenses & Income (Bar chart)
    const weeklyExpenses = data.weekly?.map(w => w.expenses) || [0];
    const weeklyIncome = data.weekly?.map(w => w.income) || [0];
    const hasIncome = weeklyIncome.some(v => v > 0);
    charts.weekly = new Chart(document.getElementById("weeklyChart"), {
      type: "bar",
      data: {
        labels: data.weekly?.length ? data.weekly.map(w => w.week) : ["No Data"],
        datasets: [
          {
            label: "Expenses (₹)",
            data: weeklyExpenses,
            backgroundColor: "#dc3545",
          },
          ...(hasIncome ? [{
            label: "Income (₹)",
            data: weeklyIncome,
            backgroundColor: "#28a745",
          }] : []),
        ],
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true } },
      },
    });

    // Monthly Expenses & Income (Bar chart)
    const monthlyExpenses = data.monthly?.map(m => m.expenses) || [0];
    const monthlyIncome = data.monthly?.map(m => m.income) || [0];
    const hasMonthlyIncome = monthlyIncome.some(v => v > 0);
    charts.monthly = new Chart(document.getElementById("monthlyChart"), {
      type: "bar",
      data: {
        labels: data.monthly?.length ? data.monthly.map(m => m.month) : ["No Data"],
        datasets: [
          {
            label: "Expenses (₹)",
            data: monthlyExpenses,
            backgroundColor: "#dc3545",
          },
          ...(hasMonthlyIncome ? [{
            label: "Income (₹)",
            data: monthlyIncome,
            backgroundColor: "#28a745",
          }] : []),
        ],
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true } },
      },
    });

    // Yearly Expenses & Income (Bar chart)
    const yearlyExpenses = data.yearly?.map(y => y.expenses) || [0];
    const yearlyIncome = data.yearly?.map(y => y.income) || [0];
    const hasYearlyIncome = yearlyIncome.some(v => v > 0);
    charts.yearly = new Chart(document.getElementById("yearlyChart"), {
      type: "bar",
      data: {
        labels: data.yearly?.length ? data.yearly.map(y => y.year) : ["No Data"],
        datasets: [
          {
            label: "Expenses (₹)",
            data: yearlyExpenses,
            backgroundColor: "#dc3545",
          },
          ...(hasYearlyIncome ? [{
            label: "Income (₹)",
            data: yearlyIncome,
            backgroundColor: "#28a745",
          }] : []),
        ],
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true } },
      },
    });

    // Category Breakdown (Bar chart)
    charts.category = new Chart(document.getElementById("categoryChart"), {
      type: "bar",
      data: {
        labels: data.categories?.length ? data.categories.map(c => c.category) : ["No Data"],
        datasets: [{
          label: "Amount (₹)",
          data: data.categories?.length ? data.categories.map(c => c.amount) : [0],
          backgroundColor: data.categories?.length
            ? ["#dc3545", "#28a745", "#ffc107", "#17a2b8", "#6f42c1"]
            : ["#ccc"],
        }],
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true } },
        plugins: { legend: { position: "right" } },
      },
    });

    // Trend Analysis (Line chart)
    charts.trend = new Chart(document.getElementById("trendChart"), {
      type: "line",
      data: {
        labels: data.trends?.length ? data.trends.map(t => t.month) : ["No Data"],
        datasets: [{
          label: "Net Cash Flow (₹)",
          data: data.trends?.length ? data.trends.map(t => t.net) : [0],
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

  function updateSummaries(data) {
    if (!data) return;
    document.getElementById("prev-day-expenses").textContent =
      data.prevDayExpenses !== undefined
        ? `₹${parseFloat(data.prevDayExpenses || 0).toLocaleString('en-IN')}`
        : "₹0";
    document.getElementById("todays-total-expense").textContent =
      data.todaysTotalExpense !== undefined
        ? `₹${parseFloat(data.todaysTotalExpense || 0).toLocaleString('en-IN')}`
        : "₹0";
    document.getElementById("total-monthly-expense").textContent =
      data.totalMonthlyExpense !== undefined
        ? `₹${parseFloat(data.totalMonthlyExpense || 0).toLocaleString('en-IN')}`
        : "₹0";
    document.getElementById("total-income").textContent =
      data.totalIncome !== undefined
        ? `₹${parseFloat(data.totalIncome || 0).toLocaleString('en-IN')}`
        : "₹0";
  }

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
    } else {
      initializeCharts({});
      updateSummaries({});
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