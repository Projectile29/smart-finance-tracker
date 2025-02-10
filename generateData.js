require('dotenv').config();
const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const Transaction = require('./Transaction');

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Error:', err));

// Function to generate a unique Transaction ID
function generateTransactionId() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

// Function to generate fake transaction data
function generateTransaction() {
  return {
    transactionId: generateTransactionId(),
    date: faker.date.recent(),
    amount: faker.finance.amount(10, 1000, 2), // Random amount
    category: faker.helpers.arrayElement(["Food", "Transport", "Entertainment", "Shopping"]),
    description: faker.lorem.sentence()
  };
}

// Insert multiple fake transactions into MongoDB
const insertFakeData = async () => {
  try {
    const fakeTransactions = Array.from({ length: 10 }, generateTransaction);
    await Transaction.insertMany(fakeTransactions);
    console.log('✅ Fake transactions inserted successfully!');
  } catch (error) {
    console.error('❌ Error inserting transactions:', error);
  } finally {
    mongoose.connection.close(); // Close connection after insert
  }
};

// Run the script
insertFakeData();
