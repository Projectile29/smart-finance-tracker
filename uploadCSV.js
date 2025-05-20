const fs = require('fs');
const mongoose = require('mongoose');
const csvParser = require('csv-parser');
const Transaction = require('./Transaction');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Function to parse and insert CSV data
async function uploadCSV() {
  const transactions = [];

  // Read and parse the CSV file
  fs.createReadStream('transactions.csv')
    .pipe(csvParser()) // Fixed: Use csvParser instead of csv
    .on('data', (row) => {
      try {
        // Convert CSV row to match Transaction schema
        const transaction = {
          _id: new mongoose.Types.ObjectId(row._id), // Use provided ObjectId
          amount: parseFloat(row.amount), // Convert to number
          category: row.category,
          date: new Date(row.date), // Convert to Date object
          description: row.description || '',
          type: row.type // Should be "Income" or "Expense"
        };

        // Basic validation
        if (isNaN(transaction.amount)) {
          console.log(`Invalid amount in row ${row.transactionId}: ${row.amount}`);
          return;
        }
        if (isNaN(transaction.date.getTime())) {
          console.log(`Invalid date in row ${row.transactionId}: ${row.date}`);
          return;
        }
        if (!['Income', 'Expense'].includes(transaction.type)) {
          console.log(`Invalid type in row ${row.transactionId}: ${row.type}`);
          return;
        }

        transactions.push(transaction);
      } catch (error) {
        console.log(`Error processing row ${row.transactionId}:`, error.message);
      }
    })
    .on('end', async () => {
      try {
        // Clear existing transactions (optional, comment out if not needed)
        await Transaction.deleteMany({});

        // Insert transactions, letting the pre-save hook handle transactionId
        for (const transaction of transactions) {
          const newTransaction = new Transaction(transaction);
          await newTransaction.save();
          console.log(`Inserted transaction: ${newTransaction.transactionId}`);
        }

        console.log('✅ Data inserted successfully!');
        mongoose.connection.close();
      } catch (error) {
        console.error('Error inserting transactions:', error.message);
        mongoose.connection.close();
      }
    })
    .on('error', (error) => {
      console.error('Error reading CSV:', error.message);
      mongoose.connection.close();
    });
}

// Run the upload
uploadCSV();