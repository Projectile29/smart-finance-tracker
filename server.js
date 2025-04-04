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
const fs = require("fs");
const { spawn } = require("child_process");
const { PythonShell } = require("python-shell");
const path = require("path");


require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting (adjusted for development)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased to 1000 requests for development
  message: { error: "Too many requests from this IP, please try again later." }, // JSON response
});
app.use(limiter);

app.use('/uploads', express.static('uploads'));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// User Schema
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

// User Registration
app.post('/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, dob, gender, country, state, password } = req.body;
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

// Generate Salary
app.get('/generate-salary', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email: { $regex: new RegExp("^" + email + "$", "i") } }).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.salaryDay || !user.salaryAmount) {
      return res.status(400).json({ message: "Salary details missing for this user" });
    }

    const today = new Date().getDate();
    const { salaryDay, salaryAmount } = user;

    if (today !== salaryDay) {
      return res.status(400).json({ message: `Today is not your salary day. Your salary day is on ${salaryDay}` });
    }

    res.status(200).json({ message: "Salary generated successfully", salaryAmount, salaryDay });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get Salary
app.get("/salary", async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const user = await User.findOne({ email });
    if (!user || user.salaryAmount === undefined) {
      return res.status(404).json({ error: "Salary not found for this email" });
    }
    res.json({ salary: user.salaryAmount });
  } catch (error) {
    console.error("Error fetching salary:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Update Profile
app.put('/profile', upload.single('profilePic'), async (req, res) => {
  try {
    const { email, firstName, lastName, phone, salaryAmount, salaryDay } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    let updateFields = { firstName, lastName, phone };
    if (req.file) updateFields.profilePic = req.file.path;
    if (salaryAmount !== undefined) updateFields.salaryAmount = Number(salaryAmount);
    if (salaryDay !== undefined) updateFields.salaryDay = Number(salaryDay);

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

// Get User Profile
app.get('/profile', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email: { $regex: new RegExp("^" + email + "$", "i") } }).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

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
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Password Reset Request',
      text: `Reset your password using this link: http://localhost:5000/reset-password?token=${resetToken}`
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
  res.sendFile(__dirname + '/reset-password.html');
});

// Transaction Schema
const transactionSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  transactionId: { type: Number, unique: true },
  amount: Number,
  category: String,
  date: Date,
  description: { type: String, default: "" }
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
    const transactions = await Transaction.find().lean();
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/transactions", async (req, res) => {
  try {
    const { category, amount, date, description = "" } = req.body;

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue)) {
      return res.status(400).json({ error: "Invalid amount. Must be a number." });
    }

    const lastTransaction = await Transaction.findOne().sort({ transactionId: -1 });
    const transactionId = lastTransaction ? lastTransaction.transactionId + 1 : 1;

    const newTransaction = new Transaction({
      _id: new mongoose.Types.ObjectId(),
      transactionId,
      category,
      amount: amountValue,
      date: new Date(date),
      description
    });

    await newTransaction.save();
    res.status(201).json({ message: "Transaction added successfully", transactionId });
  } catch (error) {
    console.error("Error adding transaction:", error);
    res.status(500).json({ error: error.message });
  }
});

// Goal Schema (moved to separate file ideally, but fixed here)
const goalSchema = new mongoose.Schema({
  name: { type: String, required: true },
  targetAmount: { type: Number, required: true },
  currentSavings: { type: Number, required: true }
});

const Goal = mongoose.model('Goal', goalSchema);

// Goal Endpoints
app.get('/goals', async (req, res) => {
  try {
    const goals = await Goal.find().lean();
    res.json(goals);
  } catch (error) {
    console.error('Error fetching goals:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post("/goals", async (req, res) => {
  try {
    const { name, targetAmount, currentSavings } = req.body;
    if (!name || !targetAmount || currentSavings === undefined) {
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

app.put("/goals/:id", async (req, res) => {
  try {
    const { name, targetAmount, currentSavings } = req.body;
    const updatedGoal = await Goal.findByIdAndUpdate(
      req.params.id,
      { name, targetAmount, currentSavings },
      { new: true, runValidators: true }
    );

    if (!updatedGoal) return res.status(404).json({ error: "Goal not found" });
    res.json(updatedGoal);
  } catch (err) {
    console.error("Error updating goal:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.delete("/goals/:id", async (req, res) => {
  try {
    const deletedGoal = await Goal.findByIdAndDelete(req.params.id);
    if (!deletedGoal) return res.status(404).json({ error: "Goal not found" });
    res.json({ message: "Goal deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Error deleting goal" });
  }
});

app.get("/goals/:id/projection", async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);
    if (!goal) return res.status(404).json({ error: "Goal not found" });

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

// Profile Save Endpoint (unused by budget/expense, but kept)
app.post("/api/saveProfile", (req, res) => {
  console.log("Received data:", req.body);
  res.json({ message: "Profile saved successfully!" });
});
// Budget Schema
const budgetSchema = new mongoose.Schema({
  name: { type: String, required: true },
  budget: { type: Number, required: true },
  spent: { type: Number, default: 0 }
});

const Budget = mongoose.model('Budget', budgetSchema);

// In server.js, after const Budget = mongoose.model('Budget', budgetSchema);
app.get('/budgets/:id', async (req, res) => {
  try {
    const budget = await Budget.findById(req.params.id).lean();
    if (!budget) {
      return res.status(404).json({ error: "Budget not found" });
    }
    res.json(budget);
  } catch (err) {
    console.error("Error fetching budget:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Budget Endpoints
app.get('/budgets', async (req, res) => {
  try {
    const budgets = await Budget.find().lean();
    res.json(budgets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/budgets', async (req, res) => {
  try {
    const { name, budget } = req.body;
    const newBudget = new Budget({ name, budget });
    await newBudget.save();
    res.status(201).json(newBudget);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/budgets/:id', async (req, res) => {
  try {
    const { spent } = req.body;
    const updatedBudget = await Budget.findByIdAndUpdate(
      req.params.id,
      { $inc: { spent: spent } },
      { new: true }
    );
    if (!updatedBudget) return res.status(404).json({ error: "Budget not found" });
    res.json(updatedBudget);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// In server.js, after the Budget model definition
app.delete('/budgets/:id', async (req, res) => {
  try {
    const deletedBudget = await Budget.findByIdAndDelete(req.params.id);
    if (!deletedBudget) return res.status(404).json({ error: "Budget not found" });
    res.json({ message: "Budget deleted successfully" });
  } catch (err) {
    console.error("Error deleting budget:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ✅ AI-Based Goal Projection API
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
          { $sort: { "_id": -1 } },
          { $limit: 6 }
      ]);

      if (savingsTrend.length === 0) {
          return res.status(400).json({ error: "Not enough data for projection" });
      }

      const avgMonthlySavings = savingsTrend.reduce((acc, cur) => acc + cur.netSavings, 0) / savingsTrend.length;
      const monthsNeeded = Math.ceil((targetAmount - currentSavings) / avgMonthlySavings);

      res.json({
          avgMonthlySavings,
          monthsNeeded,
          projectedCompletionDate: new Date(new Date().setMonth(new Date().getMonth() + monthsNeeded)).toDateString()
      });

  } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error calculating projection" });
  }
});

// ✅ AI-Based Goal Prediction API
app.get("/predict-goals", async (req, res) => {
  try {
      const transactions = await Transaction.find({}, { date: 1, amount: 1, _id: 0 });

      let options = {
          mode: "text",
          pythonOptions: ["-u"],
          scriptPath: __dirname,
          args: [JSON.stringify(transactions)]
      };

      PythonShell.run("predict.py", options, (err, results) => {
          if (err) {
              console.error(err);
              return res.status(500).json({ error: "Error in AI prediction" });
          }
          res.json({ projectedCompletion: results[0] });
      });

  } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// ✅ Fix: Added missing /api/projections route
app.get('/api/projections', async (req, res) => {
  try {
      const filePath = path.join(__dirname, "goal_projection.json");

      fs.readFile(filePath, "utf8", (err, data) => {
          if (err) {
              return res.status(500).json({ error: "Failed to load projections" });
          }
          res.json(JSON.parse(data));
      });

  } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error fetching projections" });
  }
});

// ✅ AI-Based Savings Prediction for Future Months
app.get("/predict", async (req, res) => {
  const { futureMonth } = req.query;

  if (!futureMonth) return res.status(400).json({ error: "Future month required" });

  const pythonProcess = spawn("python", ["predict.py", futureMonth]);

  let result = "";
  pythonProcess.stdout.on("data", data => (result += data.toString()));

  pythonProcess.on("close", code => {
      if (code === 0) {
          res.json({ prediction: parseFloat(result.trim()) });
      } else {
          res.status(500).json({ error: "Prediction failed" });
      }
  });
});

// ✅ Real-time Model Retraining (MongoDB Change Stream)
const changeStream = Transaction.watch();
changeStream.on("change", async (change) => {
  console.log("⚡ New transaction detected, triggering model retraining...");

  const retrainProcess = spawn("python", ["train_model.py"]);
  retrainProcess.on("close", (code) => {
      if (code === 0) {
          console.log("✅ Model retrained successfully!");
      } else {
          console.error("❌ Error retraining model.");
      }
  });
});



//temp
// Add these imports at the top of server.js with the other require statements
const { CashFlowPrediction, CashFlowPredictor } = require('./cashflow-prediction');

// Add these routes to server.js

// Generate Cash Flow Predictions
app.post('/api/cash-flow/generate-predictions', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const predictor = new CashFlowPredictor(userId);
    const predictions = await predictor.savePredictions();
    
    res.status(200).json({ 
      message: 'Cash flow predictions generated successfully',
      predictions
    });
  } catch (error) {
    console.error('Error generating cash flow predictions:', error);
    res.status(500).json({ 
      error: 'Failed to generate predictions',
      message: error.message
    });
  }
});

// Get Cash Flow Predictions
app.get('/api/cash-flow/predictions', async (req, res) => {
  try {
    const { userId, months } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const query = { userId };
    
    // If specific months are requested
    if (months) {
      const requestedMonths = months.split(',');
      query.month = { $in: requestedMonths };
    }
    
    const predictions = await CashFlowPrediction.find(query).sort({ month: 1 });
    
    res.status(200).json(predictions);
  } catch (error) {
    console.error('Error fetching cash flow predictions:', error);
    res.status(500).json({ error: 'Failed to fetch predictions' });
  }
});

// Get Detailed Cash Flow Analysis
app.get('/api/cash-flow/analysis', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const predictor = new CashFlowPredictor(userId);
    
    // Run full analysis without saving
    const analysisData = await predictor.generatePredictions();
    
    res.status(200).json({
      predictions: analysisData.predictions,
      recurringTransactions: analysisData.recurringTransactions,
      seasonalFactors: analysisData.seasonalFactors,
      growthTrends: analysisData.growthTrends
    });
  } catch (error) {
    console.error('Error generating cash flow analysis:', error);
    res.status(500).json({ 
      error: 'Failed to generate analysis',
      message: error.message
    });
  }
});

// Manually update Transaction Schema to include userId if needed
// This ensures our cash flow predictions can be tied to specific users

// *NOTE: This would ideally be in your Transaction.js file, but you can run this once
// to update existing schema since we saw your Transaction model is already defined
Transaction.schema.add({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

//till this is temp

// Start Server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
