const mongoose = require('mongoose');

// 1. Create Cash Flow Prediction Schema
const cashFlowPredictionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month: { type: String, required: true }, // Format: YYYY-MM
  predictedIncome: { type: Number, required: true },
  predictedExpenses: { type: Number, required: true },
  predictedNetFlow: { type: Number, required: true },
  confidenceScore: { type: Number, required: true }, // 0-100%
  createdAt: { type: Date, default: Date.now }
});

const CashFlowPrediction = mongoose.model('CashFlowPrediction', cashFlowPredictionSchema);

// 2. Analysis and Prediction Methods
class CashFlowPredictor {
  constructor(userId) {
    this.userId = userId;
    this.Transaction = mongoose.model('Transaction');
    this.monthsToAnalyze = 6; // Use last 6 months for trend analysis
    this.monthsToPredict = 3; // Predict next 3 months
  }

  async getHistoricalData() {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - this.monthsToAnalyze);

    const transactions = await this.Transaction.aggregate([
      {
        $match: {
          userId: mongoose.Types.ObjectId(this.userId),
          date: { $gte: sixMonthsAgo, $lte: today }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
          totalIncome: {
            $sum: { $cond: [{ $eq: ["$type", "Income"] }, "$amount", 0] }
          },
          totalExpenses: {
            $sum: { $cond: [{ $eq: ["$type", "Expense"] }, "$amount", 0] }
          },
          netFlow: {
            $sum: {
              $cond: [
                { $eq: ["$type", "Income"] },
                "$amount",
                { $multiply: ["$amount", -1] }
              ]
            }
          },
          transactionCount: { $sum: 1 },
          categories: {
            $push: {
              category: "$category",
              amount: "$amount",
              type: "$type"
            }
          }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    return transactions;
  }

  async getCategoryPatterns() {
    const transactions = await this.Transaction.aggregate([
      {
        $match: {
          userId: mongoose.Types.ObjectId(this.userId)
        }
      },
      {
        $group: {
          _id: {
            month: { $dateToString: { format: "%Y-%m", date: "$date" } },
            category: "$category",
            type: "$type"
          },
          total: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: {
            category: "$_id.category",
            type: "$_id.type"
          },
          monthlyAverages: {
            $push: {
              month: "$_id.month",
              total: "$total",
              count: "$count"
            }
          },
          overallAvg: { $avg: "$total" },
          overallMax: { $max: "$total" },
          overallMin: { $min: "$total" },
          frequency: { $sum: 1 }
        }
      }
    ]);

    return transactions;
  }

  calculateSeasonalIndices(historicalData) {
    const monthlyTotals = {};
    const seasonalIndices = {};

    historicalData.forEach(entry => {
      const monthNum = parseInt(entry._id.split('-')[1]);
      if (!monthlyTotals[monthNum]) {
        monthlyTotals[monthNum] = {
          income: [],
          expenses: [],
          netFlow: []
        };
      }

      monthlyTotals[monthNum].income.push(entry.totalIncome);
      monthlyTotals[monthNum].expenses.push(entry.totalExpenses);
      monthlyTotals[monthNum].netFlow.push(entry.netFlow);
    });

    let totalIncome = 0, totalExpenses = 0, totalNetFlow = 0, count = 0;
    Object.values(monthlyTotals).forEach(month => {
      month.income.forEach(val => totalIncome += val);
      month.expenses.forEach(val => totalExpenses += val);
      month.netFlow.forEach(val => totalNetFlow += val);
      count += month.income.length;
    });

    const avgIncome = totalIncome / count;
    const avgExpenses = totalExpenses / count;
    const avgNetFlow = totalNetFlow / count;

    for (const [month, data] of Object.entries(monthlyTotals)) {
      const monthAvgIncome = data.income.reduce((sum, val) => sum + val, 0) / data.income.length;
      const monthAvgExpenses = data.expenses.reduce((sum, val) => sum + val, 0) / data.expenses.length;
      const monthAvgNetFlow = data.netFlow.reduce((sum, val) => sum + val, 0) / data.netFlow.length;

      seasonalIndices[month] = {
        income: monthAvgIncome / avgIncome,
        expenses: monthAvgExpenses / avgExpenses,
        netFlow: monthAvgNetFlow / avgNetFlow
      };
    }

    return seasonalIndices;
  }

  identifyRecurringTransactions(historicalData) {
    const recurringTransactions = [];
    const transactionsByCategory = {};

    historicalData.forEach(month => {
      month.categories.forEach(transaction => {
        const key = `${transaction.category}-${transaction.type}`;
        if (!transactionsByCategory[key]) {
          transactionsByCategory[key] = [];
        }
        transactionsByCategory[key].push({
          month: month._id,
          amount: transaction.amount
        });
      });
    });

    for (const [key, transactions] of Object.entries(transactionsByCategory)) {
      if (transactions.length >= Math.min(3, this.monthsToAnalyze * 0.5)) {
        const amounts = transactions.map(t => t.amount);
        const avgAmount = amounts.reduce((sum, val) => sum + val, 0) / amounts.length;
        const maxDiff = Math.max(...amounts.map(a => Math.abs(a - avgAmount) / avgAmount));

        if (maxDiff <= 0.1) {
          const [category, type] = key.split('-');
          recurringTransactions.push({
            category,
            type,
            averageAmount: avgAmount,
            frequency: 'monthly',
            confidence: Math.min(100, (transactions.length / this.monthsToAnalyze) * 100)
          });
        }
      }
    }

    return recurringTransactions;
  }

  analyzeGrowthTrends(historicalData) {
    if (historicalData.length < 2) return { income: 0, expenses: 0, netFlow: 0 };

    const growthRates = {
      income: [],
      expenses: [],
      netFlow: []
    };

    for (let i = 1; i < historicalData.length; i++) {
      const prevMonth = historicalData[i - 1];
      const currMonth = historicalData[i];

      if (prevMonth.totalIncome > 0) {
        growthRates.income.push((currMonth.totalIncome - prevMonth.totalIncome) / prevMonth.totalIncome);
      }

      if (prevMonth.totalExpenses > 0) {
        growthRates.expenses.push((currMonth.totalExpenses - prevMonth.totalExpenses) / prevMonth.totalExpenses);
      }

      if (Math.abs(prevMonth.netFlow) > 0) {
        growthRates.netFlow.push((currMonth.netFlow - prevMonth.netFlow) / Math.abs(prevMonth.netFlow));
      }
    }

    return {
      income: growthRates.income.length ? growthRates.income.reduce((sum, val) => sum + val, 0) / growthRates.income.length : 0,
      expenses: growthRates.expenses.length ? growthRates.expenses.reduce((sum, val) => sum + val, 0) / growthRates.expenses.length : 0,
      netFlow: growthRates.netFlow.length ? growthRates.netFlow.reduce((sum, val) => sum + val, 0) / growthRates.netFlow.length : 0
    };
  }

  async generatePredictions() {
    const historicalData = await this.getHistoricalData();
    if (historicalData.length < 3) {
      throw new Error("Insufficient data for prediction. Need at least 3 months of history.");
    }

    const categoryPatterns = await this.getCategoryPatterns();
    const seasonalIndices = this.calculateSeasonalIndices(historicalData);
    const recurringTransactions = this.identifyRecurringTransactions(historicalData);
    const growthTrends = this.analyzeGrowthTrends(historicalData);

    const recentMonths = historicalData.slice(-3);
    let baseIncome = 0, baseExpenses = 0, weights = 0;

    recentMonths.forEach((month, idx) => {
      const weight = idx + 1;
      baseIncome += month.totalIncome * weight;
      baseExpenses += month.totalExpenses * weight;
      weights += weight;
    });

    baseIncome /= weights;
    baseExpenses /= weights;

    const predictions = [];
    const currentDate = new Date();

    for (let i = 1; i <= this.monthsToPredict; i++) {
      const predictionDate = new Date(currentDate);
      predictionDate.setMonth(currentDate.getMonth() + i);

      const monthKey = predictionDate.getMonth() + 1;
      const predictionMonth = `${predictionDate.getFullYear()}-${monthKey.toString().padStart(2, '0')}`;

      const seasonalAdjustment = seasonalIndices[monthKey] || { income: 1, expenses: 1, netFlow: 1 };

      const monthsFromNow = i;
      const growthFactorIncome = Math.pow(1 + growthTrends.income, monthsFromNow);
      const growthFactorExpenses = Math.pow(1 + growthTrends.expenses, monthsFromNow);

      const predictedIncome = baseIncome * seasonalAdjustment.income * growthFactorIncome;
      const predictedExpenses = baseExpenses * seasonalAdjustment.expenses * growthFactorExpenses;
      const predictedNetFlow = predictedIncome - predictedExpenses;

      const dataQualityFactor = Math.min(1, historicalData.length / 12);
      const distanceFactor = Math.max(0.5, 1 - (i * 0.15));
      const volatilityFactor = Math.max(0.5, 1 - Math.abs(growthTrends.netFlow));
      const confidenceScore = Math.round(100 * dataQualityFactor * distanceFactor * volatilityFactor);

      predictions.push({
        userId: this.userId,
        month: predictionMonth,
        predictedIncome,
        predictedExpenses,
        predictedNetFlow,
        confidenceScore
      });
    }

    return {
      predictions,
      recurringTransactions,
      seasonalFactors: seasonalIndices,
      growthTrends
    };
  }

  async savePredictions() {
    try {
      const { predictions } = await this.generatePredictions();

      const monthsToPredict = predictions.map(p => p.month);
      await CashFlowPrediction.deleteMany({
        userId: this.userId,
        month: { $in: monthsToPredict }
      });

      await CashFlowPrediction.insertMany(predictions);

      return predictions;
    } catch (error) {
      console.error('Error saving cash flow predictions:', error);
      throw error;
    }
  }
}

module.exports = { CashFlowPrediction, CashFlowPredictor };
