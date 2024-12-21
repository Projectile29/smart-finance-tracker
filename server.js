const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs'); // Import bcryptjs for hashing passwords
const cors = require('cors'); // Import the CORS package

require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS
app.use(cors()); // This will allow all origins by default

// Middleware
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

// User schema
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String
});

const User = mongoose.model('User', userSchema);

// API endpoint to handle signup
app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;

  // Simple validation (You can extend this)
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Please fill all fields' });
  }

  // Check if the email already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: 'Email already exists' });
  }

  // Hash the password before saving it
  const hashedPassword = await bcrypt.hash(password, 10); // 10 is the salt rounds

  // Create new user with hashed password
  const newUser = new User({ name, email, password: hashedPassword });

  await newUser.save();

  res.status(201).json({ message: 'User created successfully' });
});

// API endpoint to handle login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Validate email and password
  if (!email || !password) {
    return res.status(400).json({ message: 'Please fill all fields' });
  }

  // Find user by email
  const user = await User.findOne({ email });

  // If user not found, return an error
  if (!user) {
    return res.status(400).json({ message: 'User not found' });
  }

  // Compare entered password with hashed password in the database
  const isMatch = await bcrypt.compare(password, user.password);

  // If passwords don't match
  if (!isMatch) {
    return res.status(400).json({ message: 'Invalid password' });
  }

  // If login is successful
  res.status(200).json({ message: 'Login successful' });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
