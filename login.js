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

            console.log('Response Status:', response.status); // Log response status

            if (response.ok) {
                const data = await response.json();
                console.log('Response Data:', data); // Log response data
                // If login is successful, redirect to the dashboard
                alert(`Welcome, ${email}!`);
                window.location.href = "/dashboard.html"; // Redirect to dashboard
            } else {
                const data = await response.json();
                alert(data.message || "Login failed, please try again.");
            }
        } catch (error) {
            alert("There was an error during login.");
            console.error('Error during login:', error); // Log the error for more details
        }
    } else {
        alert('Please enter both email and password.');
    }
});
