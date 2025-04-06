const mongoose = require('mongoose');

const cashFlowPredictionSchema = new mongoose.Schema({
  month: String,
  predictedCashFlow: Number,
});

const CashFlowPrediction = mongoose.model('CashFlowPrediction', cashFlowPredictionSchema);

class CashFlowPredictor {
  constructor(transactions) {
    this.transactions = transactions;
  }

  async generatePredictions() {
    // Process transactions to predict cash flow
    const predictions = this.calculatePredictions(this.transactions);
    
    return {
      predictions,
      recurringTransactions: this.getRecurringTransactions(),
      seasonalFactors: this.getSeasonalFactors(),
      growthTrends: this.getGrowthTrends(),
    };
  }

  async savePredictions() {
    const { predictions } = await this.generatePredictions();
    
    // Save predictions to database
    await CashFlowPrediction.insertMany(predictions);
    
    return predictions;
  }

  calculatePredictions(transactions) {
    // Example: Group transactions by month and sum cash flow
    const groupedByMonth = transactions.reduce((acc, tx) => {
      const month = tx.date.toISOString().slice(0, 7); // Format YYYY-MM
      acc[month] = (acc[month] || 0) + tx.amount;
      return acc;
    }, {});

    return Object.entries(groupedByMonth).map(([month, predictedCashFlow]) => ({
      month,
      predictedCashFlow,
    }));
  }

  getRecurringTransactions() {
    // Example: Identify recurring transactions based on similar amounts
    return this.transactions.filter((tx, index, arr) =>
      arr.some(other => other !== tx && Math.abs(other.amount - tx.amount) < 5)
    );
  }

  getSeasonalFactors() {
    // Example: Identify seasonal factors based on past months' trends
    return { winterExpenses: 500, summerExpenses: 300 }; // Example data
  }

  getGrowthTrends() {
    // Example: Calculate revenue growth over months
    return { growthRate: 0.05 }; // Example 5% growth
  }
}

module.exports = { CashFlowPrediction, CashFlowPredictor };

