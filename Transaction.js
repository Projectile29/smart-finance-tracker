const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  accountNumber: String,
  transactionDate: Date,
  amount: String,
  category: String,
  description: String,
});

module.exports = mongoose.model('Transaction', TransactionSchema);
