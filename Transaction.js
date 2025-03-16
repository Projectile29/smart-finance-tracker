const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  transactionId: { type: Number, unique: true }, // Ensure it's a number
  amount: { type: Number, required: true }, // Store amount as a number
  category: { type: String, required: true },
  date: { type: Date, required: true },
  description: { type: String }
});

// Auto-increment transactionId
transactionSchema.pre("save", async function (next) {
  if (!this.transactionId) {
    const lastTransaction = await this.constructor.findOne().sort({ transactionId: -1 });
    this.transactionId = lastTransaction ? lastTransaction.transactionId + 1 : 1;
  }
  next();
});

const Transaction = mongoose.model("Transaction", transactionSchema);
module.exports = Transaction;
