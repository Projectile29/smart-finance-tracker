import sys
import json
import pickle
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# Load Transactions from Node.js
try:
    transactions = json.loads(sys.argv[1])
    if not transactions:
        print("Error: No transactions available")
        sys.exit(1)
except Exception as e:
    print(f"Error loading transactions: {e}")
    sys.exit(1)

# Convert to DataFrame
df = pd.DataFrame(transactions)

# Ensure correct date format
df["date"] = pd.to_datetime(df["date"])
df["month"] = df["date"].dt.to_period("M")

# Group by month
monthly_data = df.groupby("month")["amount"].sum().reset_index()
monthly_data["month_num"] = monthly_data["month"].astype(str).str.replace("-", "").astype(int)

# Load trained model
try:
    with open("goal_projection_model.pkl", "rb") as f:
        model = pickle.load(f)
except FileNotFoundError:
    print("Error: Model file not found")
    sys.exit(1)
except Exception as e:
    print(f"Error loading model: {e}")
    sys.exit(1)

# Predict next month's savings
if monthly_data.empty:
    print("Error: Not enough data to make predictions")
    sys.exit(1)

# Get the most recent month and compute the next month
latest_month = monthly_data["month"].max()
next_month = (latest_month + pd.DateOffset(months=1)).strftime("%Y%m")

# Convert next_month to integer for model input
next_month_int = int(next_month)

# Make prediction
predicted_savings = model.predict(np.array([[next_month_int]]))[0]

# Set goal amount (This can be dynamic in the future)
goal_amount = 50000

# Check if the goal is already achieved
total_savings = df["amount"].sum()
if total_savings >= goal_amount:
    print("Goal Already Achieved")
    sys.exit(0)

# Calculate months remaining
months_remaining = (goal_amount - total_savings) / predicted_savings

# Ensure months_remaining is not negative
if months_remaining < 0:
    print("Goal Already Achieved")
    sys.exit(0)

# Estimate completion date
completion_date = datetime.now() + timedelta(days=30 * months_remaining)

# Output completion date
print(completion_date.strftime("%a %b %d %Y"))
