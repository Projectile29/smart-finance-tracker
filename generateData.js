require("dotenv").config(); // Load environment variables FIRST
const mongoose = require("mongoose");
const { faker } = require("@faker-js/faker");
const Transaction = require("./Transaction");
const Salary = require("./models/Salary");

// ✅ Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ✅ Function to check and insert salary transaction
async function generateSalaryTransaction() {
  const today = new Date().getDate();

  try {
    const salaryRecords = await Salary.find();

    for (const salary of salaryRecords) {
      if (salary.salaryDay === today) {
        const salaryTransaction = new Transaction({
          transactionId: null, // Let auto-increment handle this
          date: new Date(),
          amount: salary.amount,
          category: "Income",
          description: "Monthly Salary",
          type: "Income"
        });

        await salaryTransaction.save(); // Trigger pre('save') for auto-increment
        console.log('✅ Salary transaction inserted:', salaryTransaction);
      }
    }
  } catch (error) {
    console.error('❌ Error processing salary transactions:', error);
  }
}

// ✅ Function to generate transactions at random times
function scheduleRandomTransactions() {
  const randomInterval = Math.floor(Math.random() * (5 - 1 + 1) + 1) * 60 * 1000;
  console.log(`⏳ Next transaction in ${randomInterval / 60000} minutes`);

  setTimeout(async () => {
    try {
      const transaction = new Transaction({
        transactionId: null,
        date: new Date(),
        amount: faker.finance.amount(10, 1000, 2),
        category: faker.helpers.arrayElement(["Food", "Transport", "Entertainment", "Shopping"]),
        description: faker.lorem.sentence(),
        type: faker.helpers.arrayElement(["Income", "Expense"])
      });

      await transaction.save(); // Trigger pre('save') for auto-increment
      console.log('✅ Transaction inserted:', transaction);
    } catch (error) {
      console.error('❌ Error inserting transaction:', error);
    }

    await generateSalaryTransaction(); // Check for salary deposits
    scheduleRandomTransactions(); // Schedule next
  }, randomInterval);
}

// ✅ Start process
scheduleRandomTransactions();
