const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true }, // Changed from accountNumber
  date: { type: Date, required: true },
  amount: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String }
});

// Export the model
module.exports = mongoose.model('Transaction', TransactionSchema);
