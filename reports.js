document.addEventListener("DOMContentLoaded", function () {
  const App = {
    charts: {},

    // Utility Functions
    showLoader() {
      const container = document.querySelector(".container");
      if (container) {
        const loader = document.createElement("div");
        loader.className = "loader";
        container.prepend(loader);
      }
    },

    hideLoader() {
      const loader = document.querySelector(".loader");
      if (loader) loader.remove();
    },

    showErrorMessage(message) {
      const div = document.createElement("div");
      div.className = "error-message";
      div.textContent = message;
      const container = document.querySelector(".container");
      if (container) {
        container.prepend(div);
        setTimeout(() => div.remove(), 5000);
      }
    },

    showInfoMessage(message) {
      const div = document.createElement("div");
      div.className = "info-message";
      div.textContent = message;
      const container = document.querySelector(".container");
      if (container) {
        container.prepend(div);
        setTimeout(() => div.remove(), 3000);
      }
    },

    // Data Fetching
    async fetchTransactions() {
      try {
        const response = await fetch(`http://localhost:5000/transactions?_=${Date.now()}`, {
          headers: { "Content-Type": "application/json" }
        });
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const transactions = await response.json();
        console.log("All Transactions:", transactions);
        console.log("Income Transactions (Last 3 Months):", transactions.filter(tx => {
          const txDate = new Date(tx.date);
          return txDate >= new Date(2025, 3, 1) && txDate <= new Date() && ["Salary", "Investment", "Freelance"].includes(tx.category);
        }));
        return transactions;
      } catch (error) {
        console.error("Error fetching transactions:", error);
        this.showErrorMessage(`Failed to load transaction data: ${error.message}`);
        return [];
      }
    },

    async fetchBudgets(month) {
      try {
        const response = await fetch(`http://localhost:5000/budgets?month=${month}&_=${Date.now()}`, {
          headers: { "Content-Type": "application/json" }
        });
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        console.error("Error fetching budgets:", error);
        this.showErrorMessage(`Failed to load budget data: ${error.message}`);
        return [];
      }
    },

    async fetchAvailableMonths() {
      try {
        this.showLoader();
        const response = await fetch(`http://localhost:5000/api/reports/available-months?_=${Date.now()}`, {
          headers: { "Content-Type": "application/json" }
        });
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const months = await response.json();
        return months;
      } catch (error) {
        console.error("Error fetching available months:", error);
        this.showErrorMessage(`Failed to load available months: ${error.message}`);
        return [];
      } finally {
        this.hideLoader();
      }
    },

    // Data Aggregation
    async aggregateTransactions(transactions, fromDate, toDate, yearRange = 3) {
      const today = new Date(toDate);
      today.setUTCHours(0, 0, 0, 0);
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      const prevDayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
      const prevDayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

      // Define the range for the last 3 months
      const threeMonthsStart = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      const threeMonthsEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

      // Define the range for the current week and two previous weeks
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay()); // Start of current week (Sunday)
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      const twoWeeksAgoStart = new Date(weekStart);
      twoWeeksAgoStart.setDate(weekStart.getDate() - 14);

      console.log("Aggregation Date Ranges:", {
        todayStart: todayStart.toISOString(),
        todayEnd: todayEnd.toISOString(),
        fromDate,
        toDate,
        threeMonthsStart: threeMonthsStart.toISOString(),
        threeMonthsEnd: threeMonthsEnd.toISOString(),
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        twoWeeksAgoStart: twoWeeksAgoStart.toISOString()
      });

      const filteredTransactions = transactions.filter(tx => {
        const txDate = new Date(tx.date);
        const isValidDate = !isNaN(txDate.getTime());
        const isInRange = isValidDate && txDate >= new Date(fromDate) && txDate <= new Date(toDate);
        console.log(`Transaction: ${tx.date}, Category: ${tx.category}, Amount: ${tx.amount}, In Range: ${isInRange}`);
        return isInRange;
      });

      const incomeCategories = ["Salary", "Investment", "Freelance"];
      const todayTransactions = filteredTransactions.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate >= todayStart && txDate < todayEnd;
      });

      const todayIncome = todayTransactions
        .filter(tx => incomeCategories.includes(tx.category))
        .reduce((sum, tx) => sum + (isNaN(parseFloat(tx.amount)) ? 0 : parseFloat(tx.amount)), 0);
      const todaysTotalExpense = todayTransactions
        .filter(tx => !incomeCategories.includes(tx.category))
        .reduce((sum, tx) => sum + (isNaN(parseFloat(tx.amount)) ? 0 : parseFloat(tx.amount)), 0);

      const prevDayExpenses = filteredTransactions
        .filter(tx => new Date(tx.date) >= prevDayStart && new Date(tx.date) < prevDayEnd && !incomeCategories.includes(tx.category))
        .reduce((sum, tx) => sum + (isNaN(parseFloat(tx.amount)) ? 0 : parseFloat(tx.amount)), 0);

      const totalMonthlyIncome = transactions
        .filter(tx => {
          const txDate = new Date(tx.date);
          return txDate >= monthStart && txDate <= monthEnd && incomeCategories.includes(tx.category);
        })
        .reduce((sum, tx) => sum + (isNaN(parseFloat(tx.amount)) ? 0 : parseFloat(tx.amount)), 0);

      const totalMonthlyExpense = transactions
        .filter(tx => {
          const txDate = new Date(tx.date);
          return txDate >= monthStart && txDate <= monthEnd && !incomeCategories.includes(tx.category);
        })
        .reduce((sum, tx) => sum + (isNaN(parseFloat(tx.amount)) ? 0 : parseFloat(tx.amount)), 0);

      const dailyExpenses = todayTransactions
        .filter(tx => !incomeCategories.includes(tx.category))
        .reduce((acc, tx) => {
          const time = new Date(tx.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
          const existing = acc.find(d => d.time === time);
          const amount = isNaN(parseFloat(tx.amount)) ? 0 : parseFloat(tx.amount);
          if (existing) existing.amount += amount;
          else acc.push({ time, amount });
          return acc;
        }, [])
        .sort((a, b) => a.time.localeCompare(b.time));

      const dailyIncome = todayTransactions
        .filter(tx => incomeCategories.includes(tx.category))
        .reduce((acc, tx) => {
          const time = new Date(tx.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
          const existing = acc.find(d => d.time === time);
          const amount = isNaN(parseFloat(tx.amount)) ? 0 : parseFloat(tx.amount);
          if (existing) existing.amount += amount;
          else acc.push({ time, amount });
          return acc;
        }, [])
        .sort((a, b) => a.time.localeCompare(b.time));
      console.log('Daily Income Array:', dailyIncome);

      // Weekly aggregation (current week + two previous weeks)
      const weekly = {};
      for (let i = 0; i < 3; i++) {
        const weekDate = new Date(weekStart);
        weekDate.setDate(weekStart.getDate() - i * 7);
        const weekEndDate = new Date(weekDate);
        weekEndDate.setDate(weekDate.getDate() + 6);
        const key = weekDate.toISOString().slice(0, 10);
        weekly[key] = {
          week: `Week ${weekDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}–${weekEndDate.toLocaleDateString('en-IN', { day: 'numeric' })}`,
          expenses: 0,
          income: 0
        };
      }
      filteredTransactions.forEach(tx => {
        const date = new Date(tx.date);
        if (date < twoWeeksAgoStart || date > weekEnd) return;
        const weekStartDate = new Date(date);
        weekStartDate.setDate(date.getDate() - date.getDay());
        const key = weekStartDate.toISOString().slice(0, 10);
        if (!weekly[key]) return;
        const amount = isNaN(parseFloat(tx.amount)) ? 0 : parseFloat(tx.amount);
        if (incomeCategories.includes(tx.category)) weekly[key].income += amount;
        else weekly[key].expenses += amount;
      });
      const weeklyArray = Object.values(weekly)
        .sort((a, b) => new Date(a.week.split('–')[0].replace('Week ', '')) - new Date(b.week.split('–')[0].replace('Week ', '')));

      // Monthly aggregation (last 3 months)
      const monthly = {};
      for (let i = 0; i < 3; i++) {
        const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthKey = monthDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
        monthly[monthKey] = { month: monthKey, expenses: 0, income: 0 };
      }
      filteredTransactions.forEach(tx => {
        const date = new Date(tx.date);
        if (date < threeMonthsStart || date > threeMonthsEnd) return;
        const month = date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
        monthly[month] = monthly[month] || { month, expenses: 0, income: 0 };
        const amount = isNaN(parseFloat(tx.amount)) ? 0 : parseFloat(tx.amount);
        if (incomeCategories.includes(tx.category)) monthly[month].income += amount;
        else monthly[month].expenses += amount;
      });
      const monthlyArray = Object.values(monthly)
        .sort((a, b) => new Date('1 ' + a.month) - new Date('1 ' + b.month));

      // Yearly aggregation (last 3 years, including current year)
      const yearly = {};
      for (let i = 0; i < 3; i++) {
        const year = today.getFullYear() - i;
        yearly[year] = { year: year.toString(), expenses: 0, income: 0 };
      }
      filteredTransactions.forEach(tx => {
        const date = new Date(tx.date);
        const year = date.getFullYear().toString();
        if (!yearly[year]) return;
        const amount = isNaN(parseFloat(tx.amount)) ? 0 : parseFloat(tx.amount);
        if (incomeCategories.includes(tx.category)) yearly[year].income += amount;
        else yearly[year].expenses += amount;
      });
      const yearlyArray = Object.values(yearly)
        .sort((a, b) => a.year - b.year);

      const categories = filteredTransactions.reduce((acc, tx) => {
        const category = tx.category || "Uncategorized";
        acc[category] = acc[category] || { category, amount: 0 };
        const amount = isNaN(parseFloat(tx.amount)) ? 0 : parseFloat(tx.amount);
        acc[category].amount += amount;
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
        if (!acc[month]) acc[month] = { month, categories: {} };
        const amount = isNaN(parseFloat(tx.amount)) ? 0 : parseFloat(tx.amount);
        acc[month].categories[category] = (acc[month].categories[category] || 0) + amount;
        return acc;
      }, {});
      const previousMonthsByCategoryArray = Object.values(previousMonthsByCategory)
        .sort((a, b) => new Date('1 ' + a.month) - new Date('1 ' + b.month))
        .map(item => ({
          month: item.month,
          categories: Object.entries(item.categories)
            .map(([category, amount]) => ({ category, amount }))
            .sort((a, b) => b.amount - a.amount),
        }));

      console.log('Filtered income transactions this month:', filteredTransactions.filter(tx => incomeCategories.includes(tx.category)));
      console.log('Monthly Array:', monthlyArray);
      console.log('Weekly Array:', weeklyArray);
      console.log('Yearly Array:', yearlyArray, 'Transaction Count:', filteredTransactions.length);

      return {
        dailyExpenses,
        dailyIncome,
        weekly: weeklyArray,
        monthly: monthlyArray,
        yearly: yearlyArray,
        categories: categoriesArray,
        previousMonthsByCategory: previousMonthsByCategoryArray,
        prevDayExpenses,
        todaysTotalExpense,
        totalMonthlyIncome,
        totalMonthlyExpense,
        totalExpenses: filteredTransactions
          .filter(tx => !incomeCategories.includes(tx.category))
          .reduce((sum, tx) => sum + (isNaN(parseFloat(tx.amount)) ? 0 : parseFloat(tx.amount)), 0),
        totalIncome: filteredTransactions
          .filter(tx => incomeCategories.includes(tx.category))
          .reduce((sum, tx) => sum + (isNaN(parseFloat(tx.amount)) ? 0 : parseFloat(tx.amount)), 0)
      };
    },

    // Report Generation
    async generatePreviousMonthReport() {
      try {
        this.showLoader();
        const today = new Date();
        const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
        const fromDate = prevMonthStart.toISOString().slice(0, 10);
        const toDate = prevMonthEnd.toISOString().slice(0, 10);
        const monthStr = prevMonthStart.toISOString().slice(0, 7);

        const transactions = await this.fetchTransactions();
        const budgets = await this.fetchBudgets(monthStr);
        const aggregatedData = await this.aggregateTransactions(transactions, fromDate, toDate);

        const report = {
          month: prevMonthStart.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
          totalExpenses: aggregatedData.totalExpenses,
          totalIncome: aggregatedData.totalIncome,
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
              transactionId: tx.transactionId || 'N/A',
              date: new Date(tx.date).toLocaleDateString('en-IN'),
              time: new Date(tx.date).toLocaleTimeString('en-IN'),
              category: tx.category || "Uncategorized",
              amount: isNaN(parseFloat(tx.amount)) ? '0.00' : parseFloat(tx.amount).toFixed(2)
            }))
        };

        return report;
      } catch (error) {
        console.error("Error generating previous month report:", error);
        this.showErrorMessage(`Failed to generate previous month report: ${error.message}`);
        return null;
      } finally {
        this.hideLoader();
      }
    },

    async generateCurrentMonthReportIfFirst() {
      const today = new Date();
      if (today.getDate() !== 1) return;

      try {
        this.showLoader();
        const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
        const fromDate = prevMonthStart.toISOString().slice(0, 10);
        const toDate = prevMonthEnd.toISOString().slice(0, 10);
        const monthStr = prevMonthStart.toISOString().slice(0, 7);

        const response = await fetch(
          `http://localhost:5000/api/reports/summary?from=${fromDate}&to=${toDate}&_=${Date.now()}`,
          {
            headers: { "Content-Type": "application/json" }
          }
        );
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        const budgets = await this.fetchBudgets(monthStr);

        const report = {
          month: prevMonthStart.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
          totalExpenses: data.totalExpenses || 0,
          totalIncome: data.totalIncome || 0,
          categories: data.categories || [],
          budgetComparison: budgets.map(budget => ({
            category: budget.name || 'Unknown',
            budgeted: budget.budget || 0,
            spent: budget.spent || 0,
            overBudget: (budget.spent || 0) > (budget.budget || 0) ? (budget.spent - budget.budget) : 0
          }))
        };

        this.showInfoMessage(`Current month report for ${report.month} generated successfully!`);
        this.downloadReportAsCSV(report, `current_month_report_${monthStr}`);
      } catch (error) {
        console.error("Error generating current month report:", error);
        this.showErrorMessage(`Failed to generate current month report: ${error.message}`);
      } finally {
        this.hideLoader();
      }
    },

    downloadReportAsCSV(report, filename) {
      let csvContent = `Month,${report.month}\n\n`;
      csvContent += `Total Income,₹${(report.totalIncome || 0).toLocaleString('en-IN')}\n`;
      csvContent += `Total Expenses,₹${(report.totalExpenses || 0).toLocaleString('en-IN')}\n\n`;
      csvContent += "Category Expenses\n";
      csvContent += "Category,Amount (₹)\n";
      report.categories.forEach(cat => {
        csvContent += `${cat.category},${(cat.amount || 0).toLocaleString('en-IN')}\n`;
      });
      csvContent += "\nBudget Comparison\n";
      csvContent += "Category,Budgeted (₹),Spent (₹),Over Budget (₹)\n";
      report.budgetComparison.forEach(b => {
        csvContent += `${b.category},${(b.budgeted || 0).toLocaleString('en-IN')},${(b.spent || 0).toLocaleString('en-IN')},${(b.overBudget || 0).toLocaleString('en-IN')}\n`;
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
    },

    async fetchReportData() {
      try {
        this.showLoader();
        const today = new Date();
        const fromDate = new Date(today.getFullYear() - 2, 0, 1).toISOString().slice(0, 10);
        const toDate = today.toISOString().slice(0, 10);
        console.log(`Fetching data for range: ${fromDate} to ${toDate}`);

        const response = await fetch(
          `http://localhost:5000/api/reports/summary?from=${fromDate}&to=${toDate}&_=${Date.now()}`,
          {
            headers: { "Content-Type": "application/json" }
          }
        );
        if (response.ok) {
          const data = await response.json();
          console.log("Fetched Server Data:", data);
          if (!data.monthly || !data.weekly || !data.yearly || data.monthly.some(m => m.income === undefined)) {
            console.warn("Server data incomplete, using client-side aggregation");
            const transactions = await this.fetchTransactions();
            return await this.aggregateTransactions(transactions, fromDate, toDate);
          }
          return data;
        }

        console.warn("Server aggregation failed, using client-side aggregation");
        const transactions = await this.fetchTransactions();
        const aggregatedData = await this.aggregateTransactions(transactions, fromDate, toDate);
        console.log("Client Aggregated Data:", aggregatedData);
        return aggregatedData;
      } catch (error) {
        console.error("Fetch Error:", error);
        this.showErrorMessage(`Failed to load report data: ${error.message}`);
        return null;
      } finally {
        this.hideLoader();
      }
    },

    // UI Updates
    updateSummaries(data) {
      console.log("Summary Data:", data);
      const elements = {
        prevDay: document.getElementById("prev-day-expenses"),
        todaysTotal: document.getElementById("todays-total-expense"),
        totalMonthly: document.getElementById("total-monthly-expense"),
        totalIncome: document.getElementById("total-income"),
      };
      if (!data || Object.values(elements).some(el => !el)) {
        Object.values(elements).forEach(el => {
          if (el) el.textContent = "₹0";
        });
        this.showErrorMessage("Summary elements not found or no data available.");
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
      elements.totalIncome.textContent = data.totalMonthlyIncome !== undefined
        ? `₹${parseFloat(data.totalMonthlyIncome || 0).toLocaleString('en-IN')}`
        : "₹0";
    },

    initializeCharts(data) {
      if (!window.Chart) {
        this.showErrorMessage("Chart.js library is not loaded.");
        return;
      }

      Object.values(this.charts).forEach(chart => chart?.destroy());
      this.charts = {};

      if (!data || Object.keys(data).length === 0) {
        this.showErrorMessage("No data to display.");
        return;
      }

      const canvasIds = [
        "dailyExpensesChart",
        "weeklyChart",
        "monthlyChart",
        "yearlyChart",
        "categoryChart",
        "previousMonthsByCategoryChart"
      ];
      for (const id of canvasIds) {
        if (!document.getElementById(id)) {
          this.showErrorMessage(`Canvas element ${id} not found.`);
          return;
        }
      }

      console.log("Chart Data:", {
        monthly: data.monthly,
        weekly: data.weekly,
        yearly: data.yearly,
        dailyExpenses: data.dailyExpenses,
        dailyIncome: data.dailyIncome
      });

      const incomeCategories = ["Salary", "Investment", "Freelance"];
      const nonIncomeColors = ['#dc3545', '#ffc107', '#17a2b8', '#6f42c1', '#fd7e14', '#20c997', '#6610f2']; // Red, Yellow, Cyan, Purple, Orange, Teal, Indigo

      const dailyLabels = [...new Set([
        ...data.dailyExpenses.map(d => d.time),
        ...data.dailyIncome.map(d => d.time)
      ])].sort();

      this.charts.dailyExpenses = new Chart(document.getElementById("dailyExpensesChart"), {
        type: "bar",
        data: {
          labels: dailyLabels.length ? dailyLabels : ["No Data"],
          datasets: [
            {
              label: "Expenses (₹)",
              data: dailyLabels.map(label => {
                const match = data.dailyExpenses.find(d => d.time === label);
                return match ? match.amount : 0;
              }),
              backgroundColor: "#dc3545",
              barPercentage: 0.4
            },
            {
              label: "Income (₹)",
              data: dailyLabels.map(label => {
                const match = data.dailyIncome.find(d => d.time === label);
                return match ? match.amount : 0;
              }),
              backgroundColor: "#28a745",
              barPercentage: 0.4
            }
          ]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: value => '₹' + value.toLocaleString('en-IN')
              }
            },
            x: {
              barPercentage: 0.4
            }
          },
          plugins: {
            legend: { position: "top" }
          }
        }
      });

      this.charts.weekly = new Chart(document.getElementById("weeklyChart"), {
        type: "bar",
        data: {
          labels: data.weekly?.length ? data.weekly.map(w => w.week) : ["No Data"],
          datasets: [
            { label: "Expenses (₹)", data: data.weekly?.map(w => w.expenses) || [0], backgroundColor: "#dc3545", barPercentage: 0.4 },
            { label: "Income (₹)", data: data.weekly?.map(w => w.income) || [0], backgroundColor: "#28a745", barPercentage: 0.4 }
          ]
        },
        options: {
          responsive: true,
          scales: { y: { beginAtZero: true, ticks: { callback: value => '₹' + value.toLocaleString('en-IN') } }, x: { barPercentage: 0.4 } },
          plugins: {
            legend: { position: "top" },
            title: { display: !data.weekly?.length, text: "No Weekly Data Available" }
          }
        }
      });

      this.charts.monthly = new Chart(document.getElementById("monthlyChart"), {
        type: "bar",
        data: {
          labels: data.monthly?.length ? data.monthly.map(m => m.month) : ["No Data"],
          datasets: [
            { label: "Expenses (₹)", data: data.monthly?.map(m => m.expenses) || [0], backgroundColor: "#dc3545", barPercentage: 0.4 },
            { label: "Income (₹)", data: data.monthly?.map(m => m.income) || [0], backgroundColor: "#28a745", barPercentage: 0.4 }
          ]
        },
        options: {
          responsive: true,
          scales: { y: { beginAtZero: true, ticks: { callback: value => '₹' + value.toLocaleString('en-IN') } }, x: { barPercentage: 0.4 } },
          plugins: {
            legend: { position: "top" },
            title: { display: !data.monthly?.length, text: "No Monthly Data Available" }
          }
        }
      });

      this.charts.yearly = new Chart(document.getElementById("yearlyChart"), {
        type: "bar",
        data: {
          labels: data.yearly?.length ? data.yearly.map(y => y.year) : ["No Data"],
          datasets: [
            { label: "Expenses (₹)", data: data.yearly?.map(y => y.expenses) || [0], backgroundColor: "#dc3545", barPercentage: 0.4 },
            { label: "Income (₹)", data: data.yearly?.map(y => y.income) || [0], backgroundColor: "#28a745", barPercentage: 0.4 }
          ]
        },
        options: {
          responsive: true,
          scales: { y: { beginAtZero: true, ticks: { callback: value => '₹' + value.toLocaleString('en-IN') } }, x: { barPercentage: 0.4 } },
          plugins: {
            legend: { position: "top" },
            title: { display: !data.yearly?.length, text: "No Yearly Data Available" }
          }
        }
      });

      this.charts.category = new Chart(document.getElementById("categoryChart"), {
        type: "bar",
        data: {
          labels: data.categories?.length ? data.categories.map(c => c.category) : ["No Data"],
          datasets: [{
            label: "Amount (₹)",
            data: data.categories?.map(c => c.amount) || [0],
            backgroundColor: data.categories?.length
              ? data.categories.map((c, index) => incomeCategories.includes(c.category)
                  ? '#28a745'
                  : nonIncomeColors[index % nonIncomeColors.length])
              : ['#ccc']
          }]
        },
        options: {
          responsive: true,
          scales: { y: { beginAtZero: true, ticks: { callback: value => '₹' + value.toLocaleString('en-IN') } } },
          plugins: { legend: { position: "right" } }
        }
      });

      if (data.previousMonthsByCategory?.length) {
        const allCategories = [...new Set(data.previousMonthsByCategory.flatMap(month => month.categories.map(c => c.category)))];
        const datasets = allCategories.map((category, index) => ({
          label: category,
          data: data.previousMonthsByCategory.map(month => {
            const cat = month.categories.find(c => c.category === category);
            return cat ? cat.amount : 0;
          }),
          backgroundColor: incomeCategories.includes(category) ? '#28a745' : nonIncomeColors[index % nonIncomeColors.length],
          stack: 'Stack 0'
        }));
        this.charts.previousMonthsByCategory = new Chart(document.getElementById("previousMonthsByCategoryChart"), {
          type: "bar",
          data: { labels: data.previousMonthsByCategory.map(m => m.month), datasets },
          options: {
            responsive: true,
            scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { callback: value => '₹' + value.toLocaleString('en-IN') } } },
            plugins: { legend: { position: "top" }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ₹${ctx.parsed.y.toLocaleString('en-IN')}` } } }
          }
        });
      } else {
        this.charts.previousMonthsByCategory = new Chart(document.getElementById("previousMonthsByCategoryChart"), {
          type: "bar",
          data: { labels: ["No Data"], datasets: [{ label: "Expenses (₹)", data: [0], backgroundColor: "#ccc" }] },
          options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { callback: value => '₹' + value.toLocaleString('en-IN') } } } }
        });
      }
    },

    async populateMonthSelect() {
      try {
        this.showLoader();
        const months = await this.fetchAvailableMonths();
        const select = document.getElementById("monthSelect");
        if (!select) {
          this.showErrorMessage("Month select element not found.");
          return;
        }
        select.innerHTML = '<option value="">Select a Month</option>';
        months.forEach(month => {
          const option = document.createElement("option");
          option.value = month;
          option.textContent = new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
          select.appendChild(option);
        });
      } finally {
        this.hideLoader();
      }
    },

    // Event Handlers
    openDownloadPopup() {
      const popup = document.getElementById("downloadPopup");
      const backdrop = document.getElementById("backdrop");
      if (popup && backdrop) {
        popup.classList.add("active");
        backdrop.classList.add("active");
        this.populateMonthSelect();
      } else {
        this.showErrorMessage("Download popup or backdrop element not found.");
      }
    },

    closeDownloadPopup() {
      const popup = document.getElementById("downloadPopup");
      const backdrop = document.getElementById("backdrop");
      if (popup && backdrop) {
        popup.classList.remove("active");
        backdrop.classList.remove("active");
      }
    },

    async downloadSelectedReport(format) {
      const month = document.getElementById("monthSelect")?.value;
      if (!month) {
        this.showErrorMessage("Please select a month.");
        return;
      }

      try {
        this.showLoader();
        const fromDate = `${month}-01`;
        const toDate = new Date(month);
        toDate.setMonth(toDate.getMonth() + 1);
        toDate.setDate(0);
        toDate.setUTCHours(23, 59, 59, 999);
        const toDateStr = toDate.toISOString().slice(0, 10);

        console.log(`Downloading ${format} report for ${month} (from ${fromDate} to ${toDateStr})`);

        const response = await fetch(
          `http://localhost:5000/api/reports/summary?from=${fromDate}&to=${toDateStr}&_=${Date.now()}`,
          {
            headers: { "Content-Type": "application/json" }
          }
        );
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Failed to fetch summary data: ${errorData.message || response.statusText}`);
        }
        const data = await response.json();

        const budgets = await this.fetchBudgets(month);

        const transactions = (await this.fetchTransactions())
          .filter(tx => {
            const txDate = new Date(tx.date);
            return txDate >= new Date(fromDate) && txDate <= toDate;
          })
          .map(tx => ({
            transactionId: tx.transactionId || 'N/A',
            date: new Date(tx.date).toLocaleDateString('en-IN'),
            time: new Date(tx.date).toLocaleTimeString('en-IN'),
            category: tx.category || "Uncategorized",
            amount: isNaN(parseFloat(tx.amount)) ? '0.00' : parseFloat(tx.amount).toFixed(2)
          }));

        const report = {
          month: new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
          totalExpenses: data.totalExpenses || 0,
          totalIncome: data.totalIncome || 0,
          categories: data.categories || [],
          budgetComparison: budgets.map(budget => ({
            category: budget.name || 'Unknown',
            budgeted: budget.budget || 0,
            spent: budget.spent || 0,
            overBudget: (budget.spent || 0) > (budget.budget || 0) ? (budget.spent - budget.budget) : 0
          })),
          transactions
        };

        if (format === 'csv') {
          this.downloadReportAsCSV(report, `report_${month}`);
        } else if (format === 'pdf') {
          const downloadResponse = await fetch(
            `http://localhost:5000/api/reports/download?from=${fromDate}&to=${toDateStr}&format=pdf&_=${Date.now()}`,
            {
              headers: { "Content-Type": "application/json" }
            }
          );
          if (!downloadResponse.ok) {
            const errorData = await downloadResponse.json().catch(() => ({}));
            throw new Error(`Failed to download PDF: ${errorData.message || downloadResponse.statusText}`);
          }
          const blob = await downloadResponse.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `report_${month}.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
        } else {
          throw new Error("Invalid format. Supported: csv, pdf");
        }

        this.showInfoMessage(`Downloaded ${format.toUpperCase()} report for ${report.month} successfully!`);
        this.closeDownloadPopup();
      } catch (error) {
        console.error("Download error:", error);
        this.showErrorMessage(`Failed to download ${format.toUpperCase()} report: ${error.message}`);
      } finally {
        this.hideLoader();
      }
    },

    toggleNotifications() {
      const panel = document.getElementById("notificationPanel");
      if (panel) {
        panel.classList.toggle("show-panel");
      } else {
        this.showErrorMessage("Notification panel not found.");
      }
    },

    loadNotifications() {
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
    },

    addNotification(message) {
      const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
      notifications.push(message);
      localStorage.setItem("notifications", JSON.stringify(notifications));
      this.loadNotifications();
    },

    clearNotifications() {
      localStorage.removeItem("notifications");
      this.loadNotifications();
    },

    toggleDarkMode() {
      document.body.classList.toggle('dark');
    },

    async loadData() {
      const syncButton = document.querySelector(".sync-button button");
      if (syncButton) {
        syncButton.disabled = true;
        syncButton.innerHTML = '<i class="fas fa-arrows-rotate fa-spin"></i> Syncing...';
      }
      try {
        await this.generateCurrentMonthReportIfFirst();
        const data = await this.fetchReportData();
        if (data) {
          this.initializeCharts(data);
          this.updateSummaries(data);
          this.showInfoMessage("Data loaded successfully!");
        } else {
          this.initializeCharts({});
          this.updateSummaries({});
        }
      } finally {
        if (syncButton) {
          syncButton.disabled = false;
          syncButton.innerHTML = '<i class="fas fa-arrows-rotate"></i> Sync Data';
        }
      }
    },

    init() {
      window.App = this;
      window.addEventListener('transactionAdded', () => {
        if (window.location.pathname.includes('reports.html')) {
          console.log("Transaction added, refreshing reports...");
          this.loadData();
        }
      });
      document.addEventListener("click", (event) => {
        const panel = document.getElementById("notificationPanel");
        const bell = document.querySelector(".notification-bell");
        if (panel && bell && !panel.contains(event.target) && !bell.contains(event.target)) {
          panel.classList.remove("show-panel");
        }
      });
      this.loadData();
      this.loadNotifications();
    }
  };

  App.init();
});