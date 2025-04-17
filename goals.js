var API_BASE_URL = "http://localhost:5000";

// Prevent duplicate AI predictions fetch
window.hasFetchedPredictions = false;

document.addEventListener("DOMContentLoaded", () => {
    initializeEventListeners();
    fetchGoals();

    if (!window.hasFetchedPredictions) {
        window.hasFetchedPredictions = true; // Prevent multiple calls
        setTimeout(() => fetchGoalPredictions(), 500); // Ensure inputs exist
    }
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

async function fetchGoalPredictions() {
    try {
        const targetAmount = parseFloat(document.getElementById("targetAmount")?.value) || 20000;
        const currentSavings = parseFloat(document.getElementById("currentSavings")?.value) || 5000;

        const response = await fetch(`${API_BASE_URL}/api/goal-projection`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetAmount, currentSavings })
        });

        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        const data = await response.json();
        console.log("🌟 AI Goal Predictions:", data);

        if (data) {
            displayPredictions(data);
        } else {
            document.getElementById("completionDate").textContent = "No predictions available.";
        }
    } catch (error) {
        console.error("Error fetching AI predictions:", error);
        document.getElementById("completionDate").textContent = "Error loading projections.";
    }
}

function displayPredictions(prediction) {
    let progressElement = document.getElementById("goalProgress");
    let goalBar = document.getElementById("goalBar");
    let completionDateElement = document.getElementById("completionDate");

    if (!progressElement || !goalBar || !completionDateElement) {
        console.error("Progress bar or completion date elements not found.");
        return;
    }

    progressElement.textContent = `Projected Savings: ₹${prediction.avgMonthlySavings.toFixed(2)}`;
    
    let progressPercent = Math.min(100, (prediction.monthsNeeded / 12) * 100);
    goalBar.style.width = `${progressPercent}%`;

    completionDateElement.textContent = `Projected Completion: ${prediction.projectedCompletionDate}`;
}

async function fetchGoals() {
    try {
        const response = await fetch(`${API_BASE_URL}/goals`);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        const goals = await response.json();
        displayGoals(goals);
    } catch (error) {
        console.error("Error fetching goals:", error);
    }
}

function displayGoals(goals) {
    const goalsContainer = document.getElementById("goalsContainer");
    if (!goalsContainer) {
        console.error("Goals container element not found.");
        return;
    }

    goalsContainer.innerHTML = "";

    goals.forEach(goal => {
        const progressPercent = Math.min(100, (goal.currentSavings / goal.targetAmount) * 100); // Calculate progress

        const goalElement = document.createElement("div");
        goalElement.classList.add("goal-item");
        goalElement.innerHTML = `
            <h4>${goal.name}</h4>
            <p>Target: ₹${goal.targetAmount}</p>
            <p>Saved: ₹${goal.currentSavings}</p>
            
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${progressPercent}%;"></div>
            </div>
            <p>${progressPercent.toFixed(2)}% saved</p>

            <button onclick="editGoal('${goal._id}')">Edit</button>
        `;

        goalsContainer.appendChild(goalElement);
    });
}

function editGoal(goalId) {
    console.log("Editing goal:", goalId);
    
    const modal = document.getElementById("editGoalModal");
    const inputId = document.getElementById("editGoalId");

    if (!modal || !inputId) {
        console.error("Edit modal or input not found.");
        return;
    }

    inputId.value = goalId;
    modal.style.display = "block";
}

async function saveGoal() {
    const goalName = document.getElementById("goalName").value;
    const targetAmount = document.getElementById("targetAmount").value;
    const currentSavings = document.getElementById("currentSavings").value;

    if (!goalName || !targetAmount || currentSavings === "") {
        alert("Please fill in all fields.");
        return;
    }

    const goalData = { 
        name: goalName, 
        targetAmount: parseFloat(targetAmount), 
        currentSavings: parseFloat(currentSavings) 
    };

    try {
        const response = await fetch(`${API_BASE_URL}/goals`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(goalData)
        });

        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        fetchGoals();
        document.getElementById("goalModal").style.display = "none";
    } catch (error) {
        console.error("Error saving goal:", error);
    }
}

async function saveEditedGoal() {
    const goalId = document.getElementById("editGoalId").value;
    const goalName = document.getElementById("editGoalName").value;
    const targetAmount = document.getElementById("editTargetAmount").value;
    const currentSavings = document.getElementById("editCurrentSavings").value;

    if (!goalId || !goalName || !targetAmount || currentSavings === "") {
        alert("Please fill in all fields.");
        return;
    }

    const updatedGoal = { 
        name: goalName, 
        targetAmount: parseFloat(targetAmount), 
        currentSavings: parseFloat(currentSavings) 
    };

    try {
        const response = await fetch(`${API_BASE_URL}/goals/${goalId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedGoal)
        });

        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        fetchGoals();
        document.getElementById("editGoalModal").style.display = "none";
    } catch (error) {
        console.error("Error updating goal:", error);
    }
}