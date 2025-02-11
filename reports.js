document.addEventListener("DOMContentLoaded", function () {
    fetchTransactionData();
});

async function fetchTransactionData() {
    try {
        const response = await fetch("transactions.json"); // Update with actual data source
        const transactions = await response.json();
        processTransactionData(transactions);
    } catch (error) {
        console.error("Error fetching transactions:", error);
    }
}

function processTransactionData(transactions) {
    let weeklyData = Array(4).fill(0).map(() => ({ debit: 0, credit: 0 }));

    transactions.forEach(txn => {
        let weekIndex = Math.floor(new Date(txn.date).getDate() / 7);
        if (txn.type === "debit") {
            weeklyData[weekIndex].debit += txn.amount;
        } else {
            weeklyData[weekIndex].credit += txn.amount;
        }
    });

    renderGraphs(weeklyData);
}

function renderGraphs(weeklyData) {
    new Chart(document.getElementById("debitChart"), {
        type: "bar",
        data: {
            labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
            datasets: [{
                label: "Debit",
                data: weeklyData.map(w => w.debit),
                backgroundColor: "red"
            }]
        }
    });

    new Chart(document.getElementById("creditChart"), {
        type: "bar",
        data: {
            labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
            datasets: [{
                label: "Credit",
                data: weeklyData.map(w => w.credit),
                backgroundColor: "green"
            }]
        }
    });
}

function downloadReport() {
    const doc = new jsPDF();
    doc.text("Monthly Financial Report", 10, 10);

    const debitCanvas = document.getElementById("debitChart");
    const creditCanvas = document.getElementById("creditChart");

    doc.addImage(debitCanvas.toDataURL("image/png"), "PNG", 10, 20, 90, 60);
    doc.addImage(creditCanvas.toDataURL("image/png"), "PNG", 10, 90, 90, 60);

    doc.save("Monthly_Report.pdf");
}
