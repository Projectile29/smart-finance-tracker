document.addEventListener("DOMContentLoaded", async () => {
    const transactionsTable = document.getElementById("transactions-body");
  
    try {
      const response = await fetch("http://localhost:5000/transactions");
      const transactions = await response.json();
  
      transactionsTable.innerHTML = transactions
        .map(
          (tx) => `
        <tr>
          <td>${tx.accountNumber}</td>
          <td>${tx.date}</td>
          <td>${tx.category}</td>
          <td>${tx.amount}</td>
        </tr>`
        )
        .join("");
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }
  });
  