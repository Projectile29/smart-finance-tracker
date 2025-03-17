const Goal = require("../models/goal.model");

// AI-based projection function
const calculateProjection = async (goal) => {
  const { targetAmount, currentSavings, monthlyContribution, history } = goal;

  // Calculate avg monthly savings based on past 3 months
  const lastThreeMonths = history.slice(-3);
  let avgContribution = lastThreeMonths.length
    ? lastThreeMonths.reduce((sum, entry) => sum + entry.savings, 0) / lastThreeMonths.length
    : monthlyContribution;

  if (avgContribution <= 0) return { estimatedMonths: "N/A", status: "Increase Savings" };

  // Calculate estimated months to reach the goal
  const estimatedMonths = Math.ceil((targetAmount - currentSavings) / avgContribution);

  // Dynamic Adjustments
  const projectedCompletionDate = new Date();
  projectedCompletionDate.setMonth(projectedCompletionDate.getMonth() + estimatedMonths);

  return {
    estimatedMonths,
    projectedCompletionDate,
    status: estimatedMonths > 12 ? "Long-term" : "Short-term",
  };
};

// API to get projections for a goal
exports.getGoalProjection = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.goalId);
    if (!goal) return res.status(404).json({ message: "Goal not found" });

    const projection = await calculateProjection(goal);
    res.json(projection);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
