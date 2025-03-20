const mongoose = require("mongoose");

const salarySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  salaryAmount: { type: Number, required: true },
  salaryDay: { type: Number, required: true },
});

const Salary = mongoose.model("Salary", salarySchema);
module.exports = Salary;
