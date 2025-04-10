document.addEventListener("DOMContentLoaded", async () => {
    const totalExpensesCard = document.querySelector(".dashboard .card:first-child"); 
    const incomeCard = document.getElementById("income-card"); // Use ID for safety
    const remainingBudgetCard = document.querySelector(".dashboard .card:nth-child(3)");
  
    // ✅ Fetch and update total expenses
    async function fetchTotalExpenses() {
        try {
            console.log("Fetching total expenses...");  // Debug Log
  
            const response = await fetch("http://localhost:5000/transactions");
            if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);
  
            const transactions = await response.json();
            console.log("Fetched Transactions:", transactions); // Debug Response
            
            const totalAmount = transactions.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
  
            if (totalExpensesCard) {
                totalExpensesCard.innerHTML = `Total Expenses<br>₹${totalAmount.toFixed(2)}`;
            } else {
                console.error("Total Expenses card element not found!");
            }
        } catch (error) {
            console.error("Error fetching total expenses:", error);
            if (totalExpensesCard) {
                totalExpensesCard.innerHTML = "Total Expenses<br>₹0.00";
            }
        }
    }
  
    // ✅ Fetch and update salary dynamically
    async function fetchAndUpdateSalary() {
        try {
            const userEmail = localStorage.getItem("userEmail");  
            if (!userEmail) {
                console.error("User email not found in local storage!");
                return;
            }
  
            console.log("Fetching salary for:", userEmail);
  
            const response = await fetch(`http://localhost:5000/salary?email=${userEmail}`);
            if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);
  
            const data = await response.json();
            console.log("Fetched Salary Data:", data);
  
            if (data.salary === undefined) {
                console.error("Salary data is undefined!");
                return;
            }
  
            if (incomeCard) {
                incomeCard.innerHTML = `Income<br>₹${data.salary}`;
            } else {
                console.error("Income card element not found!");
            }
        } catch (error) {
            console.error("Error fetching salary data:", error);
        }
    }
  
    // ✅ Fetch and update remaining budget
    async function fetchRemainingBudget() {
        try {
            const response = await fetch("http://localhost:5000/budgets");
            if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);
  
            const budgets = await response.json();
            let totalBudget = 0;
            let totalSpent = 0;
  
            budgets.forEach(budget => {
                totalBudget += parseFloat(budget.budget) || 0;
                totalSpent += parseFloat(budget.spent) || 0;
            });
  
            const remaining = totalBudget - totalSpent;
  
            if (remainingBudgetCard) {
                remainingBudgetCard.innerHTML = `Remaining Budget<br>₹${remaining.toFixed(2)}`;
            } else {
                console.error("Remaining budget card not found!");
            }
        } catch (error) {
            console.error("Error fetching remaining budget:", error);
            if (remainingBudgetCard) {
                remainingBudgetCard.innerHTML = "Remaining Budget<br>₹0.00";
            }
        }
    }
  
    // ✅ Call functions on page load
    await fetchTotalExpenses(); 
    await fetchAndUpdateSalary();
    await fetchRemainingBudget();
  });
  