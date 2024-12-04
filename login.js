// Handle form submission
document.getElementById('loginForm').addEventListener('submit', function(event) {
    event.preventDefault();
  
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
  
    if (username && password) {
      alert(`Welcome, ${username}!`);
      // Add logic to verify the credentials via server-side (if needed)
    } else {
      alert('Please enter both username and password.');
    }
  });
  