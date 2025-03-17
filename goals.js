var API_BASE_URL = "http://localhost:5000";

// Wait for DOM to be fully loaded
document.addEventListener("DOMContentLoaded", () => {
    initializeEventListeners();
    fetchGoals();
});

// Initialize Event Listeners
function initializeEventListeners() {
    // Open Add Goal Modal
    const addGoalBtn = document.getElementById("addGoalBtn");
    if (addGoalBtn) {
        addGoalBtn.addEventListener("click", () => {
            document.getElementById("goalModal").style.display = "block";
        });
    }

    // Close Modals
    document.querySelectorAll(".close").forEach(closeBtn => {
        closeBtn.addEventListener("click", () => {
            document.getElementById("goalModal").style.display = "none";
            document.getElementById("deleteModal").style.display = "none";
            document.getElementById("editGoalModal").style.display = "none";
        });
    });

    // Save New Goal
    const saveGoalBtn = document.getElementById("saveGoalBtn");
    if (saveGoalBtn) {
        saveGoalBtn.addEventListener("click", saveGoal);
    } else {
        console.error("Error: #saveGoalBtn not found in the DOM.");
    }

    // Save Edited Goal
    const saveEditGoalBtn = document.getElementById("saveEditGoalBtn");
    if (saveEditGoalBtn) {
        saveEditGoalBtn.addEventListener("click", saveEditedGoal);
    } else {
        console.error("Error: #saveEditGoalBtn not found in the DOM.");
    }
}

// Fetch and Display Goals
async function fetchGoals() {
    try {
        const response = await fetch(`${API_BASE_URL}/goals`);
        if (!response.ok) throw new Error("Failed to fetch goals");

        const goals = await response.json();
        const goalsContainer = document.getElementById("goalsContainer");

        if (!goalsContainer) {
            console.error("Error: #goalsContainer not found in the DOM.");
            return;
        }

        goalsContainer.innerHTML = ""; // Clear previous entries

        goals.forEach(goal => {
            const goalCard = document.createElement("div");
            goalCard.classList.add("goal-card");
            goalCard.setAttribute("data-id", goal._id);

            goalCard.innerHTML = `
                <h3>${goal.name} 
                    <span class="edit-icon" data-id="${goal._id}"><i class="fas fa-edit"></i></span> 
                    <span class="delete-icon" data-id="${goal._id}"><i class="fas fa-trash"></i></span>
                </h3>
                <p><strong>Target Amount:</strong> ₹${goal.targetAmount}</p>
                <p><strong>Current Savings:</strong> ₹<span class="current-savings">${goal.currentSavings}</span></p>
                <div class="progress-bar">
                    <div class="progress" style="width: ${(goal.currentSavings / goal.targetAmount) * 100}%"></div>
                </div>
            `;

            goalsContainer.appendChild(goalCard);
        });

        attachDynamicEventListeners(); // Attach event listeners after elements are created
    } catch (error) {
        console.error("Error fetching goals:", error);
    }
}

// Attach event listeners to dynamically created elements
function attachDynamicEventListeners() {
    document.querySelectorAll(".delete-icon").forEach(button => {
        button.addEventListener("click", function (e) {
            const goalId = e.target.closest(".delete-icon").dataset.id;
            confirmDelete(goalId);
        });
    });

    document.querySelectorAll(".edit-icon").forEach(button => {
        button.addEventListener("click", function (e) {
            const goalId = e.target.closest(".edit-icon").dataset.id;
            openEditModal(goalId);
        });
    });
}

// Save New Goal
async function saveGoal() {
    const goalName = document.getElementById("goalName").value.trim();
    const targetAmount = parseFloat(document.getElementById("targetAmount").value);
    const currentSavings = parseFloat(document.getElementById("currentSavings").value);

    if (!goalName || isNaN(targetAmount) || isNaN(currentSavings)) {
        alert("Please enter valid values for all fields.");
        return;
    }

    const newGoal = { name: goalName, targetAmount, currentSavings };

    try {
        await fetch(`${API_BASE_URL}/goals`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newGoal)
        });

        document.getElementById("goalModal").style.display = "none";
        fetchGoals(); // Refresh goals list
    } catch (error) {
        console.error("Error saving goal:", error);
    }
}

// Open Edit Modal
async function openEditModal(goalId) {
    try {
        const response = await fetch(`${API_BASE_URL}/goals/${goalId}`);
        if (!response.ok) throw new Error("Failed to fetch goal data");

        const goal = await response.json();

        // Populate edit form
        document.getElementById("editGoalId").value = goal._id;
        document.getElementById("editGoalName").value = goal.name;
        document.getElementById("editTargetAmount").value = goal.targetAmount;
        document.getElementById("editCurrentSavings").value = goal.currentSavings;

        document.getElementById("editGoalModal").style.display = "block";
    } catch (error) {
        console.error("Error opening edit modal:", error);
    }
}

// Save Edited Goal
async function saveEditedGoal() {
    const goalId = document.getElementById("editGoalId").value;
    const goalName = document.getElementById("editGoalName").value.trim();
    const targetAmount = parseFloat(document.getElementById("editTargetAmount").value);
    const currentSavings = parseFloat(document.getElementById("editCurrentSavings").value);

    if (!goalName || isNaN(targetAmount) || isNaN(currentSavings)) {
        alert("Please enter valid values for all fields.");
        return;
    }

    const updatedGoal = { name: goalName, targetAmount, currentSavings };

    try {
        await fetch(`${API_BASE_URL}/goals/${goalId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedGoal)
        });

        document.getElementById("editGoalModal").style.display = "none";
        fetchGoals();
    } catch (error) {
        console.error("Error updating goal:", error);
    }
}

// Confirm Delete Modal
function confirmDelete(goalId) {
    document.getElementById("deleteModal").style.display = "block";

    document.getElementById("confirmDelete").onclick = async function () {
        await deleteGoal(goalId);
    };

    document.getElementById("cancelDelete").onclick = function () {
        document.getElementById("deleteModal").style.display = "none";
    };
}

// Delete Goal
async function deleteGoal(goalId) {
    try {
        await fetch(`${API_BASE_URL}/goals/${goalId}`, { method: "DELETE" });
        document.getElementById("deleteModal").style.display = "none";
        fetchGoals();
    } catch (error) {
        console.error("Error deleting goal:", error);
    }
}
