document.addEventListener("DOMContentLoaded", function () {
  let charts = {};

  async function fetchReportData() {
    try {
      showLoader();
      const today = new Date("2025-04-28"); // Ensure correct date
      const fromDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10); // 2025-04-01
      const toDate = today.toISOString().slice(0, 10); // 2025-04-28
      console.log(`Fetching data for range: ${fromDate} to ${toDate}`);
      const response = await fetch(
        `http://localhost:5000/api/reports/summary?from=${fromDate}&to=${toDate}`,
        { headers: { "Content-Type": "application/json" } }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      console.log("Fetched Data:", data);
      return data;
    } catch (error) {
      console.error("Fetch Error:", error);
      showErrorMessage(`Failed to load report data: ${error.message}`);
      return null;
    } finally {
      hideLoader();
    }
  }

  function updateSummaries(data) {
    console.log("Summary Data:", data);
    const elements = {
      prevDay: document.getElementById("prev-day-expenses"),
      todaysTotal: document.getElementById("todays-total-expense"),
      totalMonthly: document.getElementById("total-monthly-expense"),
      totalIncome: document.getElementById("total-income"), // Kept for UI consistency, but will show 0
    };
    if (!data || Object.values(elements).some(el => !el)) {
      Object.values(elements).forEach(el => el && (el.textContent = "₹0"));
      return;
    }
    elements.prevDay.textContent = data.prevDayExpenses !== undefined
      ? `₹${parseFloat(data.prevDayExpenses || 0).toLocaleString('en-IN')}`
      : "₹0";
    elements.todaysTotal.textContent = data.todaysTotalExpense !== undefined
      ? `₹${parseFloat(data.todaysTotalExpense || 0).toLocaleString('en-IN')}`
      : "₹0";
    elements.totalMonthly.textContent = data.totalMonthlyExpense !== undefined
      ? `₹${parseFloat(data.totalMonthlyExpense || 0).toLocaleString('en-IN')}`
      : "₹0";
    elements.totalIncome.textContent = "₹0"; // Force to 0 since income is removed
  }

  function initializeCharts(data) {
    console.log("Chart Data:", data);
    Object.values(charts).forEach(chart => chart?.destroy());
    charts = {};

    if (!data || Object.keys(data).length === 0) {
      showErrorMessage("No data to display.");
      return;
    }

    // Daily Expenses
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
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '₹' + value.toLocaleString('en-IN');
              }
            }
          }
        },
        plugins: { legend: { display: false } },
      },
    });
    console.log("Daily Expenses Data:", data.dailyExpenses);

    // Weekly Expenses
    const weeklyExpenses = data.weekly?.map(w => w.expenses) || [0];
    console.log("Weekly Chart - Expenses:", weeklyExpenses);
    charts.weekly = new Chart(document.getElementById("weeklyChart"), {
      type: "bar",
      data: {
        labels: data.weekly?.length ? data.weekly.map(w => w.week) : ["No Data"],
        datasets: [
          { label: "Expenses (₹)", data: weeklyExpenses, backgroundColor: "#dc3545" },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '₹' + value.toLocaleString('en-IN');
              }
            }
          },
          x: {
            ticks: {
              autoSkip: false,
              maxRotation: 45,
              minRotation: 45
            }
          }
        },
      },
    });

    // Monthly Expenses
    const monthlyExpenses = data.monthly?.map(m => m.expenses) || [0];
    console.log("Monthly Chart - Expenses:", monthlyExpenses);
    charts.monthly = new Chart(document.getElementById("monthlyChart"), {
      type: "bar",
      data: {
        labels: data.monthly?.length ? data.monthly.map(m => m.month) : ["No Data"],
        datasets: [
          { label: "Expenses (₹)", data: monthlyExpenses, backgroundColor: "#dc3545" },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '₹' + value.toLocaleString('en-IN');
              }
            }
          },
          x: {
            ticks: {
              autoSkip: false,
              maxRotation: 45,
              minRotation: 45
            }
          }
        },
      },
    });

    // Yearly Expenses
    const yearlyExpenses = data.yearly?.map(y => y.expenses) || [0];
    console.log("Yearly Chart - Expenses:", yearlyExpenses);
    charts.yearly = new Chart(document.getElementById("yearlyChart"), {
      type: "bar",
      data: {
        labels: data.yearly?.length ? data.yearly.map(y => y.year) : ["No Data"],
        datasets: [
          { label: "Expenses (₹)", data: yearlyExpenses, backgroundColor: "#dc3545" },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '₹' + value.toLocaleString('en-IN');
              }
            }
          },
          x: {
            ticks: {
              autoSkip: false,
              maxRotation: 45,
              minRotation: 45
            }
          }
        },
      },
    });

    // Category Breakdown
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
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '₹' + value.toLocaleString('en-IN');
              }
            }
          }
        },
        plugins: { legend: { position: "right" } },
      },
    });
    console.log("Category Breakdown Data:", data.categories);

    // Trend Analysis (Expenses only)
    charts.trend = new Chart(document.getElementById("trendChart"), {
      type: "line",
      data: {
        labels: data.trends?.length ? data.trends.map(t => t.month) : ["No Data"],
        datasets: [{
          label: "Expenses (₹)",
          data: data.trends?.length ? data.trends.map(t => t.net) : [0], // Use net as positive expenses
          borderColor: "#dc3545",
          fill: false,
        }],
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '₹' + value.toLocaleString('en-IN');
              }
            }
          }
        },
      },
    });
    console.log("Trend Analysis Data:", data.trends);
  }

  async function loadData() {
    const data = await fetchReportData();
    if (data) {
      initializeCharts(data);
      updateSummaries(data);
      showInfoMessage("Data loaded successfully!");
    } else {
      initializeCharts({});
      updateSummaries({});
    }
  }

  window.downloadReport = async function (format) {
    const today = new Date("2025-04-28");
    const fromDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const toDate = today.toISOString().slice(0, 10);

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

  // Load data on page load
  loadData();
  loadNotifications();
});