"""
Download Real Market Data for Drawdown Yield Simulation
Fetches SPY data (S&P 500 ETF) as proxy for ES futures
"""

import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import os

def download_spy_data(days=30, interval='1m'):
    """
    Download SPY data at specified interval
    SPY is used as proxy for ES futures since it's more readily available
    """
    print(f"Downloading SPY data for last {days} days at {interval} interval...")
    
    # Calculate date range
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    # Download data
    ticker = yf.Ticker("SPY")
    
    try:
        data = ticker.history(
            start=start_date,
            end=end_date,
            interval=interval,
            prepost=False,
            auto_adjust=True
        )
        
        if data.empty:
            print("No data downloaded. Trying with different parameters...")
            # Try with 5m interval if 1m fails
            data = ticker.history(
                start=start_date,
                end=end_date,
                interval='5m',
                prepost=False,
                auto_adjust=True
            )
        
        if not data.empty:
            # Save to CSV
            filename = f"spy_data_{interval}_{start_date.strftime('%Y%m%d')}_to_{end_date.strftime('%Y%m%d')}.csv"
            data.to_csv(filename)
            print(f"✅ Data saved to {filename}")
            print(f"📊 {len(data)} data points downloaded")
            print(f"📅 Date range: {data.index[0]} to {data.index[-1]}")
            print(f"💰 Price range: ${data['Close'].min():.2f} - ${data['Close'].max():.2f}")
            
            return filename
        else:
            print("❌ Failed to download data")
            return None
            
    except Exception as e:
        print(f"❌ Error downloading data: {e}")
        return None

def download_multiple_days(days_list=[30, 60, 90]):
    """Download data for multiple time periods"""
    for days in days_list:
        print(f"\n{'='*50}")
        download_spy_data(days=days, interval='5m')

if __name__ == "__main__":
    print("="*50)
    print("SPY Data Downloader for Drawdown Yield Simulation")
    print("="*50)
    
    # Download 30 days of 5-minute data (good balance of detail and availability)
    download_spy_data(days=30, interval='5m')
    
    print("\n" + "="*50)
    print("Download complete!")
    print("="*50)