const mongoose = require("mongoose");

const goalSchema = new mongoose.Schema({
  name: { type: String, required: true },
  targetAmount: { type: Number, required: true },
  currentSavings: { type: Number, required: true }
});

const Goal = mongoose.model("Goal", goalSchema); 
module.exports = Goal;
