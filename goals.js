var API_BASE_URL = "http://localhost:5000";

document.addEventListener("DOMContentLoaded", () => {
    initializeEventListeners();
    fetchGoals();
});

function initializeEventListeners() {
    document.getElementById("addGoalBtn")?.addEventListener("click", () => {
        document.getElementById("goalModal").style.display = "block";
    });

    document.querySelectorAll(".close").forEach(closeBtn => {
        closeBtn.addEventListener("click", () => {
            document.getElementById("goalModal").style.display = "none";
            document.getElementById("editGoalModal").style.display = "none";
        });
    });

    document.getElementById("saveGoalBtn")?.addEventListener("click", saveGoal);
    document.getElementById("saveEditGoalBtn")?.addEventListener("click", saveEditedGoal);
}

// ✅ Function to Save a New Goal
async function saveGoal() {
    const goalName = document.getElementById("goalName").value.trim();
    const targetAmount = parseFloat(document.getElementById("targetAmount").value);
    const currentSavings = parseFloat(document.getElementById("currentSavings").value);

    if (!goalName || isNaN(targetAmount) || isNaN(currentSavings)) {
        alert("Please fill in all fields correctly.");
        return;
    }

    const goalData = { name: goalName, targetAmount, currentSavings };

    try {
        const response = await fetch(`${API_BASE_URL}/goals`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(goalData),
        });

        if (!response.ok) throw new Error("Failed to save goal");

        document.getElementById("goalModal").style.display = "none";
        fetchGoals(); // Refresh the goals list
    } catch (error) {
        console.error("Error saving goal:", error);
    }
}

// ✅ Function to Fetch and Display Goals
async function fetchGoals() {
    try {
        const response = await fetch(`${API_BASE_URL}/goals`);
        if (!response.ok) throw new Error("Failed to fetch goals");

        const goals = await response.json();
        const goalsContainer = document.getElementById("goalsContainer");
        if (!goalsContainer) return;

        goalsContainer.innerHTML = "";

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

        attachDynamicEventListeners();
    } catch (error) {
        console.error("Error fetching goals:", error);
    }
}

// ✅ Attach event listeners for dynamically created elements
function attachDynamicEventListeners() {
    document.querySelectorAll(".delete-icon").forEach(button => {
        button.addEventListener("click", e => {
            confirmDelete(e.target.closest(".delete-icon").dataset.id);
        });
    });

    document.querySelectorAll(".edit-icon").forEach(button => {
        button.addEventListener("click", e => {
            openEditModal(e.target.closest(".edit-icon").dataset.id);
        });
    });
}

// ✅ Function to Save Edited Goal
async function saveEditedGoal() {
    const goalId = document.getElementById("editGoalId").value;
    const goalName = document.getElementById("editGoalName").value.trim();
    const targetAmount = parseFloat(document.getElementById("editTargetAmount").value);
    const currentSavings = parseFloat(document.getElementById("editCurrentSavings").value);

    if (!goalId || !goalName || isNaN(targetAmount) || isNaN(currentSavings)) {
        alert("Please fill in all fields correctly.");
        return;
    }

    const goalData = { name: goalName, targetAmount, currentSavings };

    try {
        const response = await fetch(`${API_BASE_URL}/goals/${goalId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(goalData),
        });

        if (!response.ok) throw new Error("Failed to update goal");

        document.getElementById("editGoalModal").style.display = "none";
        fetchGoals(); // Refresh goals list
    } catch (error) {
        console.error("Error updating goal:", error);
    }
}

// ✅ Function to Fetch Goal Projections
async function fetchGoalProjection(targetAmount, currentSavings) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/goal-projection`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetAmount, currentSavings }),
        });

        if (!response.ok) throw new Error("Failed to fetch projections");

        const data = await response.json();
        document.getElementById("progressBar").value = (currentSavings / targetAmount) * 100;
        document.getElementById("completionDate").innerText = `Projected Completion: ${data.projectedCompletionDate}`;

    } catch (error) {
        console.error("Error fetching goal projection:", error);
        document.getElementById("completionDate").innerText = "Failed to load projections.";
    }
}

// ✅ Function to Update UI with AI-Based Projection
async function updateUI() {
    const targetAmount = 50000; 
    const currentSavings = 20000; 

    await fetchGoalProjection(targetAmount, currentSavings);
}

// Initialize AI Projection
updateUI();
