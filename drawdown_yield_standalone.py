"""
Standalone Drawdown Yield Simulation
Run locally without QuantConnect - uses pandas for simulation
"""

import pandas as pd
import numpy as np
import random
from datetime import datetime, timedelta
import matplotlib.pyplot as plt

class DrawdownYieldSimulation:
    def __init__(self, initial_price=100.0, initial_cash=1000000):
        self.initial_price = initial_price
        self.current_price = initial_price
        self.initial_cash = initial_cash
        self.cash = initial_cash
        self.shares = 0
        
        # Simulation parameters
        self.drawdown_yield_pct = 0.016  # 1.6% drawdown yield
        self.volatility_baseline = 0.05  # 5% baseline volatility
        self.current_volatility = 0.05
        self.drawdown_cooldown_minutes = 10  # 10-minute short selling restriction
        self.drawdown_event_triggered = False
        self.drawdown_timestamp = None
        
        # Track metrics
        self.pre_drawdown_price = None
        self.ex_dividend_adjustment = None
        self.price_history = []
        self.volatility_history = []
        self.trades = []
        
        # Simulation data
        self.time_steps = []
        self.current_step = 0
        
    def simulate_day(self, steps=390, trigger_drawdown_at_step=None):
        """Simulate one trading day (390 minutes for 6.5 hour session)"""
        self.current_step = 0
        
        for step in range(steps):
            current_time = datetime.now() + timedelta(minutes=step)
            self.time_steps.append(current_time)
            
            # Trigger drawdown at specified step (default: random time between 10:00-15:00)
            if trigger_drawdown_at_step is None:
                if step == random.randint(60, 300) and not self.drawdown_event_triggered:
                    self.trigger_drawdown_yield()
            elif step == trigger_drawdown_at_step and not self.drawdown_event_triggered:
                self.trigger_drawdown_yield()
            
            # Apply volatility-based price movement
            price_change = self.calculate_price_change()
            self.current_price = max(0.01, self.current_price * (1 + price_change))
            
            # Record history
            self.price_history.append(self.current_price)
            self.volatility_history.append(self.current_volatility)
            
            # Trading logic
            self.execute_trading_logic()
            
            self.current_step += 1
    
    def trigger_drawdown_yield(self):
        """Execute the drawdown yield event"""
        self.drawdown_event_triggered = True
        self.drawdown_timestamp = self.current_step
        self.pre_drawdown_price = self.current_price
        
        # Calculate ex-dividend adjustment (1.6% drawdown)
        self.ex_dividend_adjustment = self.pre_drawdown_price * self.drawdown_yield_pct
        
        # Apply immediate price drop (ex-dividend effect)
        self.current_price = self.current_price * (1 - self.drawdown_yield_pct)
        
        # Increase volatility temporarily after drawdown
        self.current_volatility = self.volatility_baseline * 2.0  # Double volatility
        
        print(f"⚡ DRAWDOWN YIELD TRIGGERED at step {self.current_step}")
        print(f"   Pre-drawdown price: ${self.pre_drawdown_price:.2f}")
        print(f"   Ex-dividend adjustment: ${self.ex_dividend_adjustment:.2f} ({self.drawdown_yield_pct:.1%})")
        print(f"   Post-drawdown price: ${self.current_price:.2f}")
        print(f"   Volatility increased to: {self.current_volatility:.1%}")
        print(f"   Short selling restricted for {self.drawdown_cooldown_minutes} minutes")
    
    def calculate_price_change(self):
        """Calculate price change based on current volatility regime"""
        # Generate random price movement based on current volatility
        price_change_pct = (random.random() - 0.5) * 2 * self.current_volatility
        
        # Apply regime-specific logic
        if self.drawdown_event_triggered:
            time_since_drawdown = self.current_step - self.drawdown_timestamp
            
            if time_since_drawdown < self.drawdown_cooldown_minutes:
                # In cooldown period - higher probability of downward moves
                if random.random() < 0.6:  # 60% downward bias
                    price_change_pct = -abs(price_change_pct)
                
                # 30% chance of additional downward pressure
                if random.random() < 0.3:
                    price_change_pct -= abs(price_change_pct) * 0.5
            else:
                # Cooldown period over - return to normal volatility
                self.current_volatility = self.volatility_baseline
                print(f"   ✅ Short selling restriction lifted at step {self.current_step}")
                print(f"   Volatility returned to baseline: {self.current_volatility:.1%}")
        
        return price_change_pct
    
    def execute_trading_logic(self):
        """Execute trading based on volatility regime"""
        # Get the next price change
        price_change_pct = self.calculate_price_change()
        
        # Apply trading threshold
        if abs(price_change_pct) > 0.01:  # 1% threshold
            if price_change_pct > 0:
                # Buy signal
                shares_to_buy = int((self.cash * 0.1) / self.current_price)
                if shares_to_buy > 0:
                    cost = shares_to_buy * self.current_price
                    self.cash -= cost
                    self.shares += shares_to_buy
                    self.trades.append({
                        'step': self.current_step,
                        'action': 'BUY',
                        'shares': shares_to_buy,
                        'price': self.current_price,
                        'value': cost
                    })
            else:
                # Sell/short signal - check restriction
                if self.drawdown_event_triggered:
                    time_since_drawdown = self.current_step - self.drawdown_timestamp
                    if time_since_drawdown < self.drawdown_cooldown_minutes:
                        # Short selling restricted
                        remaining_minutes = self.drawdown_cooldown_minutes - time_since_drawdown
                        print(f"   🔒 Short selling restricted - {remaining_minutes:.1f} minutes remaining")
                        return
                
                # Execute sell
                if self.shares > 0:
                    shares_to_sell = int(self.shares * 0.1)
                    if shares_to_sell > 0:
                        proceeds = shares_to_sell * self.current_price
                        self.cash += proceeds
                        self.shares -= shares_to_sell
                        self.trades.append({
                            'step': self.current_step,
                            'action': 'SELL',
                            'shares': shares_to_sell,
                            'price': self.current_price,
                            'value': proceeds
                        })
    
    def get_portfolio_value(self):
        """Calculate current portfolio value"""
        return self.cash + (self.shares * self.current_price)
    
    def print_summary(self):
        """Print simulation summary"""
        print("\n" + "="*50)
        print("SIMULATION SUMMARY")
        print("="*50)
        print(f"Initial Portfolio Value: ${self.initial_cash:,.2f}")
        print(f"Final Portfolio Value: ${self.get_portfolio_value():,.2f}")
        print(f"Total Return: {(self.get_portfolio_value() / self.initial_cash - 1):.2%}")
        print(f"Final Price: ${self.current_price:.2f}")
        print(f"Price Change: {(self.current_price / self.initial_price - 1):.2%}")
        print(f"Drawdown Event Triggered: {self.drawdown_event_triggered}")
        
        if self.drawdown_event_triggered:
            print(f"Drawdown Step: {self.drawdown_timestamp}")
            print(f"Pre-drawdown Price: ${self.pre_drawdown_price:.2f}")
            print(f"Ex-dividend Adjustment: ${self.ex_dividend_adjustment:.2f}")
        
        print(f"Total Trades: {len(self.trades)}")
        print(f"Shares Held: {self.shares}")
        print(f"Cash Remaining: ${self.cash:,.2f}")
        print("="*50)
    
    def plot_results(self):
        """Plot price and volatility over time"""
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8))
        
        # Price chart
        ax1.plot(self.price_history, label='Price', color='blue')
        if self.drawdown_event_triggered:
            ax1.axvline(x=self.drawdown_timestamp, color='red', linestyle='--', 
                       label='Drawdown Event')
            ax1.axvline(x=self.drawdown_timestamp + self.drawdown_cooldown_minutes, 
                       color='green', linestyle='--', label='Short Selling Lifted')
        ax1.set_ylabel('Price ($)')
        ax1.set_title('Price Movement During Simulation')
        ax1.legend()
        ax1.grid(True)
        
        # Volatility chart
        ax2.plot(self.volatility_history, label='Volatility', color='orange')
        if self.drawdown_event_triggered:
            ax2.axvline(x=self.drawdown_timestamp, color='red', linestyle='--', 
                       label='Drawdown Event')
            ax2.axvline(x=self.drawdown_timestamp + self.drawdown_cooldown_minutes, 
                       color='green', linestyle='--', label='Short Selling Lifted')
        ax2.set_ylabel('Volatility')
        ax2.set_xlabel('Time Step')
        ax2.set_title('Volatility During Simulation')
        ax2.legend()
        ax2.grid(True)
        
        plt.tight_layout()
        plt.show()

# Run simulation
if __name__ == "__main__":
    print("Starting Drawdown Yield Simulation...")
    print("="*50)
    
    # Create simulation with $100 initial price and $1M initial cash
    sim = DrawdownYieldSimulation(initial_price=100.0, initial_cash=1000000)
    
    # Simulate one trading day (390 minutes), trigger drawdown at step 100
    sim.simulate_day(steps=390, trigger_drawdown_at_step=100)
    
    # Print summary
    sim.print_summary()
    
    # Plot results
    sim.plot_results()
    
    # Show trade details
    print("\nFirst 10 trades:")
    for i, trade in enumerate(sim.trades[:10]):
        print(f"  Step {trade['step']}: {trade['action']} {trade['shares']} shares @ ${trade['price']:.2f} (${trade['value']:.2f})")