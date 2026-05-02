import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import yfinance as yf
from langchain.tools import tool


@tool
def stock_price(ticker: str) -> str:
    """Fetch the live price, currency, and daily change for a stock or crypto.
    Use this when the user asks about current market prices, stock performance,
    or cryptocurrency values. Input must be a valid ticker symbol (e.g. AAPL, BTC-USD, TSLA)."""
    try:
        ticker = ticker.strip().upper()
        data = yf.Ticker(ticker)
        info = data.fast_info

        current_price = info.last_price
        previous_close = info.previous_close
        currency = getattr(info, "currency", "USD")

        if current_price is None:
            return f"Could not retrieve price for '{ticker}'. Please check the ticker symbol."

        change = current_price - previous_close
        change_pct = (change / previous_close) * 100
        direction = "▲" if change >= 0 else "▼"

        return (
            f"Ticker: {ticker}\n"
            f"Price: {current_price:.2f} {currency}\n"
            f"Change: {direction} {abs(change):.2f} ({abs(change_pct):.2f}%)\n"
            f"Previous Close: {previous_close:.2f} {currency}"
        )

    except Exception as e:
        return f"Error fetching data for '{ticker}': {str(e)}"