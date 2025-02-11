document.addEventListener("DOMContentLoaded", function () {
    // Sidebar navigation buttons
    const navButtons = document.querySelectorAll(".nav-btn");
    
    navButtons.forEach(button => {
        button.addEventListener("click", function () {
            // Remove active class from all buttons
            navButtons.forEach(btn => btn.classList.remove("active"));
            // Add active class to the clicked button
            this.classList.add("active");

            // Update the content section based on button clicked
            const sectionTitle = document.querySelector(".section-title");
            sectionTitle.textContent = this.textContent + " Reports";
        });
    });

    // Handle report generation
    document.querySelector(".btn-red").addEventListener("click", function () {
        const fromDate = document.getElementById("from-date").value;
        const toDate = document.getElementById("to-date").value;

        if (fromDate && toDate) {
            alert(`Generating report from ${fromDate} to ${toDate}`);
            // Here, you could generate a PDF, fetch report data, etc.
        } else {
            alert("Please select both From and To dates.");
        }
    });
});
