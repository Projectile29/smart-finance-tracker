const tabButtons = document.querySelectorAll('.tab-btn');

tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    tabButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
  });
});

document.addEventListener("DOMContentLoaded", async () => {
  const totalExpensesCard = document.querySelector(".dashboard .card:first-child"); 

  async function fetchTotalExpenses() {
      try {
          const response = await fetch("http://localhost:5000/transactions");
          if (!response.ok) throw new Error("Failed to fetch transactions");

          const transactions = await response.json();
          
          // Ensure transactions have valid amounts
          const totalAmount = transactions.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);

          // Update the Total Expenses card dynamically
          totalExpensesCard.innerHTML = `Total Expenses<br>₹${totalAmount.toFixed(2)}`;
      } catch (error) {
          console.error("Error fetching total expenses:", error);
          totalExpensesCard.innerHTML = "Total Expenses<br>₹0.00"; // Show 0 if error occurs
      }
  }

  fetchTotalExpenses(); 
});
