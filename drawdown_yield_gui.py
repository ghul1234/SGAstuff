"""
Drawdown Yield Simulation GUI with Candlestick Charts
Real-time visualization of futures trading with drawdown yield events
"""

import tkinter as tk
from tkinter import ttk
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib import animation
import matplotlib.dates as mdates
import pandas as pd
import numpy as np
import random
from datetime import datetime, timedelta
import threading
import time

class DrawdownYieldGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("SGA Drawdown Yield Simulation - Futures Trading")
        self.root.geometry("1400x900")
        
        # Simulation parameters
        self.initial_price = 100.0
        self.initial_cash = 1000000
        self.leverage = 10
        self.drawdown_yield_pct = 0.016
        self.volatility_baseline = 0.05
        self.current_volatility = 0.05
        self.drawdown_cooldown_minutes = 10
        
        # Simulation state
        self.current_price = self.initial_price
        self.cash = self.initial_cash
        self.shares = 0
        self.current_step = 0
        self.drawdown_event_triggered = False
        self.drawdown_timestamp = None
        self.pre_drawdown_price = None
        self.ex_dividend_adjustment = None
        
        # Data storage
        self.price_history = []
        self.volatility_history = []
        self.trades = []
        self.time_steps = []
        self.ohlc_data = []
        
        # Running state
        self.is_running = False
        self.simulation_speed = 0.1  # seconds per step
        
        self.setup_gui()
        self.setup_chart()
        
    def setup_gui(self):
        """Setup the GUI layout"""
        # Main container
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Top panel - Controls and Stats
        top_panel = ttk.Frame(main_frame)
        top_panel.pack(fill=tk.X, pady=(0, 10))
        
        # Left side - Controls
        control_frame = ttk.LabelFrame(top_panel, text="Simulation Controls")
        control_frame.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 10))
        
        ttk.Button(control_frame, text="Start Simulation", command=self.start_simulation).pack(pady=5, padx=5)
        ttk.Button(control_frame, text="Stop Simulation", command=self.stop_simulation).pack(pady=5, padx=5)
        ttk.Button(control_frame, text="Reset", command=self.reset_simulation).pack(pady=5, padx=5)
        
        ttk.Label(control_frame, text="Speed:").pack(pady=(10, 0))
        self.speed_scale = ttk.Scale(control_frame, from_=0.01, to=1.0, value=0.1, orient=tk.HORIZONTAL)
        self.speed_scale.pack(pady=5, padx=5)
        
        # Middle - Stats
        stats_frame = ttk.LabelFrame(top_panel, text="Current Stats")
        stats_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 10))
        
        self.portfolio_value_var = tk.StringVar(value="$1,000,000.00")
        self.current_price_var = tk.StringVar(value="$100.00")
        self.position_var = tk.StringVar(value="0 shares")
        self.return_var = tk.StringVar(value="0.00%")
        self.volatility_var = tk.StringVar(value="5.0%")
        self.drawdown_status_var = tk.StringVar(value="No Drawdown")
        
        stats_grid = ttk.Frame(stats_frame)
        stats_grid.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        ttk.Label(stats_grid, text="Portfolio Value:").grid(row=0, column=0, sticky=tk.W)
        ttk.Label(stats_grid, textvariable=self.portfolio_value_var, font=('Arial', 10, 'bold')).grid(row=0, column=1, sticky=tk.W)
        
        ttk.Label(stats_grid, text="Current Price:").grid(row=1, column=0, sticky=tk.W)
        ttk.Label(stats_grid, textvariable=self.current_price_var, font=('Arial', 10, 'bold')).grid(row=1, column=1, sticky=tk.W)
        
        ttk.Label(stats_grid, text="Position:").grid(row=2, column=0, sticky=tk.W)
        ttk.Label(stats_grid, textvariable=self.position_var).grid(row=2, column=1, sticky=tk.W)
        
        ttk.Label(stats_grid, text="Return:").grid(row=3, column=0, sticky=tk.W)
        ttk.Label(stats_grid, textvariable=self.return_var).grid(row=3, column=1, sticky=tk.W)
        
        ttk.Label(stats_grid, text="Volatility:").grid(row=4, column=0, sticky=tk.W)
        ttk.Label(stats_grid, textvariable=self.volatility_var).grid(row=4, column=1, sticky=tk.W)
        
        ttk.Label(stats_grid, text="Drawdown Status:").grid(row=5, column=0, sticky=tk.W)
        ttk.Label(stats_grid, textvariable=self.drawdown_status_var, foreground='red').grid(row=5, column=1, sticky=tk.W)
        
        # Right - Trade Log
        trade_frame = ttk.LabelFrame(top_panel, text="Recent Trades")
        trade_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        self.trade_tree = ttk.Treeview(trade_frame, columns=('Step', 'Action', 'Shares', 'Price', 'Value'), show='headings', height=6)
        self.trade_tree.heading('Step', text='Step')
        self.trade_tree.heading('Action', text='Action')
        self.trade_tree.heading('Shares', text='Shares')
        self.trade_tree.heading('Price', text='Price')
        self.trade_tree.heading('Value', text='Value')
        self.trade_tree.column('Step', width=50)
        self.trade_tree.column('Action', width=80)
        self.trade_tree.column('Shares', width=80)
        self.trade_tree.column('Price', width=80)
        self.trade_tree.column('Value', width=100)
        self.trade_tree.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # Bottom panel - Chart
        chart_frame = ttk.LabelFrame(main_frame, text="Price Chart with Drawdown Events")
        chart_frame.pack(fill=tk.BOTH, expand=True)
        
        self.chart_canvas_frame = ttk.Frame(chart_frame)
        self.chart_canvas_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
    def setup_chart(self):
        """Setup matplotlib chart"""
        self.fig, (self.ax1, self.ax2) = plt.subplots(2, 1, figsize=(12, 8), gridspec_kw={'height_ratios': [3, 1]})
        self.fig.suptitle('SGA Futures Drawdown Yield Simulation', fontsize=14, fontweight='bold')
        
        # Price chart
        self.ax1.set_ylabel('Price ($)')
        self.ax1.set_title('Price Movement with Drawdown Events')
        self.ax1.grid(True, alpha=0.3)
        
        # Volatility chart
        self.ax2.set_ylabel('Volatility')
        self.ax2.set_xlabel('Time Step')
        self.ax2.set_title('Volatility During Simulation')
        self.ax2.grid(True, alpha=0.3)
        
        # Initial data
        self.price_line, = self.ax1.plot([], [], 'b-', linewidth=1.5, label='Price')
        self.volatility_line, = self.ax2.plot([], [], 'r-', linewidth=1.5, label='Volatility')
        
        # Drawdown markers
        self.drawdown_marker = None
        self.cooldown_lines = []
        
        self.ax1.legend()
        self.ax2.legend()
        
        self.canvas = FigureCanvasTkAgg(self.fig, master=self.chart_canvas_frame)
        self.canvas.draw()
        self.canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)
        
    def start_simulation(self):
        """Start the simulation"""
        if not self.is_running:
            self.is_running = True
            self.simulation_thread = threading.Thread(target=self.run_simulation)
            self.simulation_thread.daemon = True
            self.simulation_thread.start()
            
    def stop_simulation(self):
        """Stop the simulation"""
        self.is_running = False
        
    def reset_simulation(self):
        """Reset the simulation"""
        self.stop_simulation()
        time.sleep(0.2)
        
        self.current_price = self.initial_price
        self.cash = self.initial_cash
        self.shares = 0
        self.current_step = 0
        self.drawdown_event_triggered = False
        self.drawdown_timestamp = None
        self.pre_drawdown_price = None
        self.ex_dividend_adjustment = None
        self.current_volatility = self.volatility_baseline
        
        self.price_history = []
        self.volatility_history = []
        self.trades = []
        self.time_steps = []
        self.ohlc_data = []
        
        # Clear chart
        self.price_line.set_data([], [])
        self.volatility_line.set_data([], [])
        if self.drawdown_marker:
            self.drawdown_marker.remove()
            self.drawdown_marker = None
        for line in self.cooldown_lines:
            line.remove()
        self.cooldown_lines = []
        
        self.canvas.draw()
        
        # Clear trade log
        for item in self.trade_tree.get_children():
            self.trade_tree.delete(item)
        
        # Reset stats
        self.update_stats()
        
    def run_simulation(self):
        """Run the simulation in a separate thread"""
        steps = 390  # One trading day
        trigger_drawdown_at_step = 100
        
        for step in range(steps):
            if not self.is_running:
                break
                
            self.current_step = step
            
            # Trigger drawdown at specified step
            if step == trigger_drawdown_at_step and not self.drawdown_event_triggered:
                self.trigger_drawdown_yield()
            
            # Calculate price change
            price_change = self.calculate_price_change()
            self.current_price = max(0.01, self.current_price * (1 + price_change))
            
            # Record data
            self.price_history.append(self.current_price)
            self.volatility_history.append(self.current_volatility)
            self.time_steps.append(step)
            
            # Generate OHLC data for candlestick
            if len(self.price_history) >= 1:
                self.ohlc_data.append({
                    'time': step,
                    'open': self.current_price * (1 - random.random() * 0.01),
                    'high': self.current_price * (1 + random.random() * 0.01),
                    'low': self.current_price * (1 - random.random() * 0.01),
                    'close': self.current_price
                })
            
            # Execute trading logic
            self.execute_trading_logic()
            
            # Update GUI
            self.root.after(0, self.update_gui)
            
            # Sleep for simulation speed
            time.sleep(self.simulation_speed)
        
        self.is_running = False
        
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
        self.current_volatility = self.volatility_baseline * 2.0
        
        self.root.after(0, lambda: self.drawdown_status_var.set(f"DRAWDOWN - {self.drawdown_cooldown_minutes} min cooldown"))
        
    def calculate_price_change(self):
        """Calculate price change based on current volatility regime"""
        price_change_pct = (random.random() - 0.5) * 2 * self.current_volatility
        
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
                self.root.after(0, lambda: self.drawdown_status_var.set("Cooldown Over"))
        
        return price_change_pct
    
    def execute_trading_logic(self):
        """Execute futures trading with 10x leverage and short selling restrictions"""
        price_change_pct = self.calculate_price_change()
        
        # Calculate position size with leverage
        max_position_value = self.cash * self.leverage
        shares_to_trade = int(max_position_value / self.current_price)
        
        if self.drawdown_event_triggered:
            time_since_drawdown = self.current_step - self.drawdown_timestamp
            
            if time_since_drawdown < self.drawdown_cooldown_minutes:
                # During cooldown: NO SHORT SELLING, only allow buying
                if price_change_pct > 0.01:
                    if self.shares >= 0:
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
                # After cooldown: Normal futures trading (long + short)
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
        """Calculate current portfolio value"""
        position_value = self.shares * self.current_price
        return self.cash + position_value
    
    def update_gui(self):
        """Update the GUI elements"""
        # Update stats
        self.update_stats()
        
        # Update chart
        self.update_chart()
        
        # Update trade log
        self.update_trade_log()
        
    def update_stats(self):
        """Update the statistics display"""
        portfolio_value = self.get_portfolio_value()
        return_pct = (portfolio_value / self.initial_cash - 1) * 100
        
        self.portfolio_value_var.set(f"${portfolio_value:,.2f}")
        self.current_price_var.set(f"${self.current_price:.2f}")
        self.position_var.set(f"{self.shares:+,d} shares ({'LONG' if self.shares >= 0 else 'SHORT'})")
        self.return_var.set(f"{return_pct:+.2f}%")
        self.volatility_var.set(f"{self.current_volatility:.1%}")
        
    def update_chart(self):
        """Update the chart with new data"""
        if len(self.time_steps) > 0:
            # Update price line
            self.price_line.set_data(self.time_steps, self.price_history)
            self.ax1.relim()
            self.ax1.autoscale_view()
            
            # Update volatility line
            self.volatility_line.set_data(self.time_steps, self.volatility_history)
            self.ax2.relim()
            self.ax2.autoscale_view()
            
            # Add drawdown marker
            if self.drawdown_event_triggered and self.drawdown_marker is None:
                self.drawdown_marker = self.ax1.axvline(x=self.drawdown_timestamp, color='red', 
                                                      linestyle='--', linewidth=2, label='Drawdown Event')
                self.ax1.legend()
                
                # Add cooldown region
                cooldown_end = self.drawdown_timestamp + self.drawdown_cooldown_minutes
                self.cooldown_lines.append(
                    self.ax1.axvspan(self.drawdown_timestamp, cooldown_end, alpha=0.2, color='red', label='Cooldown')
                )
                self.cooldown_lines.append(
                    self.ax2.axvspan(self.drawdown_timestamp, cooldown_end, alpha=0.2, color='red')
                )
            
            self.canvas.draw()
    
    def update_trade_log(self):
        """Update the trade log with recent trades"""
        # Show only last 10 trades
        recent_trades = self.trades[-10:]
        
        # Clear existing items
        for item in self.trade_tree.get_children():
            self.trade_tree.delete(item)
        
        # Add recent trades
        for trade in recent_trades:
            self.trade_tree.insert('', 'end', values=(
                trade['step'],
                trade['action'],
                f"{trade['shares']:,d}",
                f"${trade['price']:.2f}",
                f"${trade['value']:,.2f}"
            ))

def main():
    root = tk.Tk()
    app = DrawdownYieldGUI(root)
    root.mainloop()

if __name__ == "__main__":
    main()