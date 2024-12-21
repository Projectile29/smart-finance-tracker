document.getElementById('loginForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    // Fetch values from the form
    const email = document.getElementById('email').value;  // Use 'email' if the input field ID is 'email'
    const password = document.getElementById('password').value;

    if (email && password) {
        try {
            // Send login request to the backend
            const response = await fetch('http://localhost:5000/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }), // Send the email and password
            });

            const data = await response.json();

            if (response.ok) {
                // If login is successful, redirect to the dashboard
                alert(`Welcome, ${email}!`);
                window.location.href = "/dashboard.html"; // Redirect to dashboard
            } else {
                // If login fails, show the error message
                alert(data.message || "Login failed, please try again.");
            }
        } catch (error) {
            alert("There was an error during login.");
            console.error(error);
        }
    } else {
        alert('Please enter both email and password.');
    }
});
