import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
from langchain.tools import tool


@tool
def budget_calc(data: str) -> str:
    """Calculate a budget breakdown using the 50/30/20 rule given income and expenses.
    Use this when the user provides their salary or income and wants budgeting advice,
    savings targets, or a spending breakdown.
    Input must be a JSON string with 'income' and optional 'expenses' dict.
    Example: '{\"income\": 10000, \"expenses\": {\"rent\": 3000, \"food\": 1000, \"transport\": 500}}'"""
    try:
        params = json.loads(data)
        income = float(params.get("income", 0))

        if income <= 0:
            return "Please provide a valid income amount."

        needs_target = income * 0.50
        wants_target = income * 0.30
        savings_target = income * 0.20

        expenses = params.get("expenses", {})
        total_expenses = sum(float(v) for v in expenses.values())
        remaining = income - total_expenses

        result = [
            f"💰 Monthly Income: {income:,.2f}",
            f"\n📊 50/30/20 Budget Targets:",
            f"  Needs (50%):   {needs_target:,.2f}",
            f"  Wants (30%):   {wants_target:,.2f}",
            f"  Savings (20%): {savings_target:,.2f}",
        ]

        if expenses:
            result.append(f"\n📋 Your Expenses:")
            for category, amount in expenses.items():
                result.append(f"  {category.capitalize()}: {float(amount):,.2f}")
            result.append(f"\n  Total Expenses: {total_expenses:,.2f}")
            result.append(f"  Remaining: {remaining:,.2f}")

            savings_gap = savings_target - remaining
            if savings_gap > 0:
                result.append(f"\n⚠️  You are {savings_gap:,.2f} short of your savings target.")
            else:
                result.append(f"\n✅ You are on track — {abs(savings_gap):,.2f} above your savings target.")

        return "\n".join(result)

    except json.JSONDecodeError:
        return "Invalid input format. Please provide a JSON string with 'income' and 'expenses'."
    except Exception as e:
        return f"Calculation error: {str(e)}"