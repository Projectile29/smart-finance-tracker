require('dotenv').config();
const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const schedule = require('node-schedule');
const Transaction = require('./Transaction');

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ Error:', err));

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
    category: faker.helpers.arrayElement(["Food", "Transport", "Entertainment", "Shopping", "Healthcare", "Bills"]),
    description: faker.lorem.sentence()
  };
}

// Insert multiple fake transactions into MongoDB
const insertFakeData = async () => {
  try {
    const fakeTransactions = Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, generateTransaction);
    await Transaction.insertMany(fakeTransactions);
    console.log(`✅ ${fakeTransactions.length} fake transactions inserted successfully!`);
  } catch (error) {
    console.error('❌ Error inserting transactions:', error);
  }
};

// Function to schedule transactions at random times
function scheduleRandomTransactions() {
  const totalRuns = faker.number.int({ min: 5, max: 10 }); // Number of times it'll run in a day

  for (let i = 0; i < totalRuns; i++) {
    const randomHour = faker.number.int({ min: 0, max: 23 });
    const randomMinute = faker.number.int({ min: 0, max: 59 });

    const jobTime = `${randomMinute} ${randomHour} * * *`; // CRON format
    schedule.scheduleJob(jobTime, () => {
      console.log(`⏰ Running at ${randomHour}:${randomMinute}`);
      insertFakeData();
    });

    console.log(`📅 Scheduled for ${randomHour}:${randomMinute}`);
  }
}

// Schedule transactions for today
scheduleRandomTransactions();
