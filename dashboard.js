document.addEventListener("DOMContentLoaded", async () => {
    // Redirect if not logged in
    const userEmail = localStorage.getItem("userEmail");
    if (!userEmail) {
        window.location.href = "login.html";
        return;
    }

    const totalExpensesCard = document.getElementById("total-expenses-card");
    const incomeCard = document.getElementById("income-card");
    const remainingBudgetCard = document.getElementById("remaining-budget-card");
    const spendingChartCanvas = document.getElementById("spendingChart");

    const spendingChart = new Chart(spendingChartCanvas, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Spending',
                data: [],
                backgroundColor: 'rgba(79, 70, 229, 0.7)',
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });

    async function fetchAndUpdateExpenses() {
        try {
            const response = await fetch(`http://localhost:5000/transactions?email=${userEmail}`);
            if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);

            const transactions = await response.json();

            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            // Filter non-salary transactions of current month
            const currentMonthExpenses = transactions.filter(tx => {
                if (tx.category && tx.category.toLowerCase() !== "salary") {
                    const txDate = new Date(tx.date);
                    return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
                }
                return false;
            });

            const totalExpenses = currentMonthExpenses.reduce((sum, tx) => {
                const amount = parseFloat(tx.amount);
                return sum + (isNaN(amount) ? 0 : amount);
            }, 0);

            if (totalExpensesCard) {
                totalExpensesCard.innerHTML = `This Month's Outflow<br>₹${totalExpenses.toFixed(2)}`;
            }

            // For spending chart: last 5 months total spending excluding salary
            const monthlySpending = {};
            transactions.forEach(tx => {
                if (tx.category && tx.category.toLowerCase() !== "salary") {
                    const date = new Date(tx.date);
                    const monthYear = date.toLocaleString('default', { month: 'short' }) + ' ' + date.getFullYear();
                    const amount = parseFloat(tx.amount) || 0;
                    monthlySpending[monthYear] = (monthlySpending[monthYear] || 0) + amount;
                }
            });

            // Sort months (by date) and get last 5
            const sortedMonths = Object.keys(monthlySpending).sort((a, b) => {
                const [monthA, yearA] = a.split(' ');
                const [monthB, yearB] = b.split(' ');
                const dateA = new Date(`${monthA} 1, ${yearA}`);
                const dateB = new Date(`${monthB} 1, ${yearB}`);
                return dateA - dateB;
            });

            const last5Months = sortedMonths.slice(-5);
            const spendingData = last5Months.map(m => monthlySpending[m]);

            spendingChart.data.labels = last5Months;
            spendingChart.data.datasets[0].data = spendingData;
            spendingChart.update();

        } catch (error) {
            console.error("Error fetching expenses:", error);
            if (totalExpensesCard) totalExpensesCard.innerHTML = "Total Expenses<br>Error loading data";
        }
    }

    async function fetchAndUpdateSalary() {
        try {
            const response = await fetch(`http://localhost:5000/transactions?email=${userEmail}`);
            if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);

            const transactions = await response.json();

            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            const currentMonthSalaryTransactions = transactions.filter(tx => {
                if (tx.category && tx.category.toLowerCase() === "salary") {
                    const txDate = new Date(tx.date);
                    return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
                }
                return false;
            });

            const totalSalary = currentMonthSalaryTransactions.reduce((sum, tx) => {
                const amount = parseFloat(tx.amount);
                return sum + (isNaN(amount) ? 0 : amount);
            }, 0);

            if (incomeCard) {
                incomeCard.innerHTML = `Monthly Earnings<br>₹${totalSalary.toFixed(2)}`;
            }
        } catch (error) {
            console.error("Error fetching salary data:", error);
            if (incomeCard) incomeCard.innerHTML = "Income<br>Error loading data";
        }
    }

    async function fetchRemainingBudget() {
        try {
            const response = await fetch("http://localhost:5000/budgets");
            if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);

            const budgets = await response.json();

            const totalBudget = budgets.reduce((sum, budget) => {
                const budgetAmount = parseFloat(budget.budget);
                return sum + (isNaN(budgetAmount) ? 0 : budgetAmount);
            }, 0);

            const totalSpent = budgets.reduce((sum, budget) => {
                const spentAmount = parseFloat(budget.spent);
                return sum + (isNaN(spentAmount) ? 0 : spentAmount);
            }, 0);

            const remaining = totalBudget - totalSpent;

            if (remainingBudgetCard) {
                remainingBudgetCard.innerHTML = `Remaining Budget<br>₹${remaining.toFixed(2)}`;
            }
        } catch (error) {
            console.error("Error fetching remaining budget:", error);
            if (remainingBudgetCard) remainingBudgetCard.innerHTML = "Remaining Budget<br>Error loading data";
        }
    }

    try {
        await Promise.all([
            fetchAndUpdateExpenses(),
            fetchAndUpdateSalary(),
            fetchRemainingBudget()
        ]);
    } catch (error) {
        console.error("Error fetching dashboard data:", error);
    }

    // Notification & logout code unchanged below (keep as is)

    function addNotification(message) {
        const notificationList = document.getElementById('notificationList');
        const notifications = JSON.parse(localStorage.getItem('notifications') || '[]');
        notifications.push(message);
        localStorage.setItem('notifications', JSON.stringify(notifications));

        const li = document.createElement('li');
        li.textContent = message;
        notificationList.appendChild(li);
    }

    function toggleNotifications() {
        const panel = document.getElementById('notificationPanel');
        panel.classList.toggle('show-panel');
    }

    function clearNotifications() {
        localStorage.removeItem('notifications');
        document.getElementById('notificationList').innerHTML = '';
    }

    const logoutBtn = document.querySelector(".logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("token");
            localStorage.removeItem("userEmail");
            window.location.href = "login.html";
        });
    }
});
