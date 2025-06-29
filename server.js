// === Imports ===
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
const { createObjectCsvStringifier } = require('csv-stringify/sync');
const path = require("path");

require('dotenv').config();

// === App Setup ===
const app = express();
const port = process.env.PORT || 5000;

// === Middleware ===
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting (adjusted for development)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: "Too many requests from this IP, please try again later." },
});
app.use(limiter);

app.use('/uploads', express.static('uploads'));

// === Database Connection ===
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// === User Schema and Model ===
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
// === File Upload Configuration ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// User Registration
// === Authentication Routes ===
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

// Transaction Schema урона
const transactionSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  transactionId: { type: Number, unique: true },
  amount: Number,
  category: String,
  date: Date,
  description: { type: String, default: "" },
  type: { type: String, enum: ['Income', 'Expense'], default: 'Expense' }
});

const Transaction = mongoose.model("Transaction", transactionSchema);

app.get("/transactions", async (req, res) => {
  try {
    const transactions = await Transaction.find().lean();
    console.log("Fetched Transactions:", transactions.length);
    res.json(transactions);
  } catch (err) {
    console.error("Error fetching transactions:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/transactions", async (req, res) => {
  try {
    const { category, amount, date, description = "", type = "Expense" } = req.body;

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue)) {
      return res.status(400).json({ error: "Invalid amount. Must be a number." });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate)) {
      return res.status(400).json({ error: "Invalid date format." });
    }

    // Assign type based on category
    const incomeCategories = ["Salary", "Investment", "Freelance"];
    const transactionType = incomeCategories.includes(category) ? "Income" : "Expense";

    const lastTransaction = await Transaction.findOne().sort({ transactionId: -1 });
    const transactionId = lastTransaction ? lastTransaction.transactionId + 1 : 1;

    const existingTransaction = await Transaction.findOne({
      amount: amountValue,
      category,
      date: parsedDate
    });
    if (existingTransaction) {
      return res.status(400).json({ error: "Duplicate transaction detected." });
    }

    const newTransaction = new Transaction({
      _id: new mongoose.Types.ObjectId(),
      transactionId,
      category,
      amount: amountValue,
      date: parsedDate,
      description,
      type: transactionType
    });

    await newTransaction.save();
    console.log("Added Transaction:", { transactionId, category, amount: amountValue, date, type: transactionType });
    res.status(201).json({ message: "Transaction added successfully", transactionId });
  } catch (error) {
    console.error("Error adding transaction:", error);
    res.status(500).json({ error: error.message });
  }
});

// === Budget Schema and Model ===
const budgetSchema = new mongoose.Schema({
  name: { type: String, required: true },
  budget: { type: Number, required: true },
  spent: { type: Number, default: 0 },
  month: { type: String, required: true } // Format: "YYYY-MM"
});

const Budget = mongoose.model('Budget', budgetSchema);

// === Budget Routes ===
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

app.get('/budgets', async (req, res) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7); // Format: "YYYY-MM"
    const budgets = await Budget.find({ month: currentMonth }).lean();
    res.json(budgets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/budgets', async (req, res) => {
  try {
    const { name, budget, spent = 0, month = new Date().toISOString().slice(0, 7) } = req.body;
    const newBudget = new Budget({ name, budget, spent, month });
    await newBudget.save();
    res.status(201).json(newBudget);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/budgets/:id', async (req, res) => {
  try {
    const { budget, spent } = req.body;
    const updateFields = {};
    if (budget !== undefined) updateFields.budget = budget;
    if (spent !== undefined) updateFields.spent = spent;

    const updatedBudget = await Budget.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true }
    );
    if (!updatedBudget) return res.status(404).json({ error: "Budget not found" });
    res.json(updatedBudget);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

// === Goal Schema and Model ===
const goalSchema = new mongoose.Schema({
  name: { type: String, required: true },
  targetAmount: { type: Number, required: true },
  currentSavings: { type: Number, required: true },
  category: { type: String, default: 'other' }, // Add category with default
  targetDate: { type: String, default: null }, // Allow null for no date
  createdAt: { type: String, default: () => new Date().toISOString() }, // Add creation timestamp
  updatedAt: { type: String } // Add update timestamp
});

const Goal = mongoose.model('Goal', goalSchema);

// === Goal Routes ===
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
    const { name, targetAmount, currentSavings, category, targetDate, updatedAt } = req.body;

    // Validate required fields
    if (!name || !targetAmount || currentSavings === undefined) {
      return res.status(400).json({ error: "Missing required fields: name, targetAmount, currentSavings" });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid goal ID" });
    }

    const updateData = {
      name,
      targetAmount,
      currentSavings,
      category: category || 'other',
      targetDate: targetDate || null,
      updatedAt: updatedAt || new Date().toISOString()
    };

    const updatedGoal = await Goal.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedGoal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    console.log('Goal updated:', updatedGoal); // Log for debugging
    res.json(updatedGoal);
  } catch (err) {
    console.error("Error updating goal:", err);
    res.status(500).json({ error: "Internal Server Error", details: err.message });
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
// === Cash Flow Prediction Routes ===
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

    const predictor = new CashFlowPredictor(transactions);
    const today = new Date();
    const currentMonthStr = today.toISOString().slice(0, 7);

    // === STEP 1: Regenerate missing past predictions ===
    const pastMonths = [...new Set(transactions.map(tx => new Date(tx.date).toISOString().slice(0, 7)))]
      .filter(month => month < currentMonthStr)
      .sort();

    const existingPredictions = await CashFlowPrediction.find({});
    const existingMonthsSet = new Set(existingPredictions.map(p => p.month));

    const missingPastMonths = pastMonths.filter(m => !existingMonthsSet.has(m));
    const regeneratedPastPredictions = [];

    for (const month of missingPastMonths) {
      const pastDate = new Date(month + '-01');
      const prediction = predictor.calculateFuturePredictions(pastDate, transactions, 1)[0];
      prediction.month = month;
      regeneratedPastPredictions.push(prediction);
    }

    if (regeneratedPastPredictions.length > 0) {
      await CashFlowPrediction.insertMany(regeneratedPastPredictions, { ordered: false });
    }

    // === STEP 2: Generate predictions for current and next month ===
    const currentDate = new Date();
    currentDate.setDate(1);
    const nextMonthDate = new Date(currentDate);
    nextMonthDate.setMonth(currentDate.getMonth() + 1);

    const futurePredictions = predictor.calculateFuturePredictions(currentDate, transactions, 2); // current + next month
    const futureMonths = futurePredictions.map(p => p.month);

    // Remove any existing future predictions for those months
    await CashFlowPrediction.deleteMany({ month: { $in: futureMonths, $gte: currentMonthStr } });

    // Save new predictions
    await CashFlowPrediction.insertMany(futurePredictions, { ordered: false });

    res.status(200).json({
      message: 'Cash flow predictions generated successfully',
      predictions: futurePredictions
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
        actualMap[txMonth].expenses += Math.abs(tx.amount);
      });

      predictions = predictions.map(p => {
        const actual = actualMap[p.month];
        const totalActualAmount = actual ? Math.round(-actual.expenses) : null;
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

// === Report Routes ===

// Savings Trend Endpoint (unchanged, included for completeness)
app.get('/api/savings-trend', async (req, res) => {
  try {
    const transactions = await Transaction.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
          totalExpense: { 
            $sum: { 
              $cond: [{ $ne: ["$category", "Salary"] }, "$amount", 0] 
            } 
          },
          totalIncome: { 
            $sum: { 
              $cond: [{ $eq: ["$category", "Salary"] }, "$amount", 0] 
            } 
          }
        },
      },
      {
        $project: {
          month: "$_id",
          totalExpense: 1,
          totalIncome: 1,
          _id: 0,
        },
      },
      { $sort: { month: 1 } },
    ]);
    res.json(transactions);
  } catch (error) {
    console.error("Error fetching savings trend:", error);
    res.status(500).json({ error: 'Error fetching savings trend' });
  }
});

// Available Months Endpoint (unchanged)
app.get('/api/reports/available-months', async (req, res) => {
  try {
    const months = await Transaction.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
        },
      },
      {
        $project: {
          month: "$_id",
          _id: 0,
        },
      },
      { $sort: { month: -1 } },
    ]);
    res.json(months.map(m => m.month));
  } catch (error) {
    console.error("Error fetching available months:", error);
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
});

// Reports Summary Endpoint
app.get("/api/reports/summary", async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ message: "From and to dates are required" });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setUTCHours(23, 59, 59, 999);
    if (isNaN(fromDate) || isNaN(toDate)) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    console.log(`Query: from=${fromDate.toISOString()}, to=${toDate.toISOString()}`);

    const query = {
      date: { $gte: fromDate, $lte: toDate },
      amount: { $ne: null }
    };

    const rawTransactions = await Transaction.find(query, { transactionId: 1, date: 1, category: 1, amount: 1, type: 1 }).lean();
    console.log("Raw Transactions:", rawTransactions.length);

    const today = new Date(toDate);
    today.setUTCHours(0, 0, 0, 0);
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    console.log("Today's Date Range:", {
      todayStart: todayStart.toISOString(),
      todayEnd: todayEnd.toISOString()
    });

    const todaysTotalExpense = await Transaction.aggregate([
      {
        $match: {
          date: { $gte: todayStart, $lt: todayEnd },
          amount: { $ne: null },
          type: "Expense"
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
    console.log("Today's Total Expense:", todaysTotalExpense);

    const todaysTotalIncome = await Transaction.aggregate([
      {
        $match: {
          date: { $gte: todayStart, $lt: todayEnd },
          amount: { $ne: null },
          type: "Income"
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
    console.log("Today's Total Income:", todaysTotalIncome);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    const totalMonthlyExpense = await Transaction.aggregate([
      {
        $match: {
          date: { $gte: monthStart, $lte: monthEnd },
          amount: { $ne: null },
          type: "Expense"
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
    console.log("Total Monthly Expense:", totalMonthlyExpense);

    const totalMonthlyIncome = await Transaction.aggregate([
      {
        $match: {
          date: { $gte: monthStart, $lte: monthEnd },
          amount: { $ne: null },
          type: "Income"
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
    console.log("Total Monthly Income:", totalMonthlyIncome);

    const dailyExpenses = await Transaction.aggregate([
      {
        $match: {
          date: { $gte: todayStart, $lt: todayEnd },
          amount: { $ne: null },
          type: "Expense"
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
    ]);
    console.log("Daily Expenses:", dailyExpenses);

    const dailyIncome = await Transaction.aggregate([
      {
        $match: {
          date: { $gte: todayStart, $lt: todayEnd },
          amount: { $ne: null },
          type: "Income"
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
    ]);
    console.log("Daily Income:", dailyIncome);

    const prevDay = new Date(today);
    prevDay.setDate(prevDay.getDate() - 1);
    const prevDayStart = new Date(prevDay.getFullYear(), prevDay.getMonth(), prevDay.getDate());
    const prevDayEnd = new Date(prevDay.getFullYear(), prevDay.getMonth(), prevDay.getDate() + 1);
    const prevDayExpenses = await Transaction.aggregate([
      {
        $match: {
          date: { $gte: prevDayStart, $lt: prevDayEnd },
          amount: { $ne: null },
          type: "Expense"
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
    console.log("Previous Day Expenses:", prevDayExpenses);

    const prevDayIncome = await Transaction.aggregate([
      {
        $match: {
          date: { $gte: prevDayStart, $lt: prevDayEnd },
          amount: { $ne: null },
          type: "Income"
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
    console.log("Previous Day Income:", prevDayIncome);

    const weekly = await Transaction.aggregate([
      { $match: { ...query, type: "Expense" } },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            week: { $week: "$date" },
          },
          expenses: { $sum: "$amount" },
        },
      },
      {
        $project: {
          week: {
            $concat: ["Week ", { $toString: "$_id.week" }, " ", { $toString: "$_id.year" }],
          },
          expenses: 1,
          _id: 0,
        },
      },
      { $sort: { "_id.year": 1, "_id.week": 1 } },
      { $limit: 3 } // Limit to last 3 weeks
    ]);

    const weeklyIncome = await Transaction.aggregate([
      { $match: { ...query, type: "Income" } },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            week: { $week: "$date" },
          },
          income: { $sum: "$amount" },
        },
      },
      {
        $project: {
          week: {
            $concat: ["Week ", { $toString: "$_id.week" }, " ", { $toString: "$_id.year" }],
          },
          income: 1,
          _id: 0,
        },
      },
      { $sort: { "_id.year": 1, "_id.week": 1 } },
      { $limit: 3 }
    ]);

    console.log("Weekly Data:", { weekly, weeklyIncome });

    const monthly = await Transaction.aggregate([
      { $match: { ...query, type: "Expense" } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
          expenses: { $sum: "$amount" },
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
          _id: 0,
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 3 } // Limit to last 3 months
    ]);

    const monthlyIncome = await Transaction.aggregate([
      { $match: { ...query, type: "Income" } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
          income: { $sum: "$amount" },
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
          income: 1,
          _id: 0,
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 3 }
    ]);

    console.log("Monthly Data:", { monthly, monthlyIncome });

    const yearStart = new Date(2023, 0, 1); // Start from 2023 to get 2-3 years
    const yearEnd = new Date(2025, 11, 31, 23, 59, 59, 999);
    const yearly = await Transaction.aggregate([
      {
        $match: {
          date: { $gte: yearStart, $lte: yearEnd },
          amount: { $ne: null },
          type: "Expense"
        },
      },
      {
        $group: {
          _id: { $year: "$date" },
          expenses: { $sum: "$amount" },
        },
      },
      {
        $project: {
          year: { $toString: "$_id" },
          expenses: 1,
          _id: 0,
        },
      },
      { $sort: { year: -1 } },
      { $limit: 3 } // Limit to last 3 years
    ]);

    const yearlyIncome = await Transaction.aggregate([
      {
        $match: {
          date: { $gte: yearStart, $lte: yearEnd },
          amount: { $ne: null },
          type: "Income"
        },
      },
      {
        $group: {
          _id: { $year: "$date" },
          income: { $sum: "$amount" },
        },
      },
      {
        $project: {
          year: { $toString: "$_id" },
          income: 1,
          _id: 0,
        },
      },
      { $sort: { year: -1 } },
      { $limit: 3 }
    ]);

    console.log("Yearly Data:", { yearly, yearlyIncome });

    const categories = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: { $ifNull: ["$category", "Uncategorized"] },
          amount: { $sum: "$amount" },
          type: { $first: "$type" }
        },
      },
      {
        $project: {
          category: "$_id",
          amount: 1,
          type: 1,
          _id: 0,
        },
      },
      { $sort: { amount: -1 } },
    ]);
    console.log("Categories:", categories);

    const prevMonthsStart = new Date(2025, 1, 1);
    const prevMonthsEnd = new Date(2025, 3, 30, 23, 59, 59, 999);
    const previousMonthsByCategory = await Transaction.aggregate([
      {
        $match: {
          date: { $gte: prevMonthsStart, $lte: prevMonthsEnd },
          amount: { $ne: null },
          category: { $ne: null }
        },
      },
      {
        $group: {
          _id: {
            month: { $dateToString: { format: "%Y-%m", date: "$date" } },
            category: "$category",
            type: "$type"
          },
          amount: { $sum: "$amount" },
        },
      },
      {
        $group: {
          _id: "$_id.month",
          categories: {
            $push: {
              category: "$_id.category",
              amount: "$amount",
              type: "$_id.type"
            },
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
          categories: 1,
          _id: 0,
        },
      },
      { $sort: { month: -1 } },
      { $limit: 3 } // Limit to last 3 months
    ]);
    console.log("Previous Months by Category:", previousMonthsByCategory);

    const totalExpenses = await Transaction.aggregate([
      { $match: { ...query, type: "Expense" } },
      {
        $group: {
          _id: null,
          amount: { $sum: "$amount" },
        },
      },
    ]).then(result => result[0]?.amount || 0);
    console.log("Total Expenses:", totalExpenses);

    const totalIncome = await Transaction.aggregate([
      { $match: { ...query, type: "Income" } },
      {
        $group: {
          _id: null,
          amount: { $sum: "$amount" },
        },
      },
    ]).then(result => result[0]?.amount || 0);
    console.log("Total Income:", totalIncome);

    const response = {
      dailyExpenses,
      dailyIncome,
      weekly,
      weeklyIncome,
      monthly,
      monthlyIncome,
      yearly,
      yearlyIncome,
      categories,
      previousMonthsByCategory,
      prevDayExpenses,
      prevDayIncome,
      todaysTotalExpense,
      todaysTotalIncome,
      totalMonthlyExpense,
      totalMonthlyIncome,
      totalExpenses,
      totalIncome
    };

    res.json(response);
  } catch (error) {
    console.error("Error generating report summary:", error);
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
});

let PDFDocument;
try {
  PDFDocument = require('pdfkit');
  console.log("pdfkit module loaded successfully");
} catch (error) {
  console.error("Failed to load pdfkit module:", error.message);
  PDFDocument = null;
}


// Reports Download Endpoint
app.get("/api/reports/download", async (req, res) => {
  try {
    const { from, to, format } = req.query;
    if (!from || !to || !format) {
      return res.status(400).json({ message: "From, to, and format are required" });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setUTCHours(23, 59, 59, 999);
    if (isNaN(fromDate) || isNaN(toDate)) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    console.log(`Download request: from=${fromDate.toISOString()}, to=${toDate.toISOString()}, format=${format}`);

    const query = {
      date: { $gte: fromDate, $lte: toDate },
      amount: { $ne: null }
    };

    const transactions = await Transaction.find(query, { transactionId: 1, date: 1, category: 1, amount: 1 }).lean();
    console.log(`Fetched ${transactions.length} transactions for download`);

    const categories = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: { $ifNull: ["$category", "Uncategorized"] },
          amount: { $sum: "$amount" }
        }
      },
      {
        $project: {
          category: "$_id",
          amount: 1,
          _id: 0
        }
      },
      { $sort: { amount: -1 } }
    ]);
    console.log("Categories for download:", categories);

    const totalExpenses = categories
      .filter(c => c.category !== 'Salary')
      .reduce((sum, c) => sum + (c.amount || 0), 0);
    const totalIncome = categories.find(c => c.category === 'Salary')?.amount || 0;

    const filename = `report_${fromDate.toISOString().slice(0, 10)}_to_${toDate.toISOString().slice(0, 10)}.${format}`;

    if (format === 'csv') {
      const csvStringifier = createObjectCsvStringifier({
        header: [
          { id: 'field', title: 'Field' },
          { id: 'value', title: 'Value' }
        ]
      });

      let csv = csvStringifier.getHeaderString();
      csv += csvStringifier.stringifyRecords([
        { field: 'From Date', value: fromDate.toLocaleDateString('en-IN') },
        { field: 'To Date', value: toDate.toLocaleDateString('en-IN') },
        { field: 'Total Income', value: `₹${totalIncome.toLocaleString('en-IN')}` },
        { field: 'Total Expenses', value: `₹${totalExpenses.toLocaleString('en-IN')}` }
      ]);
      csv += '\nCategory Breakdown\n';
      csv += createObjectCsvStringifier({
        header: [
          { id: 'category', title: 'Category' },
          { id: 'amount', title: 'Amount (₹)' }
        ]
      }).stringifyRecords(categories.map(c => ({
        category: c.category,
        amount: (c.amount || 0).toLocaleString('en-IN')
      })));

      csv += '\nTransactions\n';
      csv += createObjectCsvStringifier({
        header: [
          { id: 'transactionId', title: 'Transaction ID' },
          { id: 'date', title: 'Date' },
          { id: 'category', title: 'Category' },
          { id: 'amount', title: 'Amount (₹)' }
        ]
      }).stringifyRecords(
        transactions.map(tx => ({
          transactionId: tx.transactionId || 'N/A',
          date: new Date(tx.date).toLocaleDateString('en-IN'),
          category: tx.category || "Uncategorized",
          amount: (tx.amount || 0).toLocaleString('en-IN')
        }))
      );

      res.setHeader('Content-disposition', `attachment; filename=${filename}`);
      res.setHeader('Content-Type', 'text/csv');
      return res.send(csv);
    }

    if (format === 'pdf') {
      if (!PDFDocument) {
        console.error("PDFDocument is not available. Ensure pdfkit is installed.");
        return res.status(500).json({ message: "PDF generation is not available. Please ensure pdfkit is installed." });
      }

      try {
        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-Type', 'application/pdf');

        // Handle response errors during streaming
        res.on('error', (err) => {
          console.error("Response stream error:", err);
          if (!res.headersSent) {
            res.status(500).json({ message: `Stream error: ${err.message}` });
          }
        });

        doc.pipe(res);

        doc.fontSize(20).text('Finance Report', { align: 'center' });
        doc.moveDown(1);
        doc.fontSize(12).text(`From: ${fromDate.toLocaleDateString('en-IN')}`);
        doc.text(`To: ${toDate.toLocaleDateString('en-IN')}`);
        doc.text(`Total Income: ₹${totalIncome.toLocaleString('en-IN')}`);
        doc.text(`Total Expenses: ₹${totalExpenses.toLocaleString('en-IN')}`);
        doc.moveDown(1);
        doc.fontSize(14).text('Category Breakdown:');

        categories.forEach(c => {
          doc.fontSize(12).text(`• ${c.category}: ₹${(c.amount || 0).toLocaleString('en-IN')}`);
        });

        if (transactions.length > 0) {
          doc.addPage().fontSize(14).text('Transactions:');
          transactions.forEach(tx => {
            doc.fontSize(10).text(
              `${tx.transactionId || 'N/A'} | ${new Date(tx.date).toLocaleDateString('en-IN')} | ${tx.category || 'Uncategorized'} | ₹${(tx.amount || 0).toLocaleString('en-IN')}`
            );
          });
        } else {
          doc.addPage().fontSize(12).text('No transactions found for the selected period.');
        }

        doc.end();
      } catch (pdfError) {
        console.error("PDF generation error:", pdfError);
        if (!res.headersSent) {
          return res.status(500).json({ message: `Failed to generate PDF: ${pdfError.message}` });
        }
      }
      return;
    }

    return res.status(400).json({ message: "Invalid format. Supported: csv, pdf" });
  } catch (error) {
    console.error("Download endpoint error:", error);
    if (!res.headersSent) {
      return res.status(500).json({ message: `Server error: ${error.message}` });
    }
  }
});



// === Projection Routes ===
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

// === Server Start ===
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});