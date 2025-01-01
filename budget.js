// Handle menu item clicks
document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
        // Remove active class from all items
        document.querySelectorAll('.menu-item').forEach(menuItem => {
            menuItem.classList.remove('active');
        });
        // Add active class to clicked item
        item.classList.add('active');
    });
});

// Handle edit buttons
document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const card = btn.closest('.card');
        const inputs = card.querySelectorAll('input');
        
        inputs.forEach(input => {
            input.readOnly = false;
            input.style.backgroundColor = '#f8f9fa';
        });
    });
});

// Handle add budget button
document.querySelector('.add-btn').addEventListener('click', () => {
    const categoryTable = document.querySelector('tbody');
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td contenteditable="true">New Category</td>
        <td contenteditable="true">₹0</td>
        <td contenteditable="true">₹0</td>
        <td contenteditable="true">₹0</td>
    `;
    categoryTable.appendChild(newRow);
});

// Calculate and update remaining budget
function updateRemainingBudget() {
    const totalBudget = parseFloat(document.querySelector('[value="₹2000"]').value.replace('₹', ''));
    let spentAmount = 0;
    
    document.querySelectorAll('tbody tr').forEach(row => {
        const spent = parseFloat(row.children[2].textContent.replace('₹', ''));
        spentAmount += spent;
    });
    
    const remaining = totalBudget - spentAmount;
    document.querySelector('[value="₹750"]').value = `₹${remaining}`;
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    updateRemainingBudget();
});