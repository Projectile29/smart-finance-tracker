document.addEventListener("DOMContentLoaded", function () {
  let charts = {};

  async function fetchTransactions() {
    try {
      const response = await fetch(`http://localhost:5000/transactions?_=${Date.now()}`, {
        headers: { "Content-Type": "application/json" },
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const transactions = await response.json();
      console.log("Fetched Transactions for Client-Side Aggregation:", transactions);
      return transactions;
    } catch (error) {
      console.error("Error fetching transactions:", error);
      showErrorMessage(`Failed to load transaction data: ${error.message}`);
      return [];
    }
  }

  async function fetchBudgets(month) {
    try {
      const response = await fetch(`http://localhost:5000/budgets?month=${month}&_=${Date.now()}`, {
        headers: { "Content-Type": "application/json" },
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching budgets:", error);
      return [];
    }
  }

  async function aggregateTransactions(transactions, fromDate, toDate) {
    const today = new Date(toDate);
    today.setUTCHours(0, 0, 0, 0);
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const prevDayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const prevDayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    console.log("Aggregation Date Ranges:", {
      todayStart: todayStart.toISOString(),
      todayEnd: todayEnd.toISOString(),
      fromDate,
      toDate
    });

    const filteredTransactions = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate >= new Date(fromDate) && txDate <= new Date(toDate);
    });

    const todayTransactions = filteredTransactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate >= todayStart && txDate < todayEnd;
    });
    console.log("Today's Transactions:", todayTransactions);

    const todaysTotalExpense = todayTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);

    const prevDayExpenses = filteredTransactions
      .filter(tx => new Date(tx.date) >= prevDayStart && new Date(tx.date) < prevDayEnd)
      .reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);

    const totalMonthlyExpense = filteredTransactions
      .filter(tx => new Date(tx.date) >= monthStart && new Date(tx.date) <= monthEnd)
      .reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);

    const dailyExpenses = todayTransactions
      .reduce((acc, tx) => {
        const time = new Date(tx.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const existing = acc.find(d => d.time === time);
        if (existing) {
          existing.amount += parseFloat(tx.amount || 0);
        } else {
          acc.push({ time, amount: parseFloat(tx.amount || 0) });
        }
        return acc;
      }, [])
      .sort((a, b) => a.time.localeCompare(b.time));

    const weekly = filteredTransactions.reduce((acc, tx) => {
      const date = new Date(tx.date);
      const year = date.getFullYear();
      const week = Math.floor((date.getDate() + 6 - date.getDay()) / 7) + 1;
      const key = `Week ${week} ${year}`;
      acc[key] = (acc[key] || { week: key, expenses: 0 });
      acc[key].expenses += parseFloat(tx.amount || 0);
      return acc;
    }, {});
    const weeklyArray = Object.values(weekly).sort((a, b) => a.week.localeCompare(b.week));

    const monthly = filteredTransactions.reduce((acc, tx) => {
      const month = new Date(tx.date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      acc[month] = (acc[month] || { month, expenses: 0 });
      acc[month].expenses += parseFloat(tx.amount || 0);
      return acc;
    }, {});
    const monthlyArray = Object.values(monthly).sort((a, b) => new Date(a.month) - new Date(b.month));

    const yearStart = new Date(today.getFullYear(), 0, 1);
    const yearEnd = new Date(today.getFullYear() + 1, 0, 0);
    const yearlyTransactions = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate >= yearStart && txDate <= yearEnd;
    });
    const yearly = yearlyTransactions.reduce((acc, tx) => {
      const year = new Date(tx.date).getFullYear().toString();
      acc[year] = (acc[year] || { year, expenses: 0 });
      acc[year].expenses += parseFloat(tx.amount || 0);
      return acc;
    }, {});
    const yearlyArray = Object.values(yearly).sort((a, b) => a.year - b.year);

    const categories = filteredTransactions.reduce((acc, tx) => {
      const category = tx.category || "Uncategorized";
      acc[category] = (acc[category] || { category, amount: 0 });
      acc[category].amount += parseFloat(tx.amount || 0);
      return acc;
    }, {});
    const categoriesArray = Object.values(categories).sort((a, b) => b.amount - a.amount);

    const prevMonthsStart = new Date(today.getFullYear(), today.getMonth() - 3, 1);
    const prevMonthsEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
    const prevMonthsTransactions = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate >= prevMonthsStart && txDate <= prevMonthsEnd;
    });

    const previousMonthsByCategory = prevMonthsTransactions.reduce((acc, tx) => {
      const month = new Date(tx.date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      const category = tx.category || "Uncategorized";
      if (!acc[month]) {
        acc[month] = { month, categories: {} };
      }
      acc[month].categories[category] = (acc[month].categories[category] || 0) + parseFloat(tx.amount || 0);
      return acc;
    }, {});
    const previousMonthsByCategoryArray = Object.values(previousMonthsByCategory)
      .sort((a, b) => new Date(a.month) - new Date(b.month))
      .map(item => ({
        month: item.month,
        categories: Object.entries(item.categories)
          .map(([category, amount]) => ({ category, amount }))
          .sort((a, b) => b.amount - a.amount),
      }));

    return {
      dailyExpenses,
      weekly: weeklyArray,
      monthly: monthlyArray,
      yearly: yearlyArray,
      categories: categoriesArray,
      previousMonthsByCategory: previousMonthsByCategoryArray,
      prevDayExpenses,
      todaysTotalExpense,
      totalMonthlyExpense,
      totalExpenses: filteredTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0)
    };
  }

  async function generatePreviousMonthReport() {
    try {
      showLoader();
      const today = new Date();
      const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
      const fromDate = prevMonthStart.toISOString().slice(0, 10);
      const toDate = prevMonthEnd.toISOString().slice(0, 10);
      const monthStr = prevMonthStart.toISOString().slice(0, 7);

      const transactions = await fetchTransactions();
      const budgets = await fetchBudgets(monthStr);
      const aggregatedData = await aggregateTransactions(transactions, fromDate, toDate);

      const report = {
        month: prevMonthStart.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
        totalExpenses: aggregatedData.totalExpenses,
        categories: aggregatedData.categories,
        budgetComparison: budgets.map(budget => ({
          category: budget.name,
          budgeted: budget.budget,
          spent: budget.spent,
          overBudget: budget.spent > budget.budget ? budget.spent - budget.budget : 0
        })),
        transactions: transactions
          .filter(tx => {
            const txDate = new Date(tx.date);
            return txDate >= prevMonthStart && txDate <= prevMonthEnd;
          })
          .map(tx => ({
            transactionId: tx.transactionId,
            date: new Date(tx.date).toLocaleDateString('en-IN'),
            time: new Date(tx.date).toLocaleTimeString('en-IN'),
            category: tx.category,
            amount: parseFloat(tx.amount).toFixed(2)
          }))
      };

      return report;
    } catch (error) {
      console.error("Error generating previous month report:", error);
      showErrorMessage(`Failed to generate previous month report: ${error.message}`);
      return null;
    } finally {
      hideLoader();
    }
  }

  async function generateCurrentMonthReportIfFirst() {
    const today = new Date();
    if (today.getDate() !== 1) return;

    try {
      showLoader();
      const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
      const fromDate = prevMonthStart.toISOString().slice(0, 10);
      const toDate = prevMonthEnd.toISOString().slice(0, 10);
      const monthStr = prevMonthStart.toISOString().slice(0, 7);

      const response = await fetch(
        `http://localhost:5000/api/reports/summary?from=${fromDate}&to=${toDate}&_=${Date.now()}`,
        {
          headers: { "Content-Type": "application/json" },
          cache: "no-store"
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      const budgets = await fetchBudgets(monthStr);

      const report = {
        month: prevMonthStart.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
        totalExpenses: data.totalExpenses,
        categories: data.categories,
        budgetComparison: budgets.map(budget => ({
          category: budget.name,
          budgeted: budget.budget,
          spent: budget.spent,
          overBudget: budget.spent > budget.budget ? budget.spent - budget.budget : 0
        }))
      };

      showInfoMessage(`Current month report for ${report.month} generated successfully!`);
      downloadReportAsCSV(report, `current_month_report_${monthStr}`);
    } catch (error) {
      console.error("Error generating current month report:", error);
      showErrorMessage(`Failed to generate current month report: ${error.message}`);
    } finally {
      hideLoader();
    }
  }

  function downloadReportAsCSV(report, filename) {
    let csvContent = `Month,${report.month}\n\n`;
    csvContent += `Total Expenses,₹${report.totalExpenses.toLocaleString('en-IN')}\n\n`;
    csvContent += "Category Expenses\n";
    csvContent += "Category,Amount (₹)\n";
    report.categories.forEach(cat => {
      csvContent += `${cat.category},${cat.amount.toLocaleString('en-IN')}\n`;
    });
    csvContent += "\nBudget Comparison\n";
    csvContent += "Category,Budgeted (₹),Spent (₹),Over Budget (₹)\n";
    report.budgetComparison.forEach(b => {
      csvContent += `${b.category},${b.budgeted.toLocaleString('en-IN')},${b.spent.toLocaleString('en-IN')},${b.overBudget.toLocaleString('en-IN')}\n`;
    });
    if (report.transactions) {
      csvContent += "\nTransactions\n";
      csvContent += "Transaction ID,Date,Time,Category,Amount (₹)\n";
      report.transactions.forEach(tx => {
        csvContent += `${tx.transactionId},${tx.date},${tx.time},${tx.category},${tx.amount}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  async function fetchReportData() {
    try {
      showLoader();
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const fromDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      const toDate = today.toISOString().slice(0, 10);
      console.log(`Fetching data for range: ${fromDate} to ${toDate}`);

      const response = await fetch(
        `http://localhost:5000/api/reports/summary?from=${fromDate}&to=${toDate}&_=${Date.now()}`,
        {
          headers: { "Content-Type": "application/json" },
          cache: "no-store"
        }
      );
      if (response.ok) {
        const data = await response.json();
        console.log("Fetched Server Data:", data);
        return data;
      }

      console.warn("Server aggregation failed, using client-side aggregation");
      const transactions = await fetchTransactions();
      const aggregatedData = await aggregateTransactions(transactions, fromDate, toDate);
      console.log("Client Aggregated Data:", aggregatedData);
      return aggregatedData;
    } catch (error) {
      console.error("Fetch Error:", error);
      showErrorMessage(`Failed to load report data: ${error.message}`);
      return null;
    } finally {
      hideLoader();
    }
  }

  async function fetchAvailableMonths() {
    try {
      const response = await fetch(`http://localhost:5000/api/reports/available-months?_=${Date.now()}`, {
        headers: { "Content-Type": "application/json" },
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const months = await response.json();
      return months;
    } catch (error) {
      console.error("Error fetching available months:", error);
      showErrorMessage(`Failed to load available months: ${error.message}`);
      return [];
    }
  }

  function updateSummaries(data) {
    console.log("Summary Data:", data);
    const elements = {
      prevDay: document.getElementById("prev-day-expenses"),
      todaysTotal: document.getElementById("todays-total-expense"),
      totalMonthly: document.getElementById("total-monthly-expense"),
      totalIncome: document.getElementById("total-income"),
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
    elements.totalIncome.textContent = "₹0";
  }

  function initializeCharts(data) {
    console.log("Chart Data:", data);
    Object.values(charts).forEach(chart => chart?.destroy());
    charts = {};

    if (!data || Object.keys(data).length === 0) {
      showErrorMessage("No data to display.");
      return;
    }

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

    charts.weekly = new Chart(document.getElementById("weeklyChart"), {
      type: "bar",
      data: {
        labels: data.weekly?.length ? data.weekly.map(w => w.week) : ["No Data"],
        datasets: [
          { label: "Expenses (₹)", data: data.weekly?.length ? data.weekly.map(w => w.expenses) : [0], backgroundColor: "#dc3545" },
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

    charts.monthly = new Chart(document.getElementById("monthlyChart"), {
      type: "bar",
      data: {
        labels: data.monthly?.length ? data.monthly.map(m => m.month) : ["No Data"],
        datasets: [
          { label: "Expenses (₹)", data: data.monthly?.length ? data.monthly.map(m => m.expenses) : [0], backgroundColor: "#dc3545" },
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

    charts.yearly = new Chart(document.getElementById("yearlyChart"), {
      type: "bar",
      data: {
        labels: data.yearly?.length ? data.yearly.map(y => y.year) : ["No Data"],
        datasets: [
          { label: "Expenses (₹)", data: data.yearly?.length ? data.yearly.map(y => y.expenses) : [0], backgroundColor: "#dc3545" },
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

    if (data.previousMonthsByCategory?.length) {
      const allCategories = [...new Set(data.previousMonthsByCategory.flatMap(month =>
        month.categories.map(c => c.category)
      ))];

      const datasets = allCategories.map((category, index) => ({
        label: category,
        data: data.previousMonthsByCategory.map(month => {
          const cat = month.categories.find(c => c.category === category);
          return cat ? cat.amount : 0;
        }),
        backgroundColor: ["#dc3545", "#28a745", "#ffc107", "#17a2b8", "#6f42c1"][index % 5],
        stack: 'Stack 0',
      }));

      charts.previousMonthsByCategory = new Chart(document.getElementById("previousMonthsByCategoryChart"), {
        type: "bar",
        data: {
          labels: data.previousMonthsByCategory.map(m => m.month),
          datasets: datasets,
        },
        options: {
          responsive: true,
          scales: {
            x: {
              stacked: true,
              ticks: {
                autoSkip: false,
                maxRotation: 45,
                minRotation: 45
              }
            },
            y: {
              stacked: true,
              beginAtZero: true,
              ticks: {
                callback: function(value) {
                  return '₹' + value.toLocaleString('en-IN');
                }
              }
            }
          },
          plugins: {
            legend: {
              position: "top"
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const datasetLabel = context.dataset.label || '';
                  const value = context.parsed.y;
                  return `${datasetLabel}: ₹${value.toLocaleString('en-IN')}`;
                }
              }
            }
          }
        },
      });
    } else {
      charts.previousMonthsByCategory = new Chart(document.getElementById("previousMonthsByCategoryChart"), {
        type: "bar",
        data: {
          labels: ["No Data"],
          datasets: [{
            label: "Expenses (₹)",
            data: [0],
            backgroundColor: "#ccc",
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
          }
        },
      });
    }
  }

  async function loadData() {
    const syncButton = document.querySelector(".sync-button button");
    if (syncButton) {
      syncButton.disabled = true;
      syncButton.innerHTML = '<i class="fas fa-arrows-rotate fa-spin"></i> Syncing...';
    }
    try {
      await generateCurrentMonthReportIfFirst();
      const data = await fetchReportData();
      if (data) {
        initializeCharts(data);
        updateSummaries(data);
        showInfoMessage("Data loaded successfully!");
      } else {
        initializeCharts({});
        updateSummaries({});
      }
    } finally {
      if (syncButton) {
        syncButton.disabled = false;
        syncButton.innerHTML = '<i class="fas fa-arrows-rotate"></i> Sync Data';
      }
    }
  }

  async function populateMonthSelect() {
    const months = await fetchAvailableMonths();
    const select = document.getElementById("monthSelect");
    select.innerHTML = '<option value="">Select a Month</option>';
    months.forEach(month => {
      const option = document.createElement("option");
      option.value = month;
      option.textContent = new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      select.appendChild(option);
    });
  }

  window.openDownloadPopup = function() {
    const popup = document.getElementById("downloadPopup");
    popup.style.display = "block";
    document.getElementById("backdrop").classList.add("active");
    populateMonthSelect();
  };

  window.closeDownloadPopup = function() {
    const popup = document.getElementById("downloadPopup");
    popup.style.display = "none";
    document.getElementById("backdrop").classList.remove("active");
  };

  window.downloadSelectedReport = async function(format) {
    const month = document.getElementById("monthSelect").value;
    if (!month) {
      showErrorMessage("Please select a month.");
      return;
    }

    try {
      showLoader();
      const fromDate = month + "-01";
      const toDate = new Date(month + "-01");
      toDate.setMonth(toDate.getMonth() + 1);
      toDate.setDate(0);
      toDate = toDate.toISOString().slice(0, 10);

      if (month === new Date().toISOString().slice(0, 7)) {
        const response = await fetch(
          `http://localhost:5000/api/reports/summary?from=${fromDate}&to=${toDate}&_=${Date.now()}`,
          {
            headers: { "Content-Type": "application/json" },
            cache: "no-store"
          }
        );
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        const budgets = await fetchBudgets(month);
        const report = {
          month: new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
          totalExpenses: data.totalExpenses,
          categories: data.categories,
          budgetComparison: budgets.map(budget => ({
            category: budget.name,
            budgeted: budget.budget,
            spent: budget.spent,
            overBudget: budget.spent > budget.budget ? budget.spent - budget.budget : 0
          }))
        };
        if (format === 'csv') {
          downloadReportAsCSV(report, `report_${month}`);
        } else {
          const response = await fetch(
            `http://localhost:5000/api/reports/download?from=${fromDate}&to=${toDate}&format=${format}&_=${Date.now()}`,
            {
              headers: { "Content-Type": "application/json" },
              cache: "no-store"
            }
          );
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `report_${month}.${format}`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
        }
      } else {
        const report = await generatePreviousMonthReport();
        if (!report) throw new Error("Failed to generate report");
        if (format === 'csv') {
          downloadReportAsCSV(report, `report_${month}`);
        } else {
          const response = await fetch(
            `http://localhost:5000/api/reports/download?from=${fromDate}&to=${toDate}&format=${format}&_=${Date.now()}`,
            {
              headers: { "Content-Type": "application/json" },
              cache: "no-store"
            }
          );
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `report_${month}.${format}`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
        }
      }
      showInfoMessage(`Downloaded ${format.toUpperCase()} report for ${month} successfully!`);
      closeDownloadPopup();
    } catch (error) {
      showErrorMessage(`Failed to download report: ${error.message}`);
    } finally {
      hideLoader();
    }
  };

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
    if (notificationList) {
      notificationList.innerHTML = "";
      const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
      notifications.forEach(notification => {
        const li = document.createElement("li");
        li.textContent = notification;
        notificationList.appendChild(li);
      });
    }
  }

  window.addNotification = function (message) {
    const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
    notifications.push(message);
    localStorage.setItem("notifications", JSON.stringify(notifications));
    loadNotifications();
  };

  window.clearNotifications = function () {
    localStorage.removeItem("notifications");
    loadNotifications();
  };

  function showLoader() {
    const container = document.querySelector(".container");
    const loader = document.createElement("div");
    loader.className = "loader";
    container?.prepend(loader);
  }

  function hideLoader() {
    const loader = document.querySelector(".loader");
    if (loader) loader.remove();
  }

  function showErrorMessage(message) {
    const div = document.createElement("div");
    div.className = "error-message";
    div.textContent = message;
    document.querySelector(".container")?.prepend(div);
    setTimeout(() => div.remove(), 5000);
  }

  function showInfoMessage(message) {
    const div = document.createElement("div");
    div.className = "info-message";
    div.textContent = message;
    document.querySelector(".container")?.prepend(div);
    setTimeout(() => div.remove(), 3000);
  }

  window.addEventListener('transactionAdded', () => {
    if (window.location.pathname.includes('reports.html')) {
      console.log("Transaction added, refreshing reports...");
      syncData();
    }
  });

  // Toggle Dark Mode
  window.toggleDarkMode = function () {
    document.body.classList.toggle('dark');
  };

  loadData();
  loadNotifications();
});