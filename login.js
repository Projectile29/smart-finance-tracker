document.getElementById('loginForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    // Fetch values from the form
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (email && password) {
        try {
            // Send login request to the backend
            const response = await fetch('http://localhost:5000/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            console.log('Response Status:', response.status); // Log response status

            if (response.ok) {
                const data = await response.json();
                console.log('Response Data:', data); // Log response data
                
                // ✅ Store user email in localStorage and sessionStorage
                localStorage.setItem('userEmail', email);
                sessionStorage.setItem('userEmail', email);

                // Redirect to the dashboard
                alert(`Welcome, ${email}!`);
                window.location.href = "/dashboard.html";
            } else {
                const data = await response.json();
                alert(data.message || "Login failed, please try again.");
            }
        } catch (error) {
            alert("There was an error during login.");
            console.error('Error during login:', error);
        }
    } else {
        alert('Please enter both email and password.');
    }
});
