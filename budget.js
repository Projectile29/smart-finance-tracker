// Ensure the DOM is fully loaded before executing the script
document.addEventListener("DOMContentLoaded", () => {
    
    // Toggle active button in sidebar
    document.querySelectorAll('.nav-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });
    });

    // Enable editing in budget fields
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const card = btn.closest('.card');
            const inputs = card.querySelectorAll('input');

            inputs.forEach(input => {
                if (input.hasAttribute('readonly')) {
                    input.removeAttribute('readonly');
                    input.style.backgroundColor = '#f8f9fa';
                } else {
                    input.setAttribute('readonly', 'true');
                    input.style.backgroundColor = 'white';
                }
            });
        });
    });

    // Add new category row
    const addButton = document.querySelector('.add-btn');

    if (addButton) {
        addButton.addEventListener('click', () => {
            const categoryTable = document.querySelector('tbody');
            if (categoryTable) {
                const newRow = document.createElement('tr');
                newRow.innerHTML = `
                    <td contenteditable="true">New Category</td>
                    <td contenteditable="true">₹0</td>
                    <td contenteditable="true">₹0</td>
                    <td contenteditable="true">₹0</td>
                `;
                categoryTable.appendChild(newRow);
            }
        });
    }
});
