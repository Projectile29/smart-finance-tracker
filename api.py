from flask import Flask, request, jsonify
import pickle
import numpy as np

# Load trained model
with open("goal_projection_model.pkl", "rb") as f:
    model = pickle.load(f)

app = Flask(__name__)

@app.route('/api/goal-projection', methods=['POST'])
def goal_projection():
    data = request.json
    target_amount = data.get("targetAmount")
    current_savings = data.get("currentSavings")

    if target_amount is None or current_savings is None:
        return jsonify({"error": "Missing values"}), 400

    # Predict average monthly savings
    predicted_savings = model.predict(np.array([[12]]))[0]  # Estimate savings for 12 months
    avg_monthly_savings = predicted_savings / 12  

    if avg_monthly_savings <= 0:
        return jsonify({"error": "Insufficient data"}), 400

    # Calculate months needed
    months_needed = (target_amount - current_savings) / avg_monthly_savings
    projected_completion_date = pd.to_datetime("today") + pd.DateOffset(months=months_needed)

    return jsonify({
        "avgMonthlySavings": avg_monthly_savings,
        "monthsNeeded": int(np.ceil(months_needed)),
        "projectedCompletionDate": str(projected_completion_date.date())
    })

if __name__ == '__main__':
    app.run(debug=True)
