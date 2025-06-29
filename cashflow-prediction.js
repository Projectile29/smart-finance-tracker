const mongoose = require('mongoose');

// Schema with unique month
const cashFlowPredictionSchema = new mongoose.Schema({
    month: { type: String, unique: true },
    predictedCashFlow: Number,
    actualCashFlow: Number,
    predictedIncome: Number,
    predictedExpenses: Number,
    categoryBreakdown: { type: Object, default: {} }
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
            
            const currentMonthStr = new Date().toISOString().slice(0, 7);
            
            // Get existing prediction months
            const existingPredictions = await CashFlowPrediction.find({}, 'month');
            const existingMonths = new Set(existingPredictions.map(p => p.month));

            // Generate predictions for missing past months (excluding current month) and exactly 3 future months
            const predictions = [];
            let futureMonthsAdded = 0;
            let currentMonth = new Date(twelveMonthsAgo);
            currentMonth.setDate(1);
            const endMonth = new Date(lastTransactionDate);
            endMonth.setMonth(endMonth.getMonth() + 3);

            while (currentMonth <= endMonth) {
                const monthStr = currentMonth.toISOString().slice(0, 7);
                if (monthStr === currentMonthStr) {
                    currentMonth.setMonth(currentMonth.getMonth() + 1);
                    continue; // Skip current month
                }
                if (!existingMonths.has(monthStr)) {
                    const relevantTransactions = recentTransactions.filter(tx => 
                        new Date(tx.date) < new Date(monthStr + '-01'));
                    if (relevantTransactions.length >= 3 || monthStr > currentMonthStr) {
                        const prediction = this.calculateFuturePredictions(
                            new Date(monthStr + '-01'), 
                            relevantTransactions, 
                            1
                        )[0];
                        predictions.push(prediction);
                        existingMonths.add(monthStr);
                    }
                }
                if (monthStr > currentMonthStr) {
                    futureMonthsAdded++;
                }
                currentMonth.setMonth(currentMonth.getMonth() + 1);
                if (futureMonthsAdded >= 3 && monthStr >= currentMonthStr) {
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
        const monthStr = startDate.toISOString().slice(0, 7);
        const currentMonthStr = new Date().toISOString().slice(0, 7);

        // Aggregate monthly data
        const monthlyData = transactions.reduce((acc, tx) => {
            const m = new Date(tx.date).toISOString().slice(0, 7);
            if (m === currentMonthStr) return acc; // Skip current month
            if (!acc[m]) acc[m] = { income: 0, expenses: 0, categories: {} };
            if (tx.type === 'Income') {
                acc[m].income += tx.amount;
                acc[m].categories[tx.category] = (acc[m].categories[tx.category] || 0) + tx.amount;
            } else {
                acc[m].expenses += Math.abs(tx.amount);
                acc[m].categories[tx.category] = (acc[m].categories[tx.category] || 0) - Math.abs(tx.amount);
            }
            return acc;
        }, {});

        if (monthStr < currentMonthStr && monthlyData[monthStr]) {
            // Use actual data for past months
            const actualData = monthlyData[monthStr];
            const predictedCashFlow = actualData.income - actualData.expenses;
            const categoryBreakdown = {};
            Object.entries(actualData.categories).forEach(([cat, val]) => {
                categoryBreakdown[cat] = {
                    amount: Math.round(val * 100) / 100,
                    type: val > 0 ? 'Income' : 'Expense'
                };
            });
            return [{
                month: monthStr,
                predictedCashFlow: Math.round(predictedCashFlow * 100) / 100,
                predictedIncome: Math.round(actualData.income),
                predictedExpenses: Math.round(actualData.expenses),
                actualCashFlow: predictedCashFlow,
                categoryBreakdown
            }];
        }

        // For future months, use predictive model
        const months = Object.keys(monthlyData).sort();
        const weights = [0.5, 0.3, 0.2]; // Last 3 months
        let recentCashFlows = months.slice(-3).map(m => monthlyData[m].income - monthlyData[m].expenses);
        let weightedAvg = recentCashFlows.reduce((sum, val, i) => sum + (val * (weights[i] || 0)), 0);
        weightedAvg = recentCashFlows.length > 0 
            ? weightedAvg / weights.slice(0, recentCashFlows.length).reduce((a, b) => a + b, 0) 
            : 0;

        // Adjust for recurring transactions
        const recurring = this.getRecurringTransactions(transactions);
        const monthlyRecurring = recurring.reduce((acc, tx) => {
            const category = tx.category;
            acc[category] = (acc[category] || 0) + (tx.type === 'Income' ? tx.amount : -Math.abs(tx.amount));
            return acc;
        }, {});
        
        // Calculate category trends from last 3 months
        const categoryTrends = {};
        const lastThreeMonths = months.slice(-3);
        lastThreeMonths.forEach(m => {
            Object.entries(monthlyData[m]?.categories || {}).forEach(([cat, val]) => {
                categoryTrends[cat] = (categoryTrends[cat] || 0) + (val / lastThreeMonths.length);
            });
        });

        const predictions = [];
        const startMonth = new Date(startDate);
        if (startMonth.toISOString().slice(0, 7) <= currentMonthStr) {
            startMonth.setMonth(startMonth.getMonth() + 1); // Start from next month
        }
        
        for (let i = 0; i < numMonths; i++) {
            const monthStr = startMonth.toISOString().slice(0, 7);
            if (monthStr <= currentMonthStr) {
                startMonth.setMonth(startMonth.getMonth() + 1);
                continue; // Skip current month
            }
            const growthFactor = Math.pow(1 + this.getGrowthTrends(transactions).growthRate, i + 1);
            const seasonalFactor = this.getSeasonalFactorForMonth(startMonth.getMonth());
            
            let predictedIncome = 0;
            let predictedExpenses = 0;
            const categoryBreakdown = {};
            
            // Apply trends and recurring transactions
            Object.keys(categoryTrends).forEach(cat => {
                const adjustedAmount = categoryTrends[cat] * growthFactor;
                categoryBreakdown[cat] = {
                    amount: Math.round(adjustedAmount * 100) / 100,
                    type: categoryTrends[cat] > 0 ? 'Income' : 'Expense'
                };
                if (categoryTrends[cat] > 0) {
                    predictedIncome += adjustedAmount;
                } else {
                    predictedExpenses += Math.abs(adjustedAmount);
                }
            });
            
            // Apply recurring transactions
            Object.keys(monthlyRecurring).forEach(cat => {
                categoryBreakdown[cat] = categoryBreakdown[cat] || { 
                    amount: 0, 
                    type: monthlyRecurring[cat] > 0 ? 'Income' : 'Expense' 
                };
                categoryBreakdown[cat].amount += Math.round(monthlyRecurring[cat] * 100) / 100;
                if (monthlyRecurring[cat] > 0) {
                    predictedIncome += monthlyRecurring[cat];
                } else {
                    predictedExpenses += Math.abs(monthlyRecurring[cat]);
                }
            });
            
            // Apply seasonal adjustment
            const baseCashFlow = predictedIncome - predictedExpenses;
            const cappedSeasonalFactor = Math.max(-0.1 * Math.abs(baseCashFlow), Math.min(0.1 * Math.abs(baseCashFlow), seasonalFactor));
            const predictedCashFlow = Math.round((baseCashFlow + cappedSeasonalFactor) * 100) / 100;
            
            // Scale category breakdown to match predicted cash flow
            const totalCategoryAmount = Object.values(categoryBreakdown).reduce((sum, cat) => sum + cat.amount, 0);
            if (totalCategoryAmount !== 0) {
                const scaleFactor = predictedCashFlow / totalCategoryAmount;
                Object.keys(categoryBreakdown).forEach(cat => {
                    categoryBreakdown[cat].amount = Math.round(categoryBreakdown[cat].amount * scaleFactor * 100) / 100;
                });
            } else {
                // Fallback if no category data
                categoryBreakdown['Other'] = {
                    amount: predictedCashFlow,
                    type: predictedCashFlow > 0 ? 'Income' : 'Expense'
                };
            }
            
            predictions.push({
                month: monthStr,
                predictedCashFlow,
                predictedIncome: Math.round(predictedIncome),
                predictedExpenses: Math.round(predictedExpenses),
                categoryBreakdown
            });
            
            startMonth.setMonth(startMonth.getMonth() + 1);
            if (predictions.length >= 3) break; // Ensure exactly 3 future months
        }
        
        return predictions;
    }

    getRecurringTransactions(transactions) {
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
            return months.length >= 3;
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
            acc[month] = (acc[month] || 0) + (tx.type === 'Income' ? tx.amount : -Math.abs(tx.amount));
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

        const monthlyData = recentTransactions.reduce((acc, tx) => {
            const m = new Date(tx.date).toISOString().slice(0, 7);
            if (m === new Date().toISOString().slice(0, 7)) return acc; // Skip current month
            if (!acc[m]) acc[m] = { income: 0, expenses: 0, categories: {} };
            if (tx.type === 'Income') {
                acc[m].income += tx.amount;
                acc[m].categories[tx.category] = (acc[m].categories[tx.category] || 0) + tx.amount;
            } else {
                acc[m].expenses += Math.abs(tx.amount);
                acc[m].categories[tx.category] = (acc[m].categories[tx.category] || 0) - Math.abs(tx.amount);
            }
            return acc;
        }, {});

        const historicalMonths = Object.keys(monthlyData).sort();
        const historicalCashFlows = historicalMonths.map(m => ({
            month: m,
            cashFlow: monthlyData[m].income - monthlyData[m].expenses
        }));

        let prediction = await CashFlowPrediction.findOne({ month });

        // Generate prediction if missing
        if (!prediction) {
            const monthDate = new Date(month + '-01');
            const pastTransactions = recentTransactions.filter(tx => new Date(tx.date) < monthDate);
            if (pastTransactions.length >= 3) {
                const tempPredictions = this.calculateFuturePredictions(monthDate, pastTransactions, 1);
                if (tempPredictions[0]) {
                    prediction = tempPredictions[0];
                    await CashFlowPrediction.updateOne(
                        { month },
                        prediction,
                        { upsert: true }
                    );
                }
            }
        }

        const actualData = monthlyData[month] || null;
        let actualCashFlow = null;
        let actualIncome = null;
        let actualExpenses = null;
        let actualCategoryBreakdown = {};

        if (actualData) {
            actualCashFlow = actualData.income - actualData.expenses;
            actualIncome = actualData.income;
            actualExpenses = actualData.expenses;
            actualCategoryBreakdown = Object.entries(actualData.categories).reduce((acc, [cat, val]) => {
                acc[cat] = { amount: Math.round(val * 100) / 100, type: val > 0 ? 'Income' : 'Expense' };
                return acc;
            }, {});
        }

        let predictedCategoryBreakdown = {};
        if (prediction) {
            predictedCategoryBreakdown = prediction.categoryBreakdown || {};
            if (Object.keys(predictedCategoryBreakdown).length === 0) {
                // Generate category breakdown if missing
                const monthDate = new Date(month + '-01');
                const pastTransactions = recentTransactions.filter(tx => new Date(tx.date) < monthDate);
                const lastThreeMonths = Object.keys(monthlyData)
                    .filter(m => m < month)
                    .sort()
                    .slice(-3);
                const categoryAverages = {};
                lastThreeMonths.forEach(m => {
                    Object.entries(monthlyData[m]?.categories || {}).forEach(([cat, val]) => {
                        categoryAverages[cat] = (categoryAverages[cat] || 0) + val / lastThreeMonths.length;
                    });
                });

                const predictedCashFlow = prediction.predictedCashFlow || 0;
                const totalCategoryAmount = Object.values(categoryAverages).reduce((sum, val) => sum + val, 0);

                if (totalCategoryAmount !== 0) {
                    Object.entries(categoryAverages).forEach(([cat, val]) => {
                        predictedCategoryBreakdown[cat] = {
                            amount: Math.round((val / totalCategoryAmount) * predictedCashFlow * 100) / 100,
                            type: this.transactions.find(tx => tx.category === cat)?.type || 'Expense'
                        };
                    });
                    const diff = predictedCashFlow - Object.values(predictedCategoryBreakdown).reduce((a, b) => a + b.amount, 0);
                    const firstKey = Object.keys(predictedCategoryBreakdown)[0];
                    if (firstKey) predictedCategoryBreakdown[firstKey].amount += Math.round(diff * 100) / 100;
                } else {
                    predictedCategoryBreakdown = {
                        Income: { amount: prediction.predictedIncome || 0, type: 'Income' },
                        Expenses: { amount: -(prediction.predictedExpenses || 0), type: 'Expense' }
                    };
                }
                // Update the prediction with the generated category breakdown
                await CashFlowPrediction.updateOne(
                    { month },
                    { $set: { categoryBreakdown: predictedCategoryBreakdown } }
                );
            }
        }

        // If no prediction and actual data exists, use actual data as prediction
        if (!prediction && actualData) {
            predictedCategoryBreakdown = actualCategoryBreakdown;
            prediction = {
                month,
                predictedCashFlow: actualCashFlow,
                predictedIncome: actualIncome,
                predictedExpenses: actualExpenses,
                categoryBreakdown: predictedCategoryBreakdown
            };
            await CashFlowPrediction.updateOne(
                { month },
                prediction,
                { upsert: true }
            );
        }

        // Prepare data for Chart.js
        const chartData = {
            labels: historicalMonths.map(m => formatMonth(m)),
            datasets: [
                {
                    label: 'Historical Cash Flow',
                    data: historicalCashFlows.map(h => h.cashFlow),
                    backgroundColor: 'rgba(59, 130, 246, 0.5)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1
                }
            ]
        };

        if (prediction) {
            chartData.datasets.push({
                label: 'Predicted Cash Flow',
                data: historicalMonths.map(m => m === month ? prediction.predictedCashFlow : null),
                backgroundColor: 'rgba(16, 185, 129, 0.5)',
                borderColor: 'rgba(16, 185, 129, 1)',
                borderWidth: 1,
                pointRadius: 5
            });
        }

        if (actualCashFlow !== null) {
            chartData.datasets.push({
                label: 'Actual Cash Flow',
                data: historicalMonths.map(m => m === month ? actualCashFlow : null),
                backgroundColor: 'rgba(239, 68, 68, 0.5)',
                borderColor: 'rgba(239, 68, 68, 1)',
                borderWidth: 1,
                pointRadius: 5
            });
        }

        // Category breakdown for pie chart
        const categoryChartData = {
            labels: Object.keys(predictedCategoryBreakdown),
            datasets: [{
                label: 'Category Breakdown',
                data: Object.values(predictedCategoryBreakdown).map(cat => Math.abs(cat.amount)),
                backgroundColor: Object.values(predictedCategoryBreakdown).map(cat => 
                    cat.type === 'Income' ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)'
                ),
                borderColor: Object.values(predictedCategoryBreakdown).map(cat => 
                    cat.type === 'Income' ? 'rgba(16, 185, 129, 1)' : 'rgba(239, 68, 68, 1)'
                ),
                borderWidth: 1
            }]
        };

        if (actualData) {
            categoryChartData.datasets.push({
                label: 'Actual Category Breakdown',
                data: Object.values(actualCategoryBreakdown).map(cat => Math.abs(cat.amount)),
                backgroundColor: Object.values(actualCategoryBreakdown).map(cat => 
                    cat.type === 'Income' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                ),
                borderColor: Object.values(actualCategoryBreakdown).map(cat => 
                    cat.type === 'Income' ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)'
                ),
                borderWidth: 1
            });
        }

        return {
            historicalMonths: historicalMonths.map(m => formatMonth(m)),
            historicalCashFlows: historicalCashFlows.map(h => h.cashFlow),
            categoryBreakdown: predictedCategoryBreakdown,
            predictedCashFlow: prediction?.predictedCashFlow || null,
            actualCashFlow,
            actualIncome,
            actualExpenses,
            actualCategoryBreakdown,
            chartData,
            categoryChartData
        };
    }
}

function formatMonth(monthStr) {
    try {
        const date = new Date(monthStr + "-01");
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch (e) {
        return monthStr;
    }
}

module.exports = { CashFlowPrediction, CashFlowPredictor };