const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  accountNumber: String,
  date: Date,
  amount: String,
  category: String,
  description: String,
});

module.exports = mongoose.model('Transaction', TransactionSchema);
