import os
import pymongo
import pandas as pd
import numpy as np
import pickle
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise ValueError("MONGO_URI not found in .env file")

# MongoDB Connection
client = pymongo.MongoClient(MONGO_URI)
db = client["smart_finance_tracker"]  # Replace with actual database name
transactions_collection = db["transactions"]

# Load the trained model
model_path = "goal_projection_model.pkl"
if not os.path.exists(model_path):
    raise FileNotFoundError("Trained model file not found. Run train_model.py first.")
with open(model_path, "rb") as f:
    model = pickle.load(f)

# Fetch Transactions from MongoDB
transactions = list(transactions_collection.find({}, {"_id": 0, "date": 1, "amount": 1}))
if not transactions:
    raise ValueError("No transactions found in the database.")

df = pd.DataFrame(transactions)
df['date'] = pd.to_datetime(df['date'].apply(lambda x: x['$date'] if isinstance(x, dict) and '$date' in x else x))
df = df.sort_values('date')
df['month'] = df['date'].dt.to_period('M')
monthly_data = df.groupby('month')['amount'].sum().reset_index()
monthly_data['month_num'] = monthly_data['month'].astype(str).str.replace('-', '').astype(int)

# Predict Future Savings
latest_month = monthly_data['month_num'].max()
future_months = [latest_month + i for i in range(1, 4)]  # Next 3 months
future_predictions = model.predict(np.array(future_months).reshape(-1, 1))

# Print Predicted Results
predictions = {str(future_months[i]): round(future_predictions[i], 2) for i in range(len(future_months))}
print("Predicted Savings for Next 3 Months:")
for month, prediction in predictions.items():
    print(f"Month {month}: ₹{prediction}")

# Store predictions in a JSON file for frontend access
import json
with open("goal_projection.json", "w") as json_file:
    json.dump(predictions, json_file)

print("Predictions saved in goal_projection.json")

