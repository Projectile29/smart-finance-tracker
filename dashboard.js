document.addEventListener("DOMContentLoaded", async () => {
    const totalExpensesCard = document.getElementById("total-expenses-card");
    const incomeCard = document.getElementById("income-card");
    const remainingBudgetCard = document.getElementById("remaining-budget-card");
    const spendingChartCanvas = document.getElementById("spendingChart");

    const spendingChart = new Chart(spendingChartCanvas, {
        type: 'bar',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
            datasets: [{
                label: 'Spending',
                data: [0, 0, 0, 0, 0],
                backgroundColor: 'rgba(79, 70, 229, 0.7)',
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    async function fetchTotalExpenses() {
        try {
            console.log("Fetching total expenses...");
            const response = await fetch("http://localhost:5000/transactions");
            if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);

            const transactions = await response.json();
            if (!Array.isArray(transactions)) throw new Error("Transactions is not an array");

            console.log("Fetched Transactions:", transactions);

            const totalAmount = transactions.reduce((sum, tx) => {
                const amount = parseFloat(tx.amount);
                return sum + (isNaN(amount) ? 0 : amount);
            }, 0);

            if (totalExpensesCard) {
                totalExpensesCard.innerHTML = `Total Expenses<br>₹${totalAmount.toFixed(2)}`;
            } else {
                console.error("Total Expenses card element not found!");
            }

            const monthlySpending = {};
            transactions.forEach(tx => {
                const date = new Date(tx.date);
                const month = date.toLocaleString('default', { month: 'short' });
                const amount = parseFloat(tx.amount) || 0;
                monthlySpending[month] = (monthlySpending[month] || 0) + amount;
            });

            const labels = Object.keys(monthlySpending).slice(0, 5);
            const data = Object.values(monthlySpending).slice(0, 5);

            spendingChart.data.labels = labels.length ? labels : ['Jan', 'Feb', 'Mar', 'Apr', 'May'];
            spendingChart.data.datasets[0].data = data.length ? data : [0, 0, 0, 0, 0];
            spendingChart.update();

        } catch (error) {
            console.error("Error fetching total expenses:", error);
            if (totalExpensesCard) {
                totalExpensesCard.innerHTML = "Total Expenses<br>Error loading data";
            }
        }
    }

    async function fetchAndUpdateSalary() {
        try {
            const userEmail = localStorage.getItem("userEmail");
            if (!userEmail) {
                if (incomeCard) {
                    incomeCard.innerHTML = "Income<br>Please log in";
                }
                throw new Error("User email not found in local storage!");
            }

            console.log("Fetching salary for:", userEmail);
            const response = await fetch(`http://localhost:5000/salary?email=${userEmail}`);
            if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);

            const data = await response.json();
            console.log("Fetched Salary Data:", data);

            const salary = parseFloat(data.salary);
            if (isNaN(salary)) {
                throw new Error("Invalid salary data");
            }

            if (incomeCard) {
                incomeCard.innerHTML = `Income<br>₹${salary.toFixed(2)}`;
            } else {
                console.error("Income card element not found!");
            }
        } catch (error) {
            console.error("Error fetching salary data:", error);
            if (incomeCard) {
                incomeCard.innerHTML = "Income<br>Error loading data";
            }
        }
    }

    async function fetchRemainingBudget() {
        try {
            console.log("Fetching budgets...");
            const response = await fetch("http://localhost:5000/budgets");
            if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);

            const budgets = await response.json();
            if (!Array.isArray(budgets)) throw new Error("Budgets is not an array");

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
            } else {
                console.error("Remaining budget card element not found!");
            }
        } catch (error) {
            console.error("Error fetching remaining budget:", error);
            if (remainingBudgetCard) {
                remainingBudgetCard.innerHTML = "Remaining Budget<br>Error loading data";
            }
        }
    }

    try {
        await Promise.all([
            fetchTotalExpenses(),
            fetchAndUpdateSalary(),
            fetchRemainingBudget()
        ]);
    } catch (error) {
        console.error("Error fetching dashboard data:", error);
    }
});