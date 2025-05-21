document.addEventListener("DOMContentLoaded", async () => {
    // Redirect if not logged in
    const userEmail = localStorage.getItem("userEmail");
    if (!userEmail) {
        window.location.href = "login.html";
        return;
    }

    const totalExpensesCard = document.getElementById("total-expenses-card");
    const savingsProgressCard = document.getElementById("savings-progress-card");
    const remainingBudgetCard = document.getElementById("remaining-budget-card");
    const expenseReductionCard = document.getElementById("expense-reduction-card");
    const incomeCard = document.getElementById("income-card");
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

            return totalExpenses;
        } catch (error) {
            console.error("Error fetching expenses:", error);
            if (totalExpensesCard) totalExpensesCard.innerHTML = "Total Expenses<br>Error loading data";
            return 0;
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
            return totalSalary;
        } catch (error) {
            console.error("Error fetching salary data:", error);
            if (incomeCard) incomeCard.innerHTML = "Income<br>Error loading data";
            return 0;
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
            return { totalBudget, totalSpent, remaining };
        } catch (error) {
            console.error("Error fetching remaining budget:", error);
            if (remainingBudgetCard) remainingBudgetCard.innerHTML = "Remaining Budget<br>Error loading data";
            return { totalBudget: 0, totalSpent: 0, remaining: 0 };
        }
    }

    async function updateSavingsProgress(totalSalary, totalExpenses) {
        try {
            const savingsGoal = totalSalary * 0.1; // 10% of income as savings goal
            const monthlySavings = totalSalary - totalExpenses; // Can be negative
            const savingsProgress = savingsGoal > 0 ? (monthlySavings / savingsGoal) * 100 : 0;

            if (savingsProgressCard) {
                savingsProgressCard.innerHTML = `Monthly Savings Progress<br>₹${monthlySavings.toFixed(2)}<div class="progress-bar"><div id="savings-progress-bar" class="progress"></div></div>`;
                const progressBar = document.getElementById("savings-progress-bar");
                progressBar.style.width = `${Math.min(Math.abs(savingsProgress), 100)}%`;
                if (monthlySavings < 0) {
                    progressBar.classList.add("negative");
                }
            }
        } catch (error) {
            console.error("Error updating savings progress:", error);
            if (savingsProgressCard) savingsProgressCard.innerHTML = "Monthly Savings Progress<br>Error loading data";
        }
    }

    async function updateExpenseReduction(totalSalary, totalExpenses, totalBudget) {
        try {
            const overspending = totalExpenses - totalSalary;
            const reductionTarget = overspending > 0 ? overspending : 0;
            const budgetRoom = totalBudget - totalExpenses;
            const reductionProgress = reductionTarget > 0 ? Math.max((budgetRoom / reductionTarget) * 100, 0) : 100;

            if (expenseReductionCard) {
                expenseReductionCard.innerHTML = `Expense Reduction Target<br>₹${reductionTarget.toFixed(2)}<div class="progress-bar"><div id="expense-reduction-progress-bar" class="progress"></div></div>`;
                const progressBar = document.getElementById("expense-reduction-progress-bar");
                progressBar.style.width = `${Math.min(reductionProgress, 100)}%`;
            }
        } catch (error) {
            console.error("Error updating expense reduction:", error);
            if (expenseReductionCard) expenseReductionCard.innerHTML = "Expense Reduction Target<br>Error loading data";
        }
    }

    try {
        const [totalExpenses, totalSalary, budgetData] = await Promise.all([
            fetchAndUpdateExpenses(),
            fetchAndUpdateSalary(),
            fetchRemainingBudget()
        ]);
        await Promise.all([
            updateSavingsProgress(totalSalary, totalExpenses),
            updateExpenseReduction(totalSalary, totalExpenses, budgetData.totalBudget)
        ]);
    } catch (error) {
        console.error("Error fetching dashboard data:", error);
    }

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