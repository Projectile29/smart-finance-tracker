require("dotenv").config(); // Load environment variables FIRST
const mongoose = require("mongoose");
const { faker } = require("@faker-js/faker");
const Transaction = require("./Transaction"); // Ensure the correct path
const Salary = require("./models/Salary");

// ✅ Connect to MongoDB (Only Once)
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ✅ Function to check and insert salary transaction
async function generateSalaryTransaction() {
  const today = new Date().getDate(); // Get today's date (1-31)

  try {
    const salaryRecords = await Salary.find(); // Get all salary records

    for (const salary of salaryRecords) {
      if (salary.salaryDay === today) {
        const salaryTransaction = {
          transactionId: faker.datatype.uuid(),
          date: new Date(),
          amount: salary.amount,
          category: "Income",
          description: "Monthly Salary"
        };

        await Transaction.create(salaryTransaction);
        console.log('✅ Salary transaction inserted:', salaryTransaction);
      }
    }
  } catch (error) {
    console.error('❌ Error processing salary transactions:', error);
  }
}

// ✅ Function to generate transactions at random times
function scheduleRandomTransactions() {
  const randomInterval = Math.floor(Math.random() * (60 - 5 + 1) + 5) * 60 * 1000; // Min 5 mins, Max 60 mins
  console.log(`⏳ Next transaction in ${randomInterval / 60000} minutes`);

  setTimeout(async () => {
    try {
      const transaction = {
        transactionId: faker.datatype.uuid(),
        date: new Date(),
        amount: faker.finance.amount(10, 1000, 2),
        category: faker.helpers.arrayElement(["Food", "Transport", "Entertainment", "Shopping"]),
        description: faker.lorem.sentence()
      };

      await Transaction.create(transaction);
      console.log('✅ Transaction inserted:', transaction);
    } catch (error) {
      console.error('❌ Error inserting transaction:', error);
    }

    await generateSalaryTransaction(); // Check for salary deposits
    scheduleRandomTransactions(); // Schedule next transaction
  }, randomInterval);
}

// ✅ Start process
scheduleRandomTransactions();
