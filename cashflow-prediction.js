const mongoose = require('mongoose');

// Schema with unique month
const cashFlowPredictionSchema = new mongoose.Schema({
    month: { type: String, unique: true },
    predictedCashFlow: Number,
    actualCashFlow: Number,
    predictedIncome: Number,
    predictedExpenses: Number
});

const CashFlowPrediction = mongoose.model('CashFlowPrediction', cashFlowPredictionSchema);

class CashFlowPredictor {
    constructor(transactions) {
        this.transactions = transactions || [];
    }

    async generatePredictions() {
        try {
            // Filter transactions for the last 12 months
            const twelveMonthsAgo = new Date();
            twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
            let recentTransactions = this.transactions.filter(tx => new Date(tx.date) >= twelveMonthsAgo);

            // Fallback to 3 months if insufficient data (< 10 transactions)
            if (recentTransactions.length < 10) {
                const threeMonthsAgo = new Date();
                threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                recentTransactions = this.transactions.filter(tx => new Date(tx.date) >= threeMonthsAgo);
            }

            // Get the latest transaction date
            const sortedTransactions = [...recentTransactions].sort((a, b) => 
                new Date(b.date) - new Date(a.date));
            
            const lastTransactionDate = sortedTransactions.length > 0 
                ? new Date(sortedTransactions[0].date) 
                : new Date();
            
            // Set start month to next month after latest transaction
            const startMonth = new Date(lastTransactionDate);
            startMonth.setMonth(startMonth.getMonth() + 1);
            startMonth.setDate(1);
            
            // Get existing prediction months
            const existingPredictions = await CashFlowPrediction.find({}, 'month');
            const existingMonths = new Set(existingPredictions.map(p => p.month));

            // Generate predictions for up to 3 new months
            const predictions = [];
            let monthsAdded = 0;
            let currentMonth = new Date(startMonth);

            while (monthsAdded < 3) {
                const monthStr = currentMonth.toISOString().slice(0, 7);
                if (!existingMonths.has(monthStr)) {
                    const prediction = this.calculateFuturePredictions(currentMonth, recentTransactions, 1)[0];
                    predictions.push(prediction);
                    monthsAdded++;
                    existingMonths.add(monthStr);
                }
                currentMonth.setMonth(currentMonth.getMonth() + 1);
                if (currentMonth.getFullYear() > startMonth.getFullYear() + 1) {
                    break;
                }
            }

            // Save new predictions
            if (predictions.length > 0) {
                await CashFlowPrediction.insertMany(predictions, { ordered: false });
            }
            
            return {
                predictions,
                recurringTransactions: this.getRecurringTransactions(recentTransactions),
                seasonalFactors: this.getSeasonalFactors(),
                growthTrends: this.getGrowthTrends(recentTransactions)
            };
        } catch (error) {
            console.error('Error generating predictions:', error);
            throw error;
        }
    }

    calculateFuturePredictions(startDate, transactions, numMonths) {
        // Group transactions by month and category
        const monthlyData = transactions.reduce((acc, tx) => {
            const month = new Date(tx.date).toISOString().slice(0, 7);
            const category = tx.category;
            if (!acc[month]) acc[month] = { income: 0, expenses: 0, categories: {} };
            if (tx.amount > 0) {
                acc[month].income += tx.amount;
            } else {
                acc[month].expenses += Math.abs(tx.amount);
            }
            acc[month].categories[category] = (acc[month].categories[category] || 0) + tx.amount;
            return acc;
        }, {});
        
        // Calculate weighted moving average (more weight to recent months)
        const months = Object.keys(monthlyData).sort();
        const weights = [0.5, 0.3, 0.2]; // Last 3 months
        let recentCashFlows = months.slice(-3).map(m => monthlyData[m].income - monthlyData[m].expenses);
        let weightedAvg = recentCashFlows.reduce((sum, val, i) => sum + (val * (weights[i] || 0)), 0);
        weightedAvg = recentCashFlows.length > 0 ? weightedAvg / weights.slice(0, recentCashFlows.length).reduce((a, b) => a + b, 0) : 50000;

        // Adjust for recurring transactions
        const recurring = this.getRecurringTransactions(transactions);
        const monthlyRecurring = recurring.reduce((acc, tx) => {
            const category = tx.category;
            acc[category] = (acc[category] || 0) + tx.amount;
            return acc;
        }, {});
        
        // Calculate category trends
        const categoryTrends = {};
        Object.keys(monthlyData[months[months.length - 1]]?.categories || {}).forEach(cat => {
            const amounts = months.slice(-3).map(m => monthlyData[m]?.categories[cat] || 0);
            categoryTrends[cat] = amounts.reduce((sum, val) => sum + val, 0) / amounts.length;
        });

        const predictions = [];
        const startMonth = new Date(startDate);
        
        for (let i = 0; i < numMonths; i++) {
            const monthStr = startMonth.toISOString().slice(0, 7);
            const growthFactor = Math.pow(1 + this.getGrowthTrends(transactions).growthRate, i + 1);
            const seasonalFactor = this.getSeasonalFactorForMonth(startMonth.getMonth());
            
            let predictedIncome = 0;
            let predictedExpenses = 0;
            Object.keys(categoryTrends).forEach(cat => {
                if (categoryTrends[cat] > 0) {
                    predictedIncome += categoryTrends[cat] * growthFactor;
                } else {
                    predictedExpenses += Math.abs(categoryTrends[cat]) * growthFactor;
                }
            });
            
            // Apply recurring adjustments
            Object.keys(monthlyRecurring).forEach(cat => {
                if (monthlyRecurring[cat] > 0) {
                    predictedIncome += monthlyRecurring[cat];
                } else {
                    predictedExpenses += Math.abs(monthlyRecurring[cat]);
                }
            });
            
            const predictedCashFlow = Math.round((predictedIncome - predictedExpenses + seasonalFactor) * 100) / 100;
            
            predictions.push({
                month: monthStr,
                predictedCashFlow,
                predictedIncome: Math.round(predictedIncome),
                predictedExpenses: Math.round(predictedExpenses)
            });
            
            startMonth.setMonth(startMonth.getMonth() + 1);
        }
        
        return predictions;
    }

    getRecurringTransactions(transactions) {
        // Identify transactions with similar amounts and categories monthly
        const grouped = transactions.reduce((acc, tx) => {
            const month = new Date(tx.date).toISOString().slice(0, 7);
            const key = `${tx.category}-${Math.round(tx.amount / 100)}`;
            if (!acc[key]) acc[key] = {};
            acc[key][month] = (acc[key][month] || 0) + 1;
            return acc;
        }, {});
        
        return transactions.filter(tx => {
            const key = `${tx.category}-${Math.round(tx.amount / 100)}`;
            const months = Object.keys(grouped[key] || {});
            return months.length >= 3; // Appears in at least 3 months
        });
    }

    getSeasonalFactors() {
        return { 
            winterExpenses: 500, 
            summerExpenses: 300,
            holidayExpenses: 400,
            taxSeasonAdjustment: -200
        };
    }

    getSeasonalFactorForMonth(month) {
        const seasonalFactors = {
            0: -200, // January
            1: -100,
            2: 0,
            3: 100,
            4: 200,
            5: 300,
            6: 300,
            7: 200,
            8: 0,
            9: -100,
            10: 300,
            11: 500
        };
        return seasonalFactors[month] || 0;
    }

    getGrowthTrends(transactions) {
        const groupedByMonth = transactions.reduce((acc, tx) => {
            const month = new Date(tx.date).toISOString().slice(0, 7);
            acc[month] = (acc[month] || 0) + tx.amount;
            return acc;
        }, {});
        
        const sortedMonths = Object.keys(groupedByMonth).sort();
        if (sortedMonths.length < 2) return { growthRate: 0.05 };
        
        const firstMonth = groupedByMonth[sortedMonths[0]];
        const lastMonth = groupedByMonth[sortedMonths[sortedMonths.length - 1]];
        const monthsDiff = sortedMonths.length - 1;
        
        const growthRate = ((lastMonth / firstMonth) - 1) / monthsDiff;
        return { growthRate: Math.max(0, Math.min(0.1, growthRate)) };
    }

    async getAnalysis(month) {
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
        const recentTransactions = this.transactions.filter(tx => new Date(tx.date) >= twelveMonthsAgo);
        
        // Historical cash flows
        const monthlyData = recentTransactions.reduce((acc, tx) => {
            const m = new Date(tx.date).toISOString().slice(0, 7);
            if (!acc[m]) acc[m] = { income: 0, expenses: 0, categories: {} };
            if (tx.amount > 0) {
                acc[m].income += tx.amount;
            } else {
                acc[m].expenses += Math.abs(tx.amount);
            }
            acc[m].categories[tx.category] = (acc[m].categories[tx.category] || 0) + tx.amount;
            return acc;
        }, {});
        
        const historicalMonths = Object.keys(monthlyData).sort();
        const historicalCashFlows = historicalMonths.map(m => monthlyData[m].income - monthlyData[m].expenses);
        
        // Category breakdown for the predicted month
        const prediction = await CashFlowPrediction.findOne({ month });
        const categoryBreakdown = {};
        if (prediction) {
            const lastMonthData = monthlyData[historicalMonths[historicalMonths.length - 1]] || { categories: {} };
            Object.keys(lastMonthData.categories).forEach(cat => {
                categoryBreakdown[cat] = lastMonthData.categories[cat] || 0;
            });
        }
        
        return {
            historicalMonths: historicalMonths.map(m => formatMonth(m)),
            historicalCashFlows,
            categoryBreakdown
        };
    }
}

// Format month for analysis
function formatMonth(monthStr) {
    try {
        const date = new Date(monthStr + "-01");
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch (e) {
        return monthStr;
    }
}

module.exports = { CashFlowPrediction, CashFlowPredictor };