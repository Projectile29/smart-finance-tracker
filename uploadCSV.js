const fs = require("fs");
const mongoose = require("mongoose");
const csvParser = require("csv-parser");
const moment = require("moment");
const Transaction = require("./Transaction");
require("dotenv").config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const transactions = [];

fs.createReadStream("transactions.csv")
  .pipe(csvParser({ separator: "," })) // Ensure correct separator
  .on("data", (row) => {
    try {
      // Parse date properly
      const date = moment(row["Date / Time"], "dddd, MMMM DD, YYYY").toDate();
      const amount = parseFloat(row["Debit/Credit"]); // Ensure it's a number
      const category = row["Category"] ? row["Category"].trim() : null;
      const type = row["Income/Expense"] ? row["Income/Expense"].trim() : null;

      // Skip invalid rows
      if (isNaN(amount) || !date || isNaN(date.getTime()) || !category || !type) {
        console.error("Skipping invalid row:", JSON.stringify(row, null, 2));
        return;
      }

      transactions.push({
        transactionId: Math.floor(Math.random() * 100000), // Generate a unique ID
        amount,
        category,
        date,
        description: row["Sub category"] || "", // Use 'Sub category' if present
        type,
      });
    } catch (error) {
      console.error("Error processing row:", JSON.stringify(row, null, 2), error);
    }
  })
  .on("end", async () => {
    try {
      await Transaction.insertMany(transactions);
      console.log("✅ Data inserted successfully!");
      mongoose.connection.close();
    } catch (error) {
      console.error("❌ Error inserting data:", error);
    }
  });
