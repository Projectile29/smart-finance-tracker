document.getElementById('resetPasswordForm').addEventListener('submit', async function(event) {
  event.preventDefault();

  const token = new URLSearchParams(window.location.search).get('token'); // Get token from URL
  const newPassword = document.getElementById('newPassword').value;

  if (!newPassword || !token) {
    alert('Please provide a valid password and token.');
    return;
  }

  try {
    const response = await fetch('http://localhost:5000/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, newPassword }),
    });

    const data = await response.json();

    if (response.ok) {
      alert('Password has been reset successfully.');
      window.location.href = '/login.html'; // Redirect to login after success
    } else {
      displayError(data.message || 'Failed to reset password.');
    }
  } catch (error) {
    displayError('There was an error during password reset.');
    console.error(error);
  }
});

function displayError(message) {
  const errorMessage = document.createElement('p');
  errorMessage.id = 'error-message';
  errorMessage.textContent = message;
  errorMessage.style.color = 'red';
  document.querySelector('.form-section').appendChild(errorMessage); // Append the error message
}
