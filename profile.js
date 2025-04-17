const API_BASE_URL = "http://localhost:5000"; // Backend server URL

document.addEventListener("DOMContentLoaded", async function () {
    const userEmail = localStorage.getItem("userEmail");

    if (!userEmail) {
        console.error("No email found in localStorage.");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/profile?email=${encodeURIComponent(userEmail)}`);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        const data = await response.json();
        console.log("User data received:", data);

        document.getElementById("first-name").value = data.firstName || "";
        document.getElementById("last-name").value = data.lastName || "";
        document.getElementById("email").value = data.email || "";
        document.getElementById("phone").value = data.phone || "";
        document.getElementById("dob").value = data.dob || "";
        document.getElementById("gender").value = data.gender || "";
        document.getElementById("country").value = data.country || "";
        document.getElementById("state").value = data.state || "";
        
        // to load salary data**
        document.getElementById("salary-amount").value = data.salaryAmount || "";
        document.getElementById("salary-day").value = data.salaryDay || "";

        // Set profile picture dynamically
        const profilePicElement = document.getElementById("profile-pic");
        profilePicElement.src = data.profilePic ? `${API_BASE_URL}${data.profilePic}` : "default-avatar.png";

        document.getElementById("user-name").textContent = `${data.firstName} ${data.lastName}`;
    } catch (error) {
        console.error("Error fetching profile:", error);
    }
});

document.getElementById("profile-pic-input").addEventListener("change", async function (event) {
    const file = event.target.files[0];

    if (!file) return;

    const formData = new FormData();
    formData.append("profilePic", file);
    formData.append("email", localStorage.getItem("userEmail")); // Ensure email is sent

    try {
        const response = await fetch(`${API_BASE_URL}/profile`, {
            method: "PUT",
            body: formData,
        });

        const data = await response.json();

        if (response.ok) {
            console.log("Profile updated:", data);

            // Update the image dynamically
            const profilePicElement = document.getElementById("profile-pic");
            profilePicElement.src = `${API_BASE_URL}${data.profilePic}?t=${new Date().getTime()}`;
        } else {
            console.error("Error updating profile:", data.error);
        }
    } catch (error) {
        console.error("Error uploading image:", error);
    }
});

async function saveProfile() {
    const userEmail = localStorage.getItem("userEmail");
    if (!userEmail) {
        alert("User email not found. Please log in.");
        return;
    }

    const updatedData = {
        firstName: document.getElementById("first-name").value.trim(),
        lastName: document.getElementById("last-name").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        dob: document.getElementById("dob").value,
        gender: document.getElementById("gender").value,
        country: document.getElementById("country").value,
        state: document.getElementById("state").value,
        email: userEmail,
        salaryAmount: document.getElementById("salary-amount").value.trim(),  
        salaryDay: document.getElementById("salary-day").value.trim() 
    };

    // Ensure salary fields are not empty (optional validation)
    if (!updatedData.salaryAmount || !updatedData.salaryDay) {
        alert("Please enter both salary amount and salary day.");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/profile`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(updatedData),
        });

        if (!response.ok) {
            const errorText = await response.text(); // Get detailed error message from backend
            throw new Error(`Failed to update profile: ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        console.log("Profile successfully updated:", data);
        alert("Profile updated successfully!");
    } catch (error) {
        console.error("Error updating profile:", error);
        alert("Error updating profile. Please try again.");
    }
}