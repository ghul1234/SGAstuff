"""
Simple Drawdown Yield Simulation (No external dependencies)
Run locally without pandas/matplotlib
"""

import random
from datetime import datetime, timedelta

class DrawdownYieldSimulation:
    def __init__(self, initial_price=100.0, initial_cash=1000000, leverage=10):
        self.initial_price = initial_price
        self.current_price = initial_price
        self.initial_cash = initial_cash
        self.cash = initial_cash
        self.shares = 0
        self.leverage = leverage  # 10x leverage for futures
        
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
        self.current_step = 0
        
    def simulate_day(self, steps=390, trigger_drawdown_at_step=None):
        """Simulate one trading day (390 minutes for 6.5 hour session)"""
        self.current_step = 0
        
        for step in range(steps):
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
        
        print(f"DRAWDOWN YIELD TRIGGERED at step {self.current_step}")
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
                print(f"   Short selling restriction lifted at step {self.current_step}")
                print(f"   Volatility returned to baseline: {self.current_volatility:.1%}")
        
        return price_change_pct
    
    def execute_trading_logic(self):
        """Execute futures trading with 10x leverage and short selling restrictions"""
        # Get the next price change
        price_change_pct = self.calculate_price_change()
        
        # Calculate position size with leverage
        max_position_value = self.cash * self.leverage
        shares_to_trade = int(max_position_value / self.current_price)
        
        # Trading logic based on market conditions
        if self.drawdown_event_triggered:
            time_since_drawdown = self.current_step - self.drawdown_timestamp
            
            if time_since_drawdown < self.drawdown_cooldown_minutes:
                # During cooldown: NO SHORT SELLING, only allow buying
                if price_change_pct > 0.01:  # 1% threshold for buy signal
                    if self.shares >= 0:  # Only allow long positions
                        cost = shares_to_trade * self.current_price
                        if cost <= self.cash * self.leverage:  # Check margin
                            self.cash -= cost / self.leverage  # Only need margin
                            self.shares += shares_to_trade
                            self.trades.append({
                                'step': self.current_step,
                                'action': 'BUY',
                                'shares': shares_to_trade,
                                'price': self.current_price,
                                'value': cost
                            })
                else:
                    # Block short selling during cooldown
                    if price_change_pct < -0.01:
                        print(f"   Short selling restricted - {self.drawdown_cooldown_minutes - time_since_drawdown:.1f} minutes remaining")
            else:
                # After cooldown: Normal futures trading (long + short)
                if abs(price_change_pct) > 0.01:  # 1% threshold
                    if price_change_pct > 0:
                        # Buy signal
                        cost = shares_to_trade * self.current_price
                        if cost <= self.cash * self.leverage:
                            self.cash -= cost / self.leverage
                            self.shares += shares_to_trade
                            self.trades.append({
                                'step': self.current_step,
                                'action': 'BUY',
                                'shares': shares_to_trade,
                                'price': self.current_price,
                                'value': cost
                            })
                    else:
                        # Sell/short signal (allowed after cooldown)
                        if self.shares > 0:
                            # Close long position
                            proceeds = shares_to_trade * self.current_price
                            self.cash += proceeds / self.leverage
                            self.shares -= shares_to_trade
                            self.trades.append({
                                'step': self.current_step,
                                'action': 'SELL',
                                'shares': shares_to_trade,
                                'price': self.current_price,
                                'value': proceeds
                            })
                        else:
                            # Open short position
                            self.shares -= shares_to_trade  # Negative shares = short
                            self.trades.append({
                                'step': self.current_step,
                                'action': 'SHORT',
                                'shares': shares_to_trade,
                                'price': self.current_price,
                                'value': shares_to_trade * self.current_price
                            })
        else:
            # Normal trading before drawdown
            if abs(price_change_pct) > 0.01:
                if price_change_pct > 0:
                    cost = shares_to_trade * self.current_price
                    if cost <= self.cash * self.leverage:
                        self.cash -= cost / self.leverage
                        self.shares += shares_to_trade
                        self.trades.append({
                            'step': self.current_step,
                            'action': 'BUY',
                            'shares': shares_to_trade,
                            'price': self.current_price,
                            'value': cost
                        })
                else:
                    if self.shares > 0:
                        proceeds = shares_to_trade * self.current_price
                        self.cash += proceeds / self.leverage
                        self.shares -= shares_to_trade
                        self.trades.append({
                            'step': self.current_step,
                            'action': 'SELL',
                            'shares': shares_to_trade,
                            'price': self.current_price,
                            'value': proceeds
                        })
    
    def get_portfolio_value(self):
        """Calculate current portfolio value (handles long and short positions)"""
        position_value = self.shares * self.current_price
        return self.cash + position_value
    
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
        print(f"Leverage: {self.leverage}x")
        print(f"Drawdown Event Triggered: {self.drawdown_event_triggered}")
        
        if self.drawdown_event_triggered:
            print(f"Drawdown Step: {self.drawdown_timestamp}")
            print(f"Pre-drawdown Price: ${self.pre_drawdown_price:.2f}")
            print(f"Ex-dividend Adjustment: ${self.ex_dividend_adjustment:.2f}")
        
        print(f"Total Trades: {len(self.trades)}")
        print(f"Position: {self.shares:+d} shares ({'LONG' if self.shares >= 0 else 'SHORT'})")
        print(f"Cash/Margin: ${self.cash:,.2f}")
        print("="*50)
        
        # Print some sample price movements
        print("\nSample Price Movements:")
        sample_steps = [0, 99, 100, 101, 110, 120, 130]
        for step in sample_steps:
            if step < len(self.price_history):
                vol = self.volatility_history[step]
                price = self.price_history[step]
                print(f"  Step {step:3d}: Price ${price:7.2f} | Volatility {vol:5.1%}")

# Run simulation
if __name__ == "__main__":
    print("Starting Drawdown Yield Simulation with 10x Leverage...")
    print("="*50)
    
    # Create simulation with $100 initial price, $1M initial cash, and 10x leverage
    sim = DrawdownYieldSimulation(initial_price=100.0, initial_cash=1000000, leverage=10)
    
    # Simulate one trading day (390 minutes), trigger drawdown at step 100
    sim.simulate_day(steps=390, trigger_drawdown_at_step=100)
    
    # Print summary
    sim.print_summary()
    
    # Show trade details
    print("\nFirst 15 trades:")
    for i, trade in enumerate(sim.trades[:15]):
        print(f"  Step {trade['step']:3d}: {trade['action']:5s} {trade['shares']:4d} shares @ ${trade['price']:7.2f} (${trade['value']:8.2f})")
    
    print(f"\n... (showing first 15 of {len(sim.trades)} total trades)")
    print(f"\nLeverage used: {sim.leverage}x")
    print(f"Short selling restriction: {sim.drawdown_cooldown_minutes} minutes after drawdown")