const nodemailer = require('nodemailer');
require('dotenv').config();

// Create a transporter using your Gmail account details (or any other SMTP provider)
const transporter = nodemailer.createTransport({
  service: 'gmail',  // You can use other services like SendGrid, Amazon SES, etc.
  auth: {
    user: process.env.EMAIL_USER, // Your email address
    pass: process.env.EMAIL_PASS, // Your email password or app password
  },
});

// Function to send a password reset email
const sendPasswordResetEmail = async (email, resetLink) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,  // Your email address
    to: email,                     // Recipient's email address (the user's email)
    subject: 'Password Reset Request',
    text: `Click this link to reset your password: ${resetLink}`,
    html: `<strong>Click this link to reset your password: <a href="${resetLink}">Reset Password</a></strong>`,
  };

  try {
    // Send the email
    await transporter.sendMail(mailOptions);
    console.log('Password reset email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

module.exports = sendPasswordResetEmail;
