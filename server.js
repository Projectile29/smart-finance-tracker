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
app.use(express.urlencoded({ extended: true }));

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
});
app.use(limiter);

app.use('/uploads', express.static('uploads'));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI) // Removed deprecated options
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
  salaryAmount: Number,   
    salaryDay: Number       
});

const User = mongoose.model('User', userSchema);

// Multer setup for profile picture uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Serve static images from "uploads" folder
app.use('/uploads', express.static('uploads'));

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

const moment = require('moment'); // Import moment.js for date handling

// 🟢 Generate Salary (Check if today is Salary Day)
app.get('/generate-salary', async (req, res) => {
  try {
      const { email } = req.query;
      if (!email) return res.status(400).json({ message: "Email is required" });

      console.log("Received email:", email);

      // Ensure we are querying the correct collection
      const user = await User.findOne({ email: { $regex: new RegExp("^" + email + "$", "i") } }).lean();

      if (!user) return res.status(404).json({ message: "User not found" });

      console.log("User found:", user);

      // Ensure the salary details exist
      if (!user.salaryDay || !user.salaryAmount) {
          return res.status(400).json({ message: "Salary details missing for this user" });
      }

      const today = new Date().getDate();
      const { salaryDay, salaryAmount } = user;

      if (today !== salaryDay) {
          return res.status(400).json({ message: `Today is not your salary day. Your salary day is on ${salaryDay}` });
      }

      return res.status(200).json({
          message: "Salary generated successfully",
          salaryAmount,
          salaryDay
      });

  } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
  }
});

// Endpoint to get salary
app.get("/salary", async (req, res) => {
  const email = req.query.email; // Get email from query params
  if (!email) {
      return res.status(400).json({ error: "Email is required" });
  }

  try {
      // ✅ Query the User model instead of db.collection
      const user = await User.findOne({ email: email });

      if (!user || user.salaryAmount === undefined) {
          return res.status(404).json({ error: "Salary not found for this email" });
      }

      res.json({ salary: user.salaryAmount });
  } catch (error) {
      console.error("Error fetching salary:", error);
      res.status(500).json({ error: "Internal Server Error" });
  }
});


// 🟢 Update Profile (Includes Salary Update)
app.put('/profile', upload.single('profilePic'), async (req, res) => {
  try {
    const { email, firstName, lastName, phone, salaryAmount, salaryDay } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    let updateFields = { firstName, lastName, phone };
    if (req.file) updateFields.profilePic = req.file.path;
    if (salaryAmount !== undefined) updateFields.salaryAmount = salaryAmount;
    if (salaryDay !== undefined) updateFields.salaryDay = salaryDay;

    const updatedUser = await User.findOneAndUpdate(
      { email: { $regex: new RegExp("^" + email + "$", "i") } }, 
      updateFields, 
      { new: true }
    ).lean();

    if (!updatedUser) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// 🟢 Get User Profile
app.get('/profile', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: { $regex: new RegExp("^" + email + "$", "i") } }).lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
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
  _id: mongoose.Schema.Types.ObjectId,
  transactionId: { type: Number, unique: true },
  amount: Number,
  category: String,
  date: Date,
  description: { type: String, default: "" }, // Make it optional with default value
});


const Transaction = mongoose.model("Transaction", transactionSchema);

// Get Monthly Savings Trend
app.get('/api/savings-trend', async (req, res) => {
  try {
      const transactions = await Transaction.aggregate([
          {
              $group: {
                  _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
                  totalIncome: {
                      $sum: { $cond: [{ $eq: ["$type", "Income"] }, "$amount", 0] }
                  },
                  totalExpense: {
                      $sum: { $cond: [{ $eq: ["$type", "Expense"] }, "$amount", 0] }
                  },
                  netSavings: {
                      $sum: {
                          $cond: [
                              { $eq: ["$type", "Income"] },
                              "$amount",
                              { $multiply: ["$amount", -1] }
                          ]
                      }
                  }
              }
          },
          { $sort: { "_id": 1 } }
      ]);
      res.json(transactions);
  } catch (error) {
      res.status(500).json({ error: 'Error fetching savings trend' });
  }
});

app.get("/transactions", async (req, res) => {
  try {
    const transactions = await Transaction.find();
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/transactions", async (req, res) => {
  try {
      console.log("Received request:", req.body);

      const { category, amount, date, description = "" } = req.body;

      // Convert amount to a number
      const amountValue = parseFloat(amount);
      if (isNaN(amountValue)) {
          return res.status(400).json({ error: "Invalid amount. Must be a number." });
      }

      // Find last transaction and auto-increment ID
      const lastTransaction = await Transaction.findOne().sort({ transactionId: -1 });
      const transactionId = lastTransaction ? lastTransaction.transactionId + 1 : 1;

      const newTransaction = new Transaction({
          _id: new mongoose.Types.ObjectId(),
          transactionId, 
          category,
          amount: amountValue, // Store as number
          date: new Date(date), // Ensure valid date
          description
      });

      await newTransaction.save();
      console.log("Transaction saved:", newTransaction);

      res.status(201).json({ message: "Transaction added successfully", transactionId });

  } catch (error) {
      console.error("Error adding transaction:", error);
      res.status(500).json({ error: error.message });
  }
});

const Goal = require("./models/goal.model"); // Importing the model

const goalSchema = new mongoose.Schema({
  name: { type: String, required: true },
  targetAmount: { type: Number, required: true },
  currentSavings: { type: Number, required: true }
});


// 🟢 GET All Goals
app.get('/goals', async (req, res) => {
  try {
      const goals = await Goal.find();  
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
      if (!name || !targetAmount || !currentSavings) {
          return res.status(400).json({ error: "Missing required fields" });
      }

      const newGoal = new Goal({ name, targetAmount, currentSavings });
      await newGoal.save();
      res.status(201).json(newGoal);
  } catch (error) {
      console.error("Error saving goal:", error);
      res.status(500).json({ error: "Internal Server Error" });
  }
});


// 🟢 PUT Update a Goal
app.put("/goals/:id", async (req, res) => {
  try {
    const { name, targetAmount, currentSavings, completed } = req.body;
    
    const updatedGoal = await Goal.findByIdAndUpdate(
      req.params.id,
      { name, targetAmount, currentSavings, completed },
      { new: true, runValidators: true }
    );

    if (!updatedGoal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    res.json(updatedGoal);
  } catch (err) {
    console.error("Error updating goal:", err);
    res.status(500).json({ error: "Internal Server Error" });
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

app.get("/goals/:id/projection", async (req, res) => {
  try {
      const goal = await Goal.findById(req.params.id);
      if (!goal) return res.status(404).json({ error: "Goal not found" });

      // Example projection logic (Modify as per your logic)
      const monthsRequired = Math.ceil((goal.targetAmount - goal.currentSavings) / 100); 
      const projectedCompletionDate = new Date();
      projectedCompletionDate.setMonth(projectedCompletionDate.getMonth() + monthsRequired);

      res.json({
          projectedCompletionDate: projectedCompletionDate.toDateString(),
          estimatedMonths: monthsRequired,
          status: monthsRequired > 0 ? "In Progress" : "Completed"
      });
  } catch (error) {
      res.status(500).json({ error: "Error fetching projection" });
  }
});

// Endpoint to handle profile saving
app.post("/api/saveProfile", (req, res) => {
  console.log("Received data:", req.body);
  res.json({ message: "Profile saved successfully!" });
});

app.post('/api/goal-projection', async (req, res) => {
  const { targetAmount, currentSavings } = req.body;

  try {
      const savingsTrend = await Transaction.aggregate([
          {
              $group: {
                  _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
                  netSavings: {
                      $sum: {
                          $cond: [
                              { $eq: ["$type", "Income"] },
                              "$amount",
                              { $multiply: ["$amount", -1] }
                          ]
                      }
                  }
              }
          },
          { $sort: { "_id": -1 } }, // Get recent months first
          { $limit: 6 } // Consider last 6 months for trend analysis
      ]);

      const avgMonthlySavings = savingsTrend.reduce((acc, cur) => acc + cur.netSavings, 0) / savingsTrend.length;
      const monthsNeeded = Math.ceil((targetAmount - currentSavings) / avgMonthlySavings);

      res.json({
          avgMonthlySavings,
          monthsNeeded,
          projectedCompletionDate: new Date(new Date().setMonth(new Date().getMonth() + monthsNeeded)).toDateString()
      });

  } catch (error) {
      res.status(500).json({ error: 'Error calculating projection' });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});