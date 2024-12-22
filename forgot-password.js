document.getElementById('forgotPasswordForm').addEventListener('submit', async function(event) {
    event.preventDefault();
  
    // Fetch the email from the form
    const email = document.getElementById('email').value;
  
    if (email) {
      try {
        // Send reset password request to the backend
        const response = await fetch('http://localhost:5000/forgot-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email })
        });
  
        const data = await response.json();
  
        if (response.ok) {
          // If reset is successful, inform the user
          alert('Password reset link has been sent to your email.');
        } else {
          // If reset fails, show the error message
          alert(data.message || 'Reset failed, please try again.');
        }
      } catch (error) {
        alert('There was an error during password reset.');
        console.error(error);
      }
    } else {
      alert('Please enter your email.');
    }
  });
