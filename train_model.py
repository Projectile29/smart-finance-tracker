import os
import pymongo
import pandas as pd
import numpy as np
from dotenv import load_dotenv
from datetime import datetime
from sklearn.linear_model import LinearRegression
import pickle

# Load environment variables from .env file
load_dotenv()

# MongoDB Connection
MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise ValueError("MONGO_URI not found in .env file")

client = pymongo.MongoClient(MONGO_URI)
db = client["smart_finance_tracker"]  # Replace with actual database name
transactions_collection = db["transactions"]

def fetch_transactions():
    """Fetch transactions from MongoDB"""
    transactions = list(transactions_collection.find({}, {"_id": 0, "date": 1, "amount": 1}))

    # Debugging: Print fetched transactions
    print("Fetched Transactions:", transactions)

    # Convert to DataFrame
    df = pd.DataFrame(transactions)

    # Ensure 'date' column exists
    df_columns = df.columns.tolist()
    if 'date' not in df_columns:
        raise KeyError("The 'date' column is missing from the fetched data. Check MongoDB data structure.")

    # Convert 'date' column to datetime format
    df['date'] = pd.to_datetime(df['date'].apply(lambda x: x['$date'] if isinstance(x, dict) and '$date' in x else x))

    # Sort by date
    df = df.sort_values('date')

    return df

def prepare_data(df):
    """Process data for machine learning"""
    df['month'] = df['date'].dt.to_period('M')

    # Group by month and sum transactions
    monthly_data = df.groupby('month')['amount'].sum().reset_index()

    # Convert month to numeric format (e.g., 2024-01 → 202401)
    monthly_data['month_num'] = monthly_data['month'].astype(str).str.replace('-', '').astype(int)

    return monthly_data[['month_num', 'amount']]

def train_model():
    """Train and save the goal projection model"""
    df = fetch_transactions()
    data = prepare_data(df)

    # Extract features and target variable
    X = data[['month_num']].values  # Feature: Month number
    y = data['amount'].values  # Target: Total monthly savings

    # Train Linear Regression Model
    model = LinearRegression()
    model.fit(X, y)

    # Save the trained model
    with open("goal_projection_model.pkl", "wb") as f:
        pickle.dump(model, f)

    print("Model trained and saved successfully!")

# Trigger model training
if __name__ == "__main__":
    train_model()
