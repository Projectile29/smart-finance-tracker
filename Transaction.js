const mongoose = require("mongoose");

// Define schema
const transactionSchema = new mongoose.Schema({
  transactionId: { type: Number, unique: true }, // Ensure unique transaction ID
  amount: { type: Number, required: true },
  category: { type: String, required: true },
  date: { type: Date, required: true },
  description: { type: String },
  type: { type: String, enum: ["Income", "Expense"], required: true } // Income or Expense
});

// Auto-increment transactionId
transactionSchema.pre("save", async function (next) {
  if (!this.transactionId) {
    const lastTransaction = await this.constructor.findOne().sort({ transactionId: -1 });
    this.transactionId = lastTransaction ? lastTransaction.transactionId + 1 : 1;
  }
  next();
});

// Create and export model
const Transaction = mongoose.model("Transaction", transactionSchema);
module.exports = Transaction;
