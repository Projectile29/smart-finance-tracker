require('dotenv').config();
const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const Transaction = require('./Transaction');

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Error:', err));

const generateTransaction = () => ({
  accountNumber: faker.finance.accountNumber(),
  transactionDate: faker.date.recent(),
  amount: faker.finance.amount(100, 10000, 2, '₹'),
  category: faker.helpers.arrayElement(['Food', 'Transport', 'Shopping', 'Entertainment']),
  description: faker.lorem.words(5),
});

// Insert multiple fake transactions into MongoDB
const insertFakeData = async () => {
  const fakeTransactions = Array.from({ length: 10 }, generateTransaction);
  await Transaction.insertMany(fakeTransactions);
  console.log('Fake transactions inserted');
  mongoose.connection.close();
};

insertFakeData();
