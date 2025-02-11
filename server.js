// Required imports
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const multer = require('multer');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

// Initialize Express app
const app = express();
const port = process.env.PORT || 5000;

// Enable CORS
app.use(cors());

app.use(express.json());

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
});
app.use(limiter);

app.use('/uploads', express.static('uploads'));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// User schema
const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true, required: true },
  password: String,
  phone: String,
  dob: String,
  gender: String,
  country: String,
  state: String,
  profilePic: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
});

const User = mongoose.model('User', userSchema);

// User Registration
app.post('/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, dob, gender, country, state, password } = req.body;

    // Check if user exists
    if (await User.findOne({ email })) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ firstName, lastName, email, phone, dob, gender, country, state, password: hashedPassword });

    await user.save();
    res.status(201).json({ message: "User Registered Successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Multer storage settings for better file handling
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Save to 'uploads' folder
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname); // Unique file name
  }
});

const upload = multer({ storage });

// Profile Picture Upload & Update Route
app.put('/profile', upload.single('profilePic'), async (req, res) => {
  try {
    const { email, firstName, lastName, phone, dob, gender, country, state } = req.body;
    
    if (!email) return res.status(400).json({ error: "Email is required" });

    const updateData = { firstName, lastName, phone, dob, gender, country, state };

    if (req.file) {
      updateData.profilePic = `/uploads/${req.file.filename}`;
    }

    const updatedUser = await User.findOneAndUpdate(
      { email },
      { $set: updateData },
      { new: true }
    );

    if (!updatedUser) return res.status(404).json({ error: "User not found" });

    res.json({ message: "Profile updated successfully!", profilePic: updateData.profilePic });
  } catch (error) {
    res.status(500).json({ error: "Error updating profile" });
  }
});


// User Login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) return res.status(400).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get User Profile
app.get('/profile', async (req, res) => {
  try {
    const { email } = req.query;
    console.log("Received email:", email); // Debugging

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Ensure case-insensitive search
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Password Reset Request
app.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Please enter your email' });

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).json({ message: 'If this email exists, a reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Password Reset Request',
      text: `Reset your password using this link: http://localhost:5000/reset-password?token=${resetToken}`,
    };

    transporter.sendMail(mailOptions, (error) => {
      if (error) return res.status(500).json({ message: 'Error sending email' });

      res.status(200).json({ message: 'Reset link sent if email exists.' });
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Reset Password
app.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ message: 'Token and new password are required' });

    const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });

    if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();
    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/reset-password', (req, res) => {
  res.sendFile(__dirname + '/reset-password.html'); // Serve an HTML form for resetting the password
});

const transactionSchema = new mongoose.Schema({
  amount: Number,
  category: String,
  date: Date,
  description: String,
});

const Transaction = mongoose.model("Transaction", transactionSchema);

app.get("/transactions", async (req, res) => {
  
  try {
    const transactions = await Transaction.find(); // Fetch from DB
    res.json(transactions); // Send JSON response
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Define the Goal Schema
const GoalSchema = new mongoose.Schema({
  name: String, // Changed from `title`
  targetAmount: { type: Number, required: true }, // Changed from `target`
  currentSavings: { type: Number, required: true }, // Changed from `savings`
  completed: { type: Boolean, default: false },
});



const Goal = mongoose.model("Goal", GoalSchema);

// 🟢 GET All Goals
app.get('/goals', async (req, res) => {
  try {
      const goals = await Goal.find();  // Make sure `Goal` model is defined
      res.json(goals);
  } catch (error) {
      console.error('Error fetching goals:', error);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});




// 🟢 POST Create a New Goal
app.post("/goals", async (req, res) => {
  try {
    const { name, targetAmount, currentSavings } = req.body;
    const newGoal = new Goal({ name, targetAmount, currentSavings });
    await newGoal.save();
    res.status(201).json(newGoal);
  } catch (err) {
    res.status(500).json({ error: "Error creating goal" });
  }
});


// 🟢 PUT Update a Goal
app.put("/goals/:id", async (req, res) => {
  try {
    const { name, description, target, savings, completed } = req.body;
    const updatedGoal = await Goal.findByIdAndUpdate(
      req.params.id,
      { title, description, target, savings, completed },
      { new: true, runValidators: true }  // ✅ Ensures validation rules apply
    );

    if (!updatedGoal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    res.json(updatedGoal);
  } catch (err) {
    res.status(500).json({ error: "Error updating goal" });
  }
});



// 🔴 DELETE a Goal
app.delete("/goals/:id", async (req, res) => {
  try {
    const deletedGoal = await Goal.findByIdAndDelete(req.params.id);

    if (!deletedGoal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    res.json({ message: "Goal deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Error deleting goal" });
  }
});


// Start Server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
