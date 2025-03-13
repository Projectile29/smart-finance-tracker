require('dotenv').config();
const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const Transaction = require('./Transaction');

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ Connection error:', err));

// Function to generate a unique Transaction ID
function generateTransactionId() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

// Function to generate fake transaction data
function generateTransaction() {
  return {
    transactionId: generateTransactionId(),
    date: new Date(), // Current timestamp
    amount: faker.finance.amount(10, 1000, 2), // Random amount
    category: faker.helpers.arrayElement(["Food", "Transport", "Entertainment", "Shopping"]),
    description: faker.lorem.sentence()
  };
}

// Function to generate transactions at random times
function scheduleRandomTransactions() {
  const randomInterval = Math.floor(Math.random() * (60 - 5 + 1) + 5) * 60 * 1000; // Min 5 mins, Max 60 mins
  console.log(`⏳ Next transaction in ${randomInterval / 60000} minutes`);

  setTimeout(async () => {
    try {
      const transaction = generateTransaction();
      await Transaction.create(transaction);
      console.log('✅ Transaction inserted:', transaction);
    } catch (error) {
      console.error('❌ Error inserting transaction:', error);
    }
    scheduleRandomTransactions(); // Schedule the next one
  }, randomInterval);
}

// Start generating transactions when the script runs
scheduleRandomTransactions();
