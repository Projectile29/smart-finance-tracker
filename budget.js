let categories = [];
let editingIndex = -1;

function openAddPopup() {
    document.getElementById('addPopup').style.display = 'block';
}

function closeAddPopup() {
    document.getElementById('addPopup').style.display = 'none';
}

function openEditPopup(index) {
    editingIndex = index;
    document.getElementById('editSpentAmount').value = categories[index].spent;
    document.getElementById('editPopup').style.display = 'block';
}

function closeEditPopup() {
    document.getElementById('editPopup').style.display = 'none';
}

function addCategory() {
    const name = document.getElementById('categoryName').value.trim();
    const budget = parseFloat(document.getElementById('categoryBudget').value);

    if (!name || isNaN(budget) || budget <= 0) {
        alert('Please enter valid details!');
        return;
    }

    categories.push({ name, budget, spent: 0 });
    updateTable();
    closeAddPopup();
}

function updateSpent() {
    const spent = parseFloat(document.getElementById('editSpentAmount').value);

    if (isNaN(spent) || spent < 0) {
        alert('Invalid amount');
        return;
    }

    categories[editingIndex].spent = spent;
    updateTable();
    closeEditPopup();
}

function deleteCategory(index) {
    if (confirm("Are you sure you want to delete this category?")) {
        categories.splice(index, 1);
        updateTable();
    }
}

function updateTable() {
    const table = document.getElementById('categoryTable');
    table.innerHTML = '';

    let totalBudget = 0, totalRemaining = 0;

    categories.forEach((cat, index) => {
        const remaining = cat.budget - cat.spent;
        totalBudget += cat.budget;
        totalRemaining += remaining;

        table.innerHTML += `
            <tr>
                <td>${cat.name}</td>
                <td>₹${cat.budget}</td>
                <td>₹${cat.spent}</td>
                <td>₹${remaining}</td>
                <td>
                    <i class="fas fa-edit edit-icon" onclick="openEditPopup(${index})"></i>
                    <i class="fas fa-trash delete-icon" onclick="deleteCategory(${index})"></i>
                </td>
            </tr>`;
    });

    document.getElementById('totalBudget').innerText = totalBudget.toFixed(2);
    document.getElementById('totalRemaining').innerText = totalRemaining.toFixed(2);
}

document.addEventListener('DOMContentLoaded', updateTable);
