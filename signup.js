document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById('signup-form');
  if (form) {
    form.addEventListener('submit', async function (event) {
      event.preventDefault();

      const name = document.getElementById('name').value;
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value; // <-- fixed here

      // Check if passwords match
      if (password !== confirmPassword) {
        alert("Passwords do not match!");
        return;
      }

      const response = await fetch('http://localhost:5000/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email, password })
      });

      const result = await response.json();

      if (response.status === 201) {
        alert('User created successfully');
        window.location.href = "/login.html";
      } else {
        alert(result.message || 'Something went wrong');
      }
    });
  } else {
    console.error("Form element not found!");
  }
});
