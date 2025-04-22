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
console.log('Attempting to import CashFlowPrediction and CashFlowPredictor');
const { CashFlowPrediction, CashFlowPredictor } = require('./cashflow-prediction');
console.log('Imported:', { CashFlowPrediction, CashFlowPredictor });

app.post('/api/cash-flow/generate-predictions', async (req, res) => {
  try {
      console.log('Handling /api/cash-flow/generate-predictions');
      const transactions = await Transaction.find({}).sort({ transactionId: 1 });
      if (!transactions.length) {
          return res.status(400).json({ error: 'No transactions available for prediction' });
      }
      console.log('Creating CashFlowPredictor instance');
      const predictor = new CashFlowPredictor(transactions);
      console.log('Generating predictions');
      const result = await predictor.generatePredictions();
      res.status(200).json({ 
          message: 'Cash flow predictions generated successfully',
          predictions: result.predictions
      });
  } catch (error) {
      console.error('Error generating cash flow predictions:', error);
      res.status(500).json({ 
          error: 'Failed to generate predictions',
          message: error.message
      });
  }
});
app.get('/api/cash-flow/predictions', async (req, res) => {
  try {
    const { direction } = req.query;
    const today = new Date();
    const currentMonthStr = today.toISOString().slice(0, 7);

    let predictions = await CashFlowPrediction.find({}).sort({ month: 1 });

    const seen = new Set();
    predictions = predictions.filter(p => {
      const month = p.month;
      if (month === currentMonthStr) return false;
      if (seen.has(month)) return false;
      seen.add(month);
      return (direction === 'past') ? (month < currentMonthStr) : (month > currentMonthStr);
    });

    if (direction === 'future') {
      predictions = predictions.slice(0, 6);
    }

    if (direction === 'past') {
      const allTransactions = await Transaction.find({});
      const actualMap = {};

      allTransactions.forEach(tx => {
        const txMonth = new Date(tx.date).toISOString().slice(0, 7);
        if (!actualMap[txMonth]) actualMap[txMonth] = { income: 0, expenses: 0 };

        if (tx.amount > 0) {
          actualMap[txMonth].income += tx.amount;
        } else {
          actualMap[txMonth].expenses += Math.abs(tx.amount);
        }
      });

      predictions = predictions.map(p => {
        const actual = actualMap[p.month];
        const totalActualAmount = actual
          ? Math.round(actual.income - actual.expenses)
          : null;

        return {
          ...p.toObject(),
          totalActualAmount
        };
      });
    }

    res.status(200).json(predictions);
  } catch (error) {
    console.error('Error fetching cash flow predictions:', error);
    res.status(500).json({ error: 'Failed to fetch predictions', message: error.message });
  }
});



app.post('/api/cash-flow/set-actual', async (req, res) => {
  try {
      const { month, actualCashFlow } = req.body;
      if (!month || actualCashFlow == null) {
          return res.status(400).json({ error: 'Month and actualCashFlow are required' });
      }
      const result = await CashFlowPrediction.findOneAndUpdate(
          { month },
          { actualCashFlow },
          { new: true }
      );
      if (!result) {
          return res.status(404).json({ error: 'Prediction not found' });
      }
      res.status(200).json({ message: 'Actual cash flow updated', prediction: result });
  } catch (error) {
      console.error('Error setting actual cash flow:', error);
      res.status(500).json({ error: 'Failed to set actual cash flow', message: error.message });
  }
});

app.get('/api/cash-flow/analysis', async (req, res) => {
  try {
      const { month } = req.query;
      if (!month) {
          return res.status(400).json({ error: 'Month is required' });
      }
      const transactions = await Transaction.find({}).sort({ transactionId: 1 });
      const predictor = new CashFlowPredictor(transactions);
      const analysis = await predictor.getAnalysis(month);
      res.status(200).json(analysis);
  } catch (error) {
      console.error('Error fetching analysis:', error);
      res.status(500).json({ error: 'Failed to fetch analysis', message: error.message });
  }
});


// Summary Report
// Summary Report Route
app.get("/api/reports/summary", async (req, res) => {
  try {
    const { from, to, type } = req.query;
    if (!from || !to) {
      return res.status(400).json({ message: "From and to dates are required" });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (isNaN(fromDate) || isNaN(toDate)) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    console.log(`Query: from=${from}, to=${to}, type=${type || "both"}`);

    const query = {
      date: { $gte: fromDate, $lte: new Date(toDate.getTime() + 86400000 - 1) },
      type: { $exists: true, $ne: "" },
    };
    if (type && type !== "both") {
      query.type = type.toLowerCase();
    }

    const transactionCount = await Transaction.countDocuments(query);
    console.log(`Transaction count for date range: ${transactionCount}`);

    // Today's Total Expense (April 22, 2025)
    const today = new Date("2025-04-22");
    const todaysTotalExpense = await Transaction.aggregate([
      {
        $match: {
          type: "expense",
          date: {
            $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
            $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
          },
        },
      },
      {
        $group: {
          _id: null,
          amount: { $sum: "$amount" },
        },
      },
      {
        $project: {
          amount: 1,
          _id: 0,
        },
      },
    ]).then(result => {
      console.log("Today's Total Expense Result:", result);
      return result[0]?.amount || 0;
    });

    // Total Monthly Expense (April 2025)
    const totalMonthlyExpense = await Transaction.aggregate([
      {
        $match: {
          type: "expense",
          date: {
            $gte: new Date("2025-04-01"),
            $lte: new Date("2025-04-30"),
          },
        },
      },
      {
        $group: {
          _id: null,
          amount: { $sum: "$amount" },
        },
      },
      {
        $project: {
          amount: 1,
          _id: 0,
        },
      },
    ]).then(result => {
      console.log("Total Monthly Expense Result:", result);
      return result[0]?.amount || 0;
    });

    // Daily Expenses (Today's expenses with time)
    const dailyExpenses = await Transaction.aggregate([
      {
        $match: {
          type: "expense",
          date: {
            $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
            $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
          },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%H:%M", date: "$date" } },
          amount: { $sum: "$amount" },
        },
      },
      { $sort: { "_id": 1 } },
      { $project: { time: "$_id", amount: 1, _id: 0 } },
    ]).then(result => {
      console.log("Daily Expenses Result:", result);
      return result;
    });

    // Weekly Aggregation
    const weekly = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            week: { $week: "$date" },
          },
          expenses: {
            $sum: { $cond: [{ $eq: [{ $toLower: "$type" }, "expense"] }, "$amount", 0] },
          },
          income: {
            $sum: { $cond: [{ $eq: [{ $toLower: "$type" }, "income"] }, "$amount", 0] },
          },
        },
      },
      {
        $project: {
          week: {
            $concat: ["Week ", { $toString: "$_id.week" }, " ", { $toString: "$_id.year" }],
          },
          expenses: 1,
          income: 1,
          _id: 0,
        },
      },
      { $sort: { "_id.year": 1, "_id.week": 1 } },
    ]).then(result => result);

    // Monthly Aggregation
    const monthly = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
          expenses: {
            $sum: { $cond: [{ $eq: [{ $toLower: "$type" }, "expense"] }, "$amount", 0] },
          },
          income: {
            $sum: { $cond: [{ $eq: [{ $toLower: "$type" }, "income"] }, "$amount", 0] },
          },
        },
      },
      {
        $project: {
          month: {
            $let: {
              vars: {
                months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
                monthNum: { $toInt: { $substr: ["$_id", 5, 2] } },
              },
              in: {
                $concat: [
                  { $arrayElemAt: ["$$months", { $subtract: ["$$monthNum", 1] }] },
                  " ",
                  { $substr: ["$_id", 0, 4] },
                ],
              },
            },
          },
          expenses: 1,
          income: 1,
          _id: 0,
        },
      },
      { $sort: { _id: 1 } },
    ]).then(result => result);

    // Yearly Aggregation
    const yearly = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: { $year: "$date" },
          expenses: {
            $sum: { $cond: [{ $eq: [{ $toLower: "$type" }, "expense"] }, "$amount", 0] },
          },
          income: {
            $sum: { $cond: [{ $eq: [{ $toLower: "$type" }, "income"] }, "$amount", 0] },
          },
        },
      },
      {
        $project: {
          year: { $toString: "$_id" },
          expenses: 1,
          income: 1,
          _id: 0,
        },
      },
      { $sort: { year: 1 } },
    ]).then(result => result);

    // Category Breakdown
    const categories = await Transaction.aggregate([
      { $match: { ...query, type: "expense" } },
      {
        $group: {
          _id: { $ifNull: ["$category", "Uncategorized"] },
          amount: { $sum: "$amount" },
        },
      },
      {
        $project: {
          category: "$_id",
          amount: 1,
          _id: 0,
        },
      },
      { $sort: { amount: -1 } },
    ]).then(result => result);

    // Trends
    const trends = await CashFlowPrediction.find({
      month: { $gte: from.slice(0, 7), $lte: to.slice(0, 7) },
    }).sort({ month: 1 });
    const trendsArray = trends.map(t => ({
      month: new Date(`${t.month}-01`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
      net: t.actualCashFlow || t.predictedCashFlow || 0,
    }));

    // Previous Day Expenses
    const prevDay = new Date(toDate);
    prevDay.setDate(prevDay.getDate() - 1);
    const prevDayExpenses = await Transaction.aggregate([
      {
        $match: {
          type: "expense",
          date: {
            $gte: new Date(prevDay.getFullYear(), prevDay.getMonth(), prevDay.getDate()),
            $lt: new Date(prevDay.getFullYear(), prevDay.getMonth(), prevDay.getDate() + 1),
          },
        },
      },
      {
        $group: {
          _id: null,
          amount: { $sum: "$amount" },
        },
      },
      {
        $project: {
          amount: 1,
          _id: 0,
        },
      },
    ]).then(result => result[0]?.amount || 0);

    // Total Expenses and Income
    const totals = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: { $toLower: "$type" },
          amount: { $sum: "$amount" },
        },
      },
    ]).then(result => {
      console.log("Raw Totals:", result);
      return result;
    });

    const totalExpenses = totals.find(t => t._id === "expense")?.amount || 0;
    const totalIncome = totals.find(t => t._id === "income")?.amount || 0;
    console.log(`Calculated Total Expenses: ${totalExpenses}, Total Income: ${totalIncome}`);

    const response = {
      dailyExpenses: dailyExpenses || [],
      weekly: weekly || [],
      monthly: monthly || [],
      yearly: yearly || [],
      categories: categories || [],
      trends: trendsArray || [],
      prevDayExpenses: prevDayExpenses,
      todaysTotalExpense: todaysTotalExpense,
      totalMonthlyExpense: totalMonthlyExpense,
      totalExpenses: totalExpenses,
      totalIncome: totalIncome,
    };

    console.log("Response Data:", response);
    res.json(response);
  } catch (error) {
    console.error("Error in /api/reports/summary:", error.stack);
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
});

// Download Report Route
app.get("/api/reports/download", async (req, res) => {
  try {
    const { from, to, format } = req.query;
    if (!from || !to || !format) {
      return res.status(400).json({ message: "From, to, and format are required" });
    }

    const transactions = await Transaction.find({
      date: { $gte: new Date(from), $lte: new Date(to) },
    });

    if (format === "csv") {
      const csv = transactions
        .map(t => `${t.date.toISOString()},${t.type},${t.category},${t.amount}`)
        .join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=report.csv");
      res.send(`Date,Type,Category,Amount\n${csv}`);
    } else if (format === "pdf") {
      res.status(501).json({ message: "PDF generation not implemented" });
    } else {
      res.status(400).json({ message: "Invalid format" });
    }
  } catch (error) {
    console.error("Error in /api/reports/download:", error.stack);
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
});
//till this is temp

// Start Server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
