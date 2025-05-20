// Base URL for API calls
const API_BASE_URL = "http://localhost:5000";

// Prevent duplicate AI predictions fetch
window.hasFetchedPredictions = false;

// Initialize local storage for goals if it doesn't exist
if (!localStorage.getItem('goals')) {
  localStorage.setItem('goals', JSON.stringify([]));
}

// Initialize notification system
if (!localStorage.getItem('notifications')) {
  localStorage.setItem('notifications', JSON.stringify([]));
}

// DOM elements
const backdrop = document.getElementById('backdrop');
const goalModal = document.getElementById('goalModal');
const editGoalModal = document.getElementById('editGoalModal');
const goalProjectionModal = document.getElementById('goalProjectionModal');
const notificationPanel = document.getElementById('notificationPanel');
const addGoalBtn = document.getElementById('addGoalBtn');
const addGoalForm = document.getElementById('addGoalForm');
const editGoalForm = document.getElementById('editGoalForm');
const deleteGoalBtn = document.getElementById('deleteGoalBtn');
const viewButtons = document.querySelectorAll('.view-btn');
const cardView = document.getElementById('goalsCardView');
const timelineView = document.getElementById('goalsTimelineView');
const notificationList = document.getElementById('notificationList');

// Stats elements
const totalGoalsCount = document.getElementById('totalGoalsCount');
const totalTargetAmount = document.getElementById('totalTargetAmount');
const totalSavedAmount = document.getElementById('totalSavedAmount');
const averageProgress = document.getElementById('averageProgress');

document.addEventListener("DOMContentLoaded", () => {
    initializeEventListeners();
    loadGoals();
    loadNotifications();
    updateViewToggle();

    if (!window.hasFetchedPredictions) {
        window.hasFetchedPredictions = true; // Prevent multiple calls
        setTimeout(() => fetchGoalPredictions(), 500); // Ensure inputs exist
    }
});

function initializeEventListeners() {
    // Modal triggers
    addGoalBtn?.addEventListener("click", openAddGoalModal);
    
    // Close buttons for modals
    document.querySelectorAll(".close").forEach(closeBtn => {
        closeBtn.addEventListener("click", closeAllModals);
    });
    
    // Form submissions
    addGoalForm?.addEventListener("submit", (e) => {
        e.preventDefault();
        saveGoal();
    });
    
    // Ensure edit form submission is registered
    if (editGoalForm) {
        editGoalForm.removeEventListener("submit", saveEditedGoal); // Prevent duplicate listeners
        editGoalForm.addEventListener("submit", (e) => {
            e.preventDefault();
            console.log("Edit form submitted");
            saveEditedGoal();
        });
    }
    
    // Delete goal button
    deleteGoalBtn?.addEventListener("click", deleteGoal);
    
    // View toggle buttons
    viewButtons.forEach(button => {
        button.addEventListener('click', () => {
            const viewType = button.getAttribute('data-view');
            toggleView(viewType);
        });
    });
    
    // Close notification panel when clicking outside
    document.addEventListener("click", function(event) {
        if (!notificationPanel.contains(event.target) && 
            !event.target.matches('.notification-bell')) {
            notificationPanel.classList.remove("show");
        }
    });
    
    // Close modals when clicking on backdrop
    backdrop.addEventListener("click", closeAllModals);
}

// Modal Functions
function openAddGoalModal() {
    goalModal.classList.add("active");
    backdrop.classList.add("active");
    document.getElementById('addGoalForm').reset();
}

function openEditGoalModal(goal) {
    console.log("Opening edit modal for goal:", goal);
    document.getElementById('editGoalId').value = goal.id || goal._id;
    document.getElementById('editGoalName').value = goal.name;
    document.getElementById('editGoalCategory').value = goal.category;
    document.getElementById('editTargetAmount').value = goal.targetAmount;
    document.getElementById('editCurrentSavings').value = goal.currentSavings;
    
    if (goal.targetDate) {
        document.getElementById('editTargetDate').value = goal.targetDate;
    } else {
        document.getElementById('editTargetDate').value = '';
    }
    
    editGoalModal.classList.add("active");
    backdrop.classList.add("active");
}

function openGoalProjectionModal(goal) {
    // Fill in the projection modal with goal data
    document.getElementById('projectionGoalName').textContent = goal.name;
    document.getElementById('projectionCurrentSavings').textContent = `₹${goal.currentSavings}`;
    document.getElementById('projectionTargetAmount').textContent = `₹${goal.targetAmount}`;
    
    const progressPercent = Math.min(100, (goal.currentSavings / goal.targetAmount) * 100);
    document.getElementById('projectionProgressPercent').textContent = `${progressPercent.toFixed(1)}%`;
    document.getElementById('projectionProgressBar').style.width = `${progressPercent}%`;
    document.getElementById('projectionProgressBar').className = `progress-bar ${goal.category}`;
    
    // Calculate monthly savings needed
    let monthsRemaining = 12; // Default to 12 months if no target date
    if (goal.targetDate) {
        const targetDate = new Date(goal.targetDate);
        const today = new Date();
        monthsRemaining = (targetDate.getFullYear() - today.getFullYear()) * 12 + 
                        (targetDate.getMonth() - today.getMonth());
        if (monthsRemaining < 1) monthsRemaining = 1; // Minimum 1 month
    }
    
    const amountNeeded = goal.targetAmount - goal.currentSavings;
    const monthlySavingsNeeded = amountNeeded / monthsRemaining;
    
    document.getElementById('projectionMonthlySavings').textContent = `₹${monthlySavingsNeeded.toFixed(2)}`;
    document.getElementById('projectionTimeRemaining').textContent = `${monthsRemaining} months`;
    
    // Calculate projected completion date
    const today = new Date();
    const completionDate = new Date(today);
    completionDate.setMonth(today.getMonth() + monthsRemaining);
    const options = { year: 'numeric', month: 'long' };
    document.getElementById('projectionCompletionDate').textContent = 
        `Projected completion by ${completionDate.toLocaleDateString('en-US', options)}`;
    
    // Generate AI suggestions
    generateAISuggestions(goal, monthlySavingsNeeded);
    
    goalProjectionModal.classList.add("active");
    backdrop.classList.add("active");
}

function closeAllModals() {
    goalModal.classList.remove("active");
    editGoalModal.classList.remove("active");
    goalProjectionModal.classList.remove("active");
    backdrop.classList.remove("active");
}

// Toggle between card and timeline views
function toggleView(viewType) {
    viewButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-view') === viewType) {
            btn.classList.add('active');
        }
    });
    
    if (viewType === 'cards') {
        cardView.classList.remove('hidden');
        timelineView.classList.add('hidden');
    } else if (viewType === 'timeline') {
        cardView.classList.add('hidden');
        timelineView.classList.remove('hidden');
    }
    
    localStorage.setItem('preferredView', viewType);
}

function updateViewToggle() {
    const preferredView = localStorage.getItem('preferredView') || 'cards';
    toggleView(preferredView);
}

// Goal Management Functions
async function loadGoals() {
    try {
        // First try to fetch from API
        try {
            const response = await fetch(`${API_BASE_URL}/goals`);
            if (response.ok) {
                const goals = await response.json();
                console.log('API fetched goals:', goals);
                // Map _id to id for consistency
                const normalizedGoals = goals.map(goal => ({
                    ...goal,
                    id: goal._id,
                    _id: goal._id // Preserve _id for API compatibility
                }));
                localStorage.setItem('goals', JSON.stringify(normalizedGoals));
                displayGoals(normalizedGoals);
                updateGoalStats(normalizedGoals);
                return;
            }
        } catch (error) {
            console.warn("API not available, using local storage.", error);
        }
        
        // Fallback to local storage
        let goals = JSON.parse(localStorage.getItem('goals')) || [];
        // Normalize existing localStorage goals (map _id to id if needed)
        goals = goals.map(goal => ({
            ...goal,
            id: goal.id || goal._id,
            _id: goal._id || goal.id
        }));
        console.log('Normalized localStorage goals:', goals);
        localStorage.setItem('goals', JSON.stringify(goals));
        displayGoals(goals);
        updateGoalStats(goals);
    } catch (error) {
        console.error("Error loading goals:", error);
        addNotification("Error loading goals. Please try again.");
    }
}

function displayGoals(goals) {
    // Clear both views
    cardView.innerHTML = '';
    timelineView.innerHTML = '';
    
    if (goals.length === 0) {
        cardView.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bullseye fa-3x"></i>
                <h3>No Goals Yet</h3>
                <p>Click "Add Goal" to start tracking your financial goals.</p>
            </div>
        `;
        return;
    }
    
    // Sort goals by target date (if available)
    const sortedGoals = [...goals].sort((a, b) => {
        if (!a.targetDate) return 1;
        if (!b.targetDate) return -1;
        return new Date(a.targetDate) - new Date(b.targetDate);
    });
    
    // Create timeline
    const timeline = document.createElement('div');
    timeline.className = 'timeline';
    timelineView.appendChild(timeline);
    
    // Display each goal
    sortedGoals.forEach((goal, index) => {
        // Add to card view
        cardView.appendChild(createGoalCard(goal));
        
        // Add to timeline view
        timeline.appendChild(createTimelineItem(goal, index));
    });
}

function createGoalCard(goal) {
    const progressPercent = Math.min(100, (goal.currentSavings / goal.targetAmount) * 100);
    
    const goalCard = document.createElement('div');
    goalCard.className = 'goal-card';
    goalCard.innerHTML = `
        <div class="goal-card-header ${goal.category || 'other'}">
            <span>${getCategoryName(goal.category)}</span>
            <i class="${getCategoryIcon(goal.category)}"></i>
        </div>
        <div class="goal-card-body">
            <h3 class="goal-card-title">${goal.name}</h3>
            <div class="goal-amount">
                <span class="goal-saved">₹${goal.currentSavings}</span>
                <span class="goal-target">/ ₹${goal.targetAmount}</span>
            </div>
            <div class="goal-progress">
                <div class="progress-text">
                    <span>Progress</span>
                    <span class="progress-percentage">${progressPercent.toFixed(1)}%</span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar ${goal.category || 'other'}" style="width: ${progressPercent}%"></div>
                </div>
            </div>
            ${goal.targetDate ? `
                <div class="goal-date">
                    <i class="fas fa-calendar-alt"></i>
                    <span>Target: ${formatDate(goal.targetDate)}</span>
                </div>
            ` : ''}
            <div class="goal-card-actions">
                <div class="goal-action-btn edit" onclick="editGoalById('${goal._id}')">
                    <i class="fas fa-pencil-alt"></i> Edit
                </div>
                <div class="goal-action-btn project" onclick="projectGoalById('${goal._id}')">
                    <i class="fas fa-chart-line"></i> Project
                </div>
            </div>
        </div>
    `;
    
    return goalCard;
}

function createTimelineItem(goal, index) {
    const item = document.createElement('div');
    item.className = 'timeline-item';
    if (index % 2 === 0) {
        item.classList.add('left');
    } else {
        item.classList.add('right');
    }
    
    const progressPercent = Math.min(100, (goal.currentSavings / goal.targetAmount) * 100);
    
    item.innerHTML = `
        <div class="timeline-content">
            ${goal.targetDate ? `<div class="timeline-date">${formatDate(goal.targetDate)}</div>` : ''}
            <h3>${goal.name}</h3>
            <p><i class="${getCategoryIcon(goal.category)}"></i> ${getCategoryName(goal.category)}</p>
            <div class="goal-amount">
                <span class="goal-saved">₹${goal.currentSavings}</span>
                <span class="goal-target">/ ₹${goal.targetAmount}</span>
            </div>
            <div class="goal-progress">
                <div class="progress-bar-container">
                    <div class="progress-bar ${goal.category || 'other'}" style="width: ${progressPercent}%"></div>
                </div>
                <div class="progress-text">
                    <span class="progress-percentage">${progressPercent.toFixed(1)}% complete</span>
                </div>
            </div>
            <div class="timeline-actions">
                <button onclick="editGoalById('${goal._id}')"><i class="fas fa-pencil-alt"></i></button>
                <button onclick="projectGoalById('${goal._id}')"><i class="fas fa-chart-line"></i></button>
            </div>
        </div>
    `;
    
    return item;
}

function editGoalById(goalId) {
    console.log('Editing goal with ID:', goalId);
    if (!goalId || goalId === 'undefined') {
        console.error('Invalid or undefined goal ID');
        addNotification('Cannot edit goal: Invalid ID.');
        return;
    }
    const goals = JSON.parse(localStorage.getItem('goals')) || [];
    console.log('Goals in localStorage:', goals);
    const goal = goals.find(g => g.id === goalId || g._id === goalId);
    
    if (goal) {
        console.log('Found goal:', goal);
        openEditGoalModal(goal);
    } else {
        console.log('Goal not found for ID:', goalId);
        addNotification("Goal not found.");
    }
}

function projectGoalById(goalId) {
    const goals = JSON.parse(localStorage.getItem('goals')) || [];
    const goal = goals.find(g => g.id === goalId || g._id === goalId);
    
    if (goal) {
        openGoalProjectionModal(goal);
    } else {
        addNotification("Goal not found.");
    }
}

async function saveGoal() {
    const name = document.getElementById('goalName').value.trim();
    const category = document.getElementById('goalCategory').value;
    const targetAmount = parseFloat(document.getElementById('targetAmount').value);
    const currentSavings = parseFloat(document.getElementById('currentSavings').value);
    const targetDate = document.getElementById('targetDate').value;
    
    if (!name || isNaN(targetAmount) || isNaN(currentSavings)) {
        addNotification("Please fill in all required fields.");
        return;
    }
    
    const newGoal = {
        id: generateId(),
        name,
        category,
        targetAmount,
        currentSavings,
        targetDate: targetDate || null,
        createdAt: new Date().toISOString()
    };
    
    console.log('Generated new goal with ID:', newGoal.id);
    console.log('New goal object:', newGoal);
    
    try {
        // Try to save to API first
        try {
            const response = await fetch(`${API_BASE_URL}/goals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    category,
                    targetAmount,
                    currentSavings,
                    targetDate: targetDate || null,
                    createdAt: newGoal.createdAt
                })
            });
            
            if (response.ok) {
                const savedGoal = await response.json();
                console.log('API response goal:', savedGoal);
                // Map _id to id for consistency
                const normalizedGoal = {
                    ...savedGoal,
                    id: savedGoal._id,
                    _id: savedGoal._id // Preserve _id for API compatibility
                };
                updateLocalGoal(normalizedGoal);
                addNotification(`Goal "${name}" created successfully!`);
                closeAllModals();
                loadGoals();
                return;
            }
        } catch (error) {
            console.warn("API not available, saving to local storage only.", error);
        }
        
        // Fallback to local storage
        const goals = JSON.parse(localStorage.getItem('goals')) || [];
        console.log('Goals before adding new goal:', goals);
        // Use local goal with generated id
        const normalizedGoal = {
            ...newGoal,
            _id: newGoal.id // Add _id for consistency
        };
        goals.push(normalizedGoal);
        localStorage.setItem('goals', JSON.stringify(goals));
        console.log('Goals after adding new goal:', goals);
        
        addNotification(`Goal "${name}" created successfully!`);
        closeAllModals();
        loadGoals();
    } catch (error) {
        console.error("Error saving goal:", error);
        addNotification("Error saving goal. Please try again.");
    }
}

async function saveEditedGoal() {
    console.log("Starting saveEditedGoal");
    const id = document.getElementById('editGoalId').value;
    const name = document.getElementById('editGoalName').value.trim();
    const category = document.getElementById('editGoalCategory').value;
    const targetAmount = parseFloat(document.getElementById('editTargetAmount').value);
    const currentSavings = parseFloat(document.getElementById('editCurrentSavings').value);
    const targetDate = document.getElementById('editTargetDate').value;
    
    console.log('Saving edited goal:', { id, name, category, targetAmount, currentSavings, targetDate });
    
    if (!name || isNaN(targetAmount) || isNaN(currentSavings)) {
        addNotification("Please fill in all required fields.");
        console.log("Validation failed: Missing required fields");
        return;
    }
    
    const updatedGoal = {
        id,
        _id: id, // Ensure _id is included for API compatibility
        name,
        category,
        targetAmount,
        currentSavings,
        targetDate: targetDate || null,
        updatedAt: new Date().toISOString()
    };
    
    try {
        // Skip API call to ensure editing works with localStorage
        /*
        try {
            const response = await fetch(`${API_BASE_URL}/goals/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedGoal)
            });
            
            if (response.ok) {
                updateLocalGoal(updatedGoal);
                addNotification(`Goal "${name}" updated successfully!`);
                closeAllModals();
                loadGoals();
                return;
            }
        } catch (error) {
            console.warn("API not available, updating local storage only.", error);
        }
        */
        
        // Fallback to local storage
        const goals = JSON.parse(localStorage.getItem('goals')) || [];
        console.log('Goals before update:', goals);
        const goalIndex = goals.findIndex(g => g.id === id || g._id === id);
        
        if (goalIndex !== -1) {
            // Preserve created date
            updatedGoal.createdAt = goals[goalIndex].createdAt;
            goals[goalIndex] = updatedGoal;
            localStorage.setItem('goals', JSON.stringify(goals));
            console.log('Goals after update:', goals);
            
            addNotification(`Goal "${name}" updated successfully!`);
            closeAllModals();
            loadGoals();
        } else {
            addNotification("Goal not found. Could not update.");
            console.log("Goal not found for ID:", id);
        }
    } catch (error) {
        console.error("Error updating goal:", error);
        addNotification("Error updating goal. Please try again.");
    }
}

async function deleteGoal() {
    const id = document.getElementById('editGoalId').value;
    const name = document.getElementById('editGoalName').value;
    
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
        try {
            // Try API first
            try {
                const response = await fetch(`${API_BASE_URL}/goals/${id}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    removeLocalGoal(id);
                    addNotification(`Goal "${name}" deleted.`);
                    closeAllModals();
                    loadGoals();
                    return;
                }
            } catch (error) {
                console.warn("API not available, deleting from local storage only.", error);
            }
            
            // Fallback to local storage
            const goals = JSON.parse(localStorage.getItem('goals')) || [];
            const updatedGoals = goals.filter(g => g.id !== id && g._id !== id);
            localStorage.setItem('goals', JSON.stringify(updatedGoals));
            
            addNotification(`Goal "${name}" deleted.`);
            closeAllModals();
            loadGoals();
        } catch (error) {
            console.error("Error deleting goal:", error);
            addNotification("Error deleting goal. Please try again.");
        }
    }
}

function updateLocalGoal(goal) {
    const goals = JSON.parse(localStorage.getItem('goals')) || [];
    const existingIndex = goals.findIndex(g => g.id === goal.id || g._id === goal.id);
    
    if (existingIndex !== -1) {
        goals[existingIndex] = goal;
    } else {
        goals.push(goal);
    }
    
    localStorage.setItem('goals', JSON.stringify(goals));
}

function removeLocalGoal(goalId) {
    const goals = JSON.parse(localStorage.getItem('goals')) || [];
    const updatedGoals = goals.filter(g => g.id !== goalId && g._id !== goalId);
    localStorage.setItem('goals', JSON.stringify(updatedGoals));
}

function updateGoalStats(goals) {
    // Calculate stats
    const totalGoals = goals.length;
    const totalTarget = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
    const totalSaved = goals.reduce((sum, goal) => sum + goal.currentSavings, 0);
    
    let avgProgressValue = 0;
    if (totalGoals > 0) {
        const totalProgress = goals.reduce((sum, goal) => {
            return sum + (goal.currentSavings / goal.targetAmount * 100);
        }, 0);
        avgProgressValue = totalProgress / totalGoals;
    }
    
    // Update DOM
    totalGoalsCount.textContent = totalGoals;
    totalTargetAmount.textContent = `₹${totalTarget.toLocaleString()}`;
    totalSavedAmount.textContent = `₹${totalSaved.toLocaleString()}`;
    averageProgress.textContent = `${avgProgressValue.toFixed(1)}%`;
}

// AI and Prediction Functions
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
        return data;
    } catch (error) {
        console.error("Error fetching AI predictions:", error);
        return null;
    }
}

function generateAISuggestions(goal, monthlySavingsNeeded) {
    const suggestionsList = document.getElementById('projectionSuggestions');
    suggestionsList.innerHTML = '';
    
    const suggestions = [
        `Save ₹${Math.ceil(monthlySavingsNeeded / 30)} per day to reach your target.`,
        `Try reducing discretionary expenses by 5% to increase savings.`,
        `Consider setting up an automatic transfer of ₹${Math.ceil(monthlySavingsNeeded / 4)} per week.`
    ];
    
    if (goal.category === 'travel') {
        suggestions.push('Look for off-season travel deals to reduce your target amount.');
    } else if (goal.category === 'purchase') {
        suggestions.push('Check for upcoming sales or discounts for your planned purchase.');
    } else if (goal.category === 'emergency') {
        suggestions.push('Once achieved, consider investing a portion in higher-yield options.');
    }
    
    suggestions.forEach(suggestion => {
        const li = document.createElement('li');
        li.textContent = suggestion;
        suggestionsList.appendChild(li);
    });
}

// Notification Functions
function loadNotifications() {
    const notifications = JSON.parse(localStorage.getItem('notifications')) || [];
    
    notificationList.innerHTML = '';
    notifications.forEach(notification => {
        const li = document.createElement('li');
        li.textContent = notification;
        notificationList.appendChild(li);
    });
}

function addNotification(message) {
    const notifications = JSON.parse(localStorage.getItem('notifications')) || [];
    
    // Add timestamp to notification
    const now = new Date();
    const timestampedMessage = `${message} (${now.toLocaleTimeString()})`;
    
    notifications.push(timestampedMessage);
    // Keep only latest 10 notifications
    if (notifications.length > 10) {
        notifications.shift();
    }
    
    localStorage.setItem('notifications', JSON.stringify(notifications));
    
    // Update UI
    const li = document.createElement('li');
    li.textContent = timestampedMessage;
    notificationList.appendChild(li);
    
    // Show notification briefly
    const notificationToast = document.createElement('div');
    notificationToast.className = 'notification-toast';
    notificationToast.textContent = message;
    document.body.appendChild(notificationToast);
    
    setTimeout(() => {
        notificationToast.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notificationToast.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notificationToast);
        }, 300);
    }, 3000);
}

function toggleNotifications() {
    notificationPanel.classList.toggle('show');
}

function clearNotifications() {
    localStorage.setItem('notifications', JSON.stringify([]));
    notificationList.innerHTML = '';
}

// Utility Functions
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function formatDate(dateString) {
    if (!dateString) return 'No Date Set';
    
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function getCategoryName(category) {
    const categories = {
        'travel': 'Travel',
        'education': 'Education',
        'purchase': 'Major Purchase',
        'emergency': 'Emergency Fund',
        'retirement': 'Retirement',
        'other': 'Other'
    };
    
    return categories[category] || 'Other';
}

function getCategoryIcon(category) {
    const icons = {
        'travel': 'fas fa-plane',
        'education': 'fas fa-graduation-cap',
        'purchase': 'fas fa-shopping-cart',
        'emergency': 'fas fa-medkit',
        'retirement': 'fas fa-umbrella-beach',
        'other': 'fas fa-tag'
    };
    
    return icons[category] || 'fas fa-tag';
}

// Dark mode toggle
function toggleDarkMode() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('darkMode', isDark ? 'true' : 'false');
}

// Load dark mode preference
(function loadDarkModePreference() {
    const isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) {
        document.body.classList.add('dark');
    }
})();