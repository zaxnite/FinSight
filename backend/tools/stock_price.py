import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import yfinance as yf
from langchain.tools import tool

# Common name to ticker fallback map for fast lookups
TICKER_MAP = {
    "tesla": "TSLA",
    "apple": "AAPL",
    "microsoft": "MSFT",
    "google": "GOOGL",
    "alphabet": "GOOGL",
    "amazon": "AMZN",
    "nvidia": "NVDA",
    "meta": "META",
    "facebook": "META",
    "netflix": "NFLX",
    "bitcoin": "BTC-USD",
    "ethereum": "ETH-USD",
    "gold": "GC=F",
    "oil": "CL=F",
    "silver": "SI=F",
    "emirates nbd": "ENBD.DU",
    "emaar": "EMAAR.DU",
    "aramco": "2222.SR",
    "saudi aramco": "2222.SR",
    "etisalat": "ETISALAT.DU",
    "e&": "ETISALAT.DU",
    "aldar": "ALDAR.DU",
    "dewa": "DEWA.DU",
    "adnoc": "ADNOCDIST.AD",
    "first abu dhabi": "FAB.AD",
    "fab": "FAB.AD",
    "du": "DU.DU",
    "air arabia": "AIRARarabia.DU",
    "aed": "AEDUSDT",
}


def resolve_ticker(query: str) -> str:
    """Resolve company name or partial name to a ticker symbol."""
    cleaned = query.strip().lower()
    cleaned = cleaned.replace(" stock", "").replace(" price", "").replace(" share", "").strip()

    # Check fast lookup map first
    if cleaned in TICKER_MAP:
        return TICKER_MAP[cleaned]

    # Try direct uppercase (user may have typed ticker directly)
    direct = cleaned.upper()
    try:
        test = yf.Ticker(direct)
        info = test.fast_info
        if info.last_price and info.last_price > 0:
            return direct
    except Exception:
        pass

    # Use yfinance search to find ticker by company name
    try:
        results = yf.Search(cleaned, max_results=3)
        quotes = results.quotes
        if quotes and len(quotes) > 0:
            # Prefer exact or close name matches
            for q in quotes:
                name = q.get("longname", q.get("shortname", "")).lower()
                symbol = q.get("symbol", "")
                if symbol and (cleaned in name or name in cleaned):
                    return symbol
            # Fallback to first result
            first = quotes[0].get("symbol", "")
            if first:
                return first
    except Exception:
        pass

    # Last resort — return uppercased input
    return cleaned.upper()


@tool
def stock_price(query: str) -> str:
    """Fetch the live price, currency, and daily change for any stock, ETF, or cryptocurrency.
    Use this when the user asks about current market prices, stock performance, or cryptocurrency values.
    Input can be a company name (Tesla, Apple, Emirates NBD) or ticker symbol (TSLA, AAPL, ENBD.DU)."""
    try:
        ticker_symbol = resolve_ticker(query)
        data = yf.Ticker(ticker_symbol)
        info = data.fast_info

        current_price = info.last_price
        previous_close = info.previous_close
        currency = getattr(info, "currency", "USD")

        if current_price is None or current_price == 0:
            return (
                f"Could not retrieve a live price for '{query}' (resolved to: {ticker_symbol}). "
                f"The market may be closed or the ticker may be incorrect. "
                f"Try using the official ticker symbol directly (e.g. TSLA for Tesla, AAPL for Apple)."
            )

        change = current_price - previous_close
        change_pct = (change / previous_close) * 100 if previous_close else 0
        direction = "+" if change >= 0 else ""

        # Get company name if available
        try:
            name = data.info.get("longName") or data.info.get("shortName") or ticker_symbol
        except Exception:
            name = ticker_symbol

        return (
            f"Company: {name}\n"
            f"Ticker: {ticker_symbol}\n"
            f"Price: {current_price:.2f} {currency}\n"
            f"Change: {direction}{change:.2f} ({direction}{change_pct:.2f}%)\n"
            f"Previous Close: {previous_close:.2f} {currency}"
        )

    except Exception as e:
        return (
            f"Error fetching data for '{query}': {str(e)}. "
            f"Try using the ticker symbol directly (e.g. TSLA, AAPL, BTC-USD)."
        )