document.getElementById("addGoalBtn").addEventListener("click", function () {
    document.getElementById("goalModal").style.display = "block";
  });
  
  document.querySelector(".close").addEventListener("click", function () {
    document.getElementById("goalModal").style.display = "none";
  });
  
  document.getElementById("saveGoalBtn").addEventListener("click", function () {
    let goalName = document.getElementById("goalName").value;
    let targetAmount = parseInt(document.getElementById("targetAmount").value, 10);
    let currentSavings = parseInt(document.getElementById("currentSavings").value, 10);
  
    if (!goalName || isNaN(targetAmount) || isNaN(currentSavings)) {
      alert("Please enter valid details.");
      return;
    }
  
    let goalCard = document.createElement("div");
    goalCard.classList.add("goal-card");
  
    let progressPercent = (currentSavings / targetAmount) * 100;
    let stepValue = Math.ceil(targetAmount * 0.05); // Step = 5% of target amount
  
    goalCard.innerHTML = `
  <h3>${goalName} 
    <span class="edit-icon"><i class="fas fa-edit"></i></span> 
    <span class="delete-icon"><i class="fas fa-trash"></i></span>
  </h3>
  <p><strong>Target Amount:</strong> ₹${targetAmount}</p>
  <p><strong>Current Savings:</strong> ₹<span class="current-savings">${currentSavings}</span></p>
  <div class="progress-bar"><div class="progress" style="width: ${progressPercent}%"></div></div>
  <div class="adjust-buttons">
    <button class="decrease">−</button>
    <button class="increase">+</button>
  </div>
`;
  
    document.getElementById("goalsContainer").appendChild(goalCard);
    document.getElementById("goalModal").style.display = "none";
  
    // Clear input fields
    document.getElementById("goalName").value = "";
    document.getElementById("targetAmount").value = "";
    document.getElementById("currentSavings").value = "";
  
    // Select elements inside the goal card
    let savingsElement = goalCard.querySelector(".current-savings");
    let progressElement = goalCard.querySelector(".progress");
    let increaseBtn = goalCard.querySelector(".increase");
    let decreaseBtn = goalCard.querySelector(".decrease");
    let editIcon = goalCard.querySelector(".edit-icon");
    let deleteIcon = goalCard.querySelector(".delete-icon");
  
    // Increase Button Function
    increaseBtn.addEventListener("click", function () {
      let newSavings = parseInt(savingsElement.textContent) + stepValue;
      if (newSavings > targetAmount) newSavings = targetAmount;
      savingsElement.textContent = newSavings;
      progressElement.style.width = (newSavings / targetAmount) * 100 + "%";
    });
  
    // Decrease Button Function
    decreaseBtn.addEventListener("click", function () {
      let newSavings = parseInt(savingsElement.textContent) - stepValue;
      if (newSavings < 0) newSavings = 0;
      savingsElement.textContent = newSavings;
      progressElement.style.width = (newSavings / targetAmount) * 100 + "%";
    });
  
    // Edit Current Savings Directly
    editIcon.addEventListener("click", function () {
      let newInput = document.createElement("input");
      newInput.type = "number";
      newInput.value = savingsElement.textContent;
      newInput.classList.add("edit-input");
  
      savingsElement.replaceWith(newInput);
      newInput.focus();
  
      newInput.addEventListener("blur", function () {
        let updatedSavings = parseInt(newInput.value);
        if (isNaN(updatedSavings) || updatedSavings < 0) {
          updatedSavings = 0;
        }
        if (updatedSavings > targetAmount) {
          updatedSavings = targetAmount;
        }
  
        savingsElement.textContent = updatedSavings;
        newInput.replaceWith(savingsElement);
        progressElement.style.width = (updatedSavings / targetAmount) * 100 + "%";
      });
  
      newInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
          newInput.blur();
        }
      });
    });
  
    // Delete Goal with Confirmation
    deleteIcon.addEventListener("click", function () {
      document.getElementById("deleteModal").style.display = "block";
  
      document.getElementById("confirmDelete").onclick = function () {
        goalCard.remove();
        document.getElementById("deleteModal").style.display = "none";
      };
  
      document.getElementById("cancelDelete").onclick = function () {
        document.getElementById("deleteModal").style.display = "none";
      };
    });
  });
  