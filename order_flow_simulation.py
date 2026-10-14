"""
Order Flow Simulation with No Short Selling
Realistic modeling of market dynamics, order book depth, and trading patterns
"""

import tkinter as tk
from tkinter import ttk
import random
import threading
import time
from datetime import datetime, timedelta
import pandas as pd
from collections import deque
import numpy as np

class OrderBook:
    """Simulates a realistic order book with bid/ask depth"""
    def __init__(self, base_price, tick_size=0.01):
        self.tick_size = tick_size
        self.base_price = base_price
        self.bids = {}  # price -> quantity
        self.asks = {}  # price -> quantity
        self.last_price = base_price
        self.spread = tick_size * 2  # 2 tick spread
        
        # Initialize order book with realistic depth
        self.initialize_order_book()
        
    def initialize_order_book(self):
        """Initialize order book with realistic depth around current price"""
        # Create bid side (buy orders)
        for i in range(1, 20):  # 20 price levels
            price = self.base_price - (i * self.tick_size)
            # Exponential decay in liquidity as we move away from mid
            liquidity = int(10000 * np.exp(-i * 0.2) + random.uniform(100, 500))
            self.bids[price] = liquidity
            
        # Create ask side (sell orders)
        for i in range(1, 20):
            price = self.base_price + (i * self.tick_size)
            liquidity = int(10000 * np.exp(-i * 0.2) + random.uniform(100, 500))
            self.asks[price] = liquidity
            
    def get_best_bid(self):
        """Get highest bid price"""
        if self.bids:
            return max(self.bids.keys())
        return self.base_price - self.tick_size
        
    def get_best_ask(self):
        """Get lowest ask price"""
        if self.asks:
            return min(self.asks.keys())
        return self.base_price + self.tick_size
        
    def get_mid_price(self):
        """Get mid price"""
        return (self.get_best_bid() + self.get_best_ask()) / 2
        
    def get_spread(self):
        """Get current spread"""
        return self.get_best_ask() - self.get_best_bid()
        
    def add_market_buy_order(self, quantity):
        """Execute market buy order and return fill price and slippage"""
        filled_quantity = 0
        total_cost = 0
        avg_fill_price = 0
        
        while filled_quantity < quantity and self.asks:
            best_ask = min(self.asks.keys())
            available_quantity = self.asks[best_ask]
            
            # Take liquidity from this level
            take_quantity = min(available_quantity, quantity - filled_quantity)
            total_cost += best_ask * take_quantity
            filled_quantity += take_quantity
            
            # Remove consumed liquidity
            if take_quantity >= available_quantity:
                del self.asks[best_ask]
            else:
                self.asks[best_ask] -= take_quantity
                
        if filled_quantity > 0:
            avg_fill_price = total_cost / filled_quantity
            self.last_price = avg_fill_price
            
            # Market impact: move ask prices up slightly
            self.apply_market_impact('buy', filled_quantity)
            
        return avg_fill_price, filled_quantity
        
    def add_market_sell_order(self, quantity):
        """Execute market sell order and return fill price and slippage"""
        filled_quantity = 0
        total_proceeds = 0
        avg_fill_price = 0
        
        while filled_quantity < quantity and self.bids:
            best_bid = max(self.bids.keys())
            available_quantity = self.bids[best_bid]
            
            # Take liquidity from this level
            take_quantity = min(available_quantity, quantity - filled_quantity)
            total_proceeds += best_bid * take_quantity
            filled_quantity += take_quantity
            
            # Remove consumed liquidity
            if take_quantity >= available_quantity:
                del self.bids[best_bid]
            else:
                self.bids[best_bid] -= take_quantity
                
        if filled_quantity > 0:
            avg_fill_price = total_proceeds / filled_quantity
            self.last_price = avg_fill_price
            
            # Market impact: move bid prices down slightly
            self.apply_market_impact('sell', filled_quantity)
            
        return avg_fill_price, filled_quantity
        
    def apply_market_impact(self, side, quantity):
        """Apply market impact by moving prices based on order size"""
        impact_factor = min(0.05, quantity / 100000)  # Max 5% impact
        
        if side == 'buy':
            # Move asks up
            new_asks = {}
            for price, qty in self.asks.items():
                new_price = price * (1 + impact_factor * random.uniform(0.5, 1.0))
                new_asks[round(new_price, 2)] = qty
            self.asks = new_asks
            
            # Also move bids up slightly (price discovery)
            new_bids = {}
            for price, qty in self.bids.items():
                new_price = price * (1 + impact_factor * 0.3)
                new_bids[round(new_price, 2)] = qty
            self.bids = new_bids
            
        else:  # sell
            # Move bids down
            new_bids = {}
            for price, qty in self.bids.items():
                new_price = price * (1 - impact_factor * random.uniform(0.5, 1.0))
                new_bids[round(new_price, 2)] = qty
            self.bids = new_bids
            
            # Also move asks down slightly
            new_asks = {}
            for price, qty in self.asks.items():
                new_price = price * (1 - impact_factor * 0.3)
                new_asks[round(new_price, 2)] = qty
            self.asks = new_asks
            
    def refresh_liquidity(self):
        """Add new liquidity to simulate continuous order flow"""
        # Add new bids around current price
        mid = self.get_mid_price()
        for i in range(1, 5):
            bid_price = mid - (i * self.tick_size)
            if bid_price not in self.bids:
                self.bids[round(bid_price, 2)] = int(random.uniform(100, 1000))
            else:
                self.bids[round(bid_price, 2)] += int(random.uniform(50, 200))
                
        # Add new asks around current price
        for i in range(1, 5):
            ask_price = mid + (i * self.tick_size)
            if ask_price not in self.asks:
                self.asks[round(ask_price, 2)] = int(random.uniform(100, 1000))
            else:
                self.asks[round(ask_price, 2)] += int(random.uniform(50, 200))
                
    def simulate_random_order_flow(self):
        """Simulate random market orders from other participants"""
        # Random buy/sell orders from other market participants
        if random.random() < 0.3:  # 30% chance of random order each step
            side = random.choice(['buy', 'sell'])
            quantity = int(random.uniform(100, 2000))
            
            if side == 'buy':
                self.add_market_buy_order(quantity)
            else:
                self.add_market_sell_order(quantity)
                
            # Refresh liquidity after orders
            self.refresh_liquidity()

class OrderFlowSimulation:
    def __init__(self, root):
        self.root = root
        self.root.title("Order Flow Simulation - No Short Selling")
        self.root.geometry("1600x1000")
        
        # Simulation parameters
        self.initial_cash = 1000000
        self.leverage = 10
        self.initial_price = 450.0
        self.drawdown_yield_pct = 0.016
        self.cooldown_period = 10  # minutes
        
        # Try to load real data
        self.use_real_data = True
        self.real_data = None
        self.data_index = 0
        try:
            self.real_data = pd.read_csv("spy_realistic_data_30days.csv", index_col=0, parse_dates=True)
            self.initial_price = self.real_data['close'].iloc[0]
            print(f"Loaded real data: {len(self.real_data)} points")
        except FileNotFoundError:
            print("Real data file not found, using synthetic data")
            self.use_real_data = False
            
        # Initialize order book
        self.order_book = OrderBook(self.initial_price)
        
        # Trading state
        self.cash = self.initial_cash
        self.position = 0  # Number of shares (long only, no shorts)
        self.entry_price = None
        self.entry_time = None
        
        # Simulation state
        self.current_step = 0
        self.is_running = False
        self.simulation_speed = 0.05
        
        # Data storage
        self.price_history = []
        self.bid_history = []
        self.ask_history = []
        self.volume_history = []
        self.trades = []
        self.order_flow_data = deque(maxlen=1000)  # Recent order flow
        
        # Drawdown state
        self.drawdown_triggered = False
        self.drawdown_step = None
        self.holding_position = False
        
        self.setup_gui()
        
    def setup_gui(self):
        """Setup the GUI layout"""
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Top panel - Controls and Stats
        top_panel = ttk.Frame(main_frame)
        top_panel.pack(fill=tk.X, pady=(0, 10))
        
        # Controls
        control_frame = ttk.LabelFrame(top_panel, text="Controls")
        control_frame.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 10))
        
        ttk.Button(control_frame, text="Start", command=self.start_simulation).pack(pady=5, padx=5)
        ttk.Button(control_frame, text="Stop", command=self.stop_simulation).pack(pady=5, padx=5)
        ttk.Button(control_frame, text="Reset", command=self.reset_simulation).pack(pady=5, padx=5)
        
        ttk.Label(control_frame, text="Speed:").pack(pady=(10, 0))
        self.speed_scale = ttk.Scale(control_frame, from_=0.001, to=1.0, value=0.05, orient=tk.HORIZONTAL)
        self.speed_scale.pack(pady=5, padx=5)
        
        # Stats
        stats_frame = ttk.LabelFrame(top_panel, text="Market Stats")
        stats_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 10))
        
        self.mid_price_var = tk.StringVar(value=f"${self.initial_price:.2f}")
        self.bid_var = tk.StringVar(value="$0.00")
        self.ask_var = tk.StringVar(value="$0.00")
        self.spread_var = tk.StringVar(value="0.00")
        self.position_var = tk.StringVar(value="0 shares")
        self.cash_var = tk.StringVar(value=f"${self.initial_cash:,.2f}")
        self.portfolio_value_var = tk.StringVar(value=f"${self.initial_cash:,.2f}")
        self.pnl_var = tk.StringVar(value="$0.00")
        self.return_var = tk.StringVar(value="0.00%")
        
        stats_grid = ttk.Frame(stats_frame)
        stats_grid.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        ttk.Label(stats_grid, text="Mid Price:").grid(row=0, column=0, sticky=tk.W)
        ttk.Label(stats_grid, textvariable=self.mid_price_var, font=('Arial', 10, 'bold')).grid(row=0, column=1, sticky=tk.W)
        
        ttk.Label(stats_grid, text="Best Bid:").grid(row=1, column=0, sticky=tk.W)
        ttk.Label(stats_grid, textvariable=self.bid_var, foreground='green').grid(row=1, column=1, sticky=tk.W)
        
        ttk.Label(stats_grid, text="Best Ask:").grid(row=2, column=0, sticky=tk.W)
        ttk.Label(stats_grid, textvariable=self.ask_var, foreground='red').grid(row=2, column=1, sticky=tk.W)
        
        ttk.Label(stats_grid, text="Spread:").grid(row=3, column=0, sticky=tk.W)
        ttk.Label(stats_grid, textvariable=self.spread_var).grid(row=3, column=1, sticky=tk.W)
        
        ttk.Label(stats_grid, text="Position:").grid(row=4, column=0, sticky=tk.W)
        ttk.Label(stats_grid, textvariable=self.position_var).grid(row=4, column=1, sticky=tk.W)
        
        ttk.Label(stats_grid, text="Cash:").grid(row=5, column=0, sticky=tk.W)
        ttk.Label(stats_grid, textvariable=self.cash_var).grid(row=5, column=1, sticky=tk.W)
        
        ttk.Label(stats_grid, text="Portfolio Value:").grid(row=6, column=0, sticky=tk.W)
        ttk.Label(stats_grid, textvariable=self.portfolio_value_var, font=('Arial', 10, 'bold')).grid(row=6, column=1, sticky=tk.W)
        
        ttk.Label(stats_grid, text="P&L:").grid(row=7, column=0, sticky=tk.W)
        self.pnl_label = ttk.Label(stats_grid, textvariable=self.pnl_var, font=('Arial', 10, 'bold'))
        self.pnl_label.grid(row=7, column=1, sticky=tk.W)
        
        ttk.Label(stats_grid, text="Return:").grid(row=8, column=0, sticky=tk.W)
        self.return_label = ttk.Label(stats_grid, textvariable=self.return_var, font=('Arial', 10, 'bold'))
        self.return_label.grid(row=8, column=1, sticky=tk.W)
        
        # Order book display
        orderbook_frame = ttk.LabelFrame(top_panel, text="Order Book (Top 5 Levels)")
        orderbook_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        self.orderbook_tree = ttk.Treeview(orderbook_frame, columns=('BidSize', 'BidPrice', 'AskPrice', 'AskSize'), show='headings', height=5)
        self.orderbook_tree.heading('BidSize', text='Bid Size')
        self.orderbook_tree.heading('BidPrice', text='Bid Price')
        self.orderbook_tree.heading('AskPrice', text='Ask Price')
        self.orderbook_tree.heading('AskSize', text='Ask Size')
        self.orderbook_tree.column('BidSize', width=80)
        self.orderbook_tree.column('BidPrice', width=80)
        self.orderbook_tree.column('AskPrice', width=80)
        self.orderbook_tree.column('AskSize', width=80)
        self.orderbook_tree.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # Middle panel - Charts
        chart_frame = ttk.LabelFrame(main_frame, text="Price Chart")
        chart_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))
        
        self.canvas = tk.Canvas(chart_frame, bg='white', height=300)
        self.canvas.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # Bottom panel - Order Flow and Trades
        bottom_panel = ttk.Frame(main_frame)
        bottom_panel.pack(fill=tk.BOTH, expand=True)
        
        # Order flow
        flow_frame = ttk.LabelFrame(bottom_panel, text="Recent Order Flow")
        flow_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 10))
        
        self.flow_tree = ttk.Treeview(flow_frame, columns=('Time', 'Side', 'Qty', 'Price', 'Type'), show='headings', height=8)
        self.flow_tree.heading('Time', text='Time')
        self.flow_tree.heading('Side', text='Side')
        self.flow_tree.heading('Qty', text='Qty')
        self.flow_tree.heading('Price', text='Price')
        self.flow_tree.heading('Type', text='Type')
        self.flow_tree.column('Time', width=60)
        self.flow_tree.column('Side', width=50)
        self.flow_tree.column('Qty', width=80)
        self.flow_tree.column('Price', width=80)
        self.flow_tree.column('Type', width=80)
        self.flow_tree.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # My trades
        trades_frame = ttk.LabelFrame(bottom_panel, text="My Trades")
        trades_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        self.trades_tree = ttk.Treeview(trades_frame, columns=('Time', 'Action', 'Qty', 'Price', 'Value'), show='headings', height=8)
        self.trades_tree.heading('Time', text='Time')
        self.trades_tree.heading('Action', text='Action')
        self.trades_tree.heading('Qty', text='Qty')
        self.trades_tree.heading('Price', text='Price')
        self.trades_tree.heading('Value', text='Value')
        self.trades_tree.column('Time', width=60)
        self.trades_tree.column('Action', width=80)
        self.trades_tree.column('Qty', width=80)
        self.trades_tree.column('Price', width=80)
        self.trades_tree.column('Value', width=100)
        self.trades_tree.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
    def start_simulation(self):
        if not self.is_running:
            self.is_running = True
            thread = threading.Thread(target=self.run_simulation)
            thread.daemon = True
            thread.start()
            
    def stop_simulation(self):
        self.is_running = False
        
    def reset_simulation(self):
        self.stop_simulation()
        time.sleep(0.1)
        
        self.cash = self.initial_cash
        self.position = 0
        self.entry_price = None
        self.entry_time = None
        self.current_step = 0
        self.drawdown_triggered = False
        self.drawdown_step = None
        self.holding_position = False
        
        self.price_history = []
        self.bid_history = []
        self.ask_history = []
        self.volume_history = []
        self.trades = []
        self.order_flow_data.clear()
        
        # Reinitialize order book
        self.order_book = OrderBook(self.initial_price)
        
        self.update_gui()
        
    def run_simulation(self):
        steps = 500 if self.use_real_data and self.real_data is not None else 390
        
        for step in range(steps):
            if not self.is_running:
                break
                
            self.current_step = step
            self.simulation_speed = self.speed_scale.get()
            
            # Trigger drawdown at step 0 (immediate)
            if step == 0 and not self.drawdown_triggered:
                self.trigger_drawdown()
                
            # Update price from real data or simulate
            if self.use_real_data and self.data_index < len(self.real_data):
                row = self.real_data.iloc[self.data_index]
                target_price = row['close']
                self.data_index += 1
                
                # Move order book toward target price
                self.adjust_order_book_to_price(target_price)
            else:
                # Simulate random order flow
                self.order_book.simulate_random_order_flow()
                
            # Execute trading logic
            self.execute_trading_logic()
            
            # Record data
            mid_price = self.order_book.get_mid_price()
            self.price_history.append(mid_price)
            self.bid_history.append(self.order_book.get_best_bid())
            self.ask_history.append(self.order_book.get_best_ask())
            
            # Update GUI
            self.root.after(0, self.update_gui)
            
            time.sleep(self.simulation_speed)
            
        self.is_running = False
        
    def trigger_drawdown(self):
        """Trigger drawdown event"""
        self.drawdown_triggered = True
        self.drawdown_step = self.current_step
        
        # Apply immediate price drop to order book
        current_mid = self.order_book.get_mid_price()
        target_mid = current_mid * (1 - self.drawdown_yield_pct)
        
        # Move entire order book down
        self.adjust_order_book_to_price(target_mid)
        
        print(f"Drawdown triggered at step {self.current_step}")
        print(f"Price dropped from ${current_mid:.2f} to ${target_mid:.2f}")
        
    def adjust_order_book_to_price(self, target_price):
        """Adjust order book to center around target price"""
        current_mid = self.order_book.get_mid_price()
        adjustment_factor = target_price / current_mid
        
        # Adjust all bid prices
        new_bids = {}
        for price, qty in self.order_book.bids.items():
            new_price = price * adjustment_factor
            new_bids[round(new_price, 2)] = qty
        self.order_book.bids = new_bids
        
        # Adjust all ask prices
        new_asks = {}
        for price, qty in self.order_book.asks.items():
            new_price = price * adjustment_factor
            new_asks[round(new_price, 2)] = qty
        self.order_book.asks = new_asks
        
        # Refresh liquidity around new price
        self.order_book.refresh_liquidity()
        
    def execute_trading_logic(self):
        """Execute trading logic with no short selling"""
        if not self.drawdown_triggered:
            return
            
        time_since_drawdown = self.current_step - self.drawdown_step
        
        # Enter long position 1 step after drawdown
        if time_since_drawdown == 1 and self.position == 0:
            self.enter_long_position()
            
        # Hold position during cooldown period
        elif 1 < time_since_drawdown < self.cooldown_period + 1:
            pass  # Just hold
            
        # Close position after cooldown
        elif time_since_drawdown == self.cooldown_period + 1 and self.position > 0:
            self.close_position()
            
    def enter_long_position(self):
        """Enter long position using market order"""
        # Calculate position size based on available cash and leverage
        available_cash = self.cash * self.leverage
        current_ask = self.order_book.get_best_ask()
        
        if current_ask > 0:
            shares_to_buy = int(available_cash / current_ask)
            
            if shares_to_buy > 0:
                # Execute market buy order
                fill_price, filled_qty = self.order_book.add_market_buy_order(shares_to_buy)
                
                if filled_qty > 0:
                    cost = fill_price * filled_qty
                    self.cash -= cost / self.leverage
                    self.position = filled_qty
                    self.entry_price = fill_price
                    self.entry_time = self.current_step
                    
                    # Record trade
                    self.trades.append({
                        'step': self.current_step,
                        'action': 'BUY',
                        'quantity': filled_qty,
                        'price': fill_price,
                        'value': cost
                    })
                    
                    # Record order flow
                    self.order_flow_data.append({
                        'time': self.current_step,
                        'side': 'BUY',
                        'qty': filled_qty,
                        'price': fill_price,
                        'type': 'MY_ORDER'
                    })
                    
                    print(f"Step {self.current_step}: BOUGHT {filled_qty} @ ${fill_price:.2f} (Cost: ${cost:,.2f})")
                    
    def close_position(self):
        """Close long position using market order"""
        if self.position > 0:
            # Execute market sell order
            fill_price, filled_qty = self.order_book.add_market_sell_order(self.position)
            
            if filled_qty > 0:
                proceeds = fill_price * filled_qty
                self.cash += proceeds / self.leverage
                
                # Calculate P&L
                pnl = (fill_price - self.entry_price) * self.position
                return_pct = ((fill_price / self.entry_price) - 1) * 100
                leveraged_return = return_pct * self.leverage
                
                # Record trade
                self.trades.append({
                    'step': self.current_step,
                    'action': 'SELL',
                    'quantity': filled_qty,
                    'price': fill_price,
                    'value': proceeds
                })
                
                # Record order flow
                self.order_flow_data.append({
                    'time': self.current_step,
                    'side': 'SELL',
                    'qty': filled_qty,
                    'price': fill_price,
                    'type': 'MY_ORDER'
                })
                
                print(f"Step {self.current_step}: SOLD {filled_qty} @ ${fill_price:.2f}")
                print(f"  P&L: ${pnl:,.2f} ({leveraged_return:+.2f}% with {self.leverage}x leverage)")
                
                self.position = 0
                self.entry_price = None
                
    def get_portfolio_value(self):
        """Calculate current portfolio value"""
        if self.position > 0:
            position_value = (self.position * self.order_book.get_mid_price()) / self.leverage
            return self.cash + position_value
        return self.cash
        
    def update_gui(self):
        """Update GUI elements"""
        # Update stats
        mid_price = self.order_book.get_mid_price()
        best_bid = self.order_book.get_best_bid()
        best_ask = self.order_book.get_best_ask()
        spread = self.order_book.get_spread()
        
        self.mid_price_var.set(f"${mid_price:.2f}")
        self.bid_var.set(f"${best_bid:.2f}")
        self.ask_var.set(f"${best_ask:.2f}")
        self.spread_var.set(f"${spread:.2f}")
        
        self.position_var.set(f"{self.position:,} shares")
        self.cash_var.set(f"${self.cash:,.2f}")
        
        portfolio_value = self.get_portfolio_value()
        self.portfolio_value_var.set(f"${portfolio_value:,.2f}")
        
        # Calculate P&L if in position
        if self.position > 0 and self.entry_price:
            unrealized_pnl = (mid_price - self.entry_price) * self.position
            self.pnl_var.set(f"${unrealized_pnl:,.2f}")
            
            return_pct = ((mid_price / self.entry_price) - 1) * 100
            leveraged_return = return_pct * self.leverage
            self.return_var.set(f"{leveraged_return:+.2f}%")
            
            if unrealized_pnl >= 0:
                self.pnl_label.configure(foreground='green')
                self.return_label.configure(foreground='green')
            else:
                self.pnl_label.configure(foreground='red')
                self.return_label.configure(foreground='red')
        else:
            total_return = ((portfolio_value / self.initial_cash) - 1) * 100
            self.pnl_var.set("$0.00")
            self.return_var.set(f"{total_return:+.2f}%")
            
            if total_return >= 0:
                self.return_label.configure(foreground='green')
            else:
                self.return_label.configure(foreground='red')
        
        # Update order book display
        self.update_orderbook_display()
        
        # Update order flow display
        self.update_order_flow_display()
        
        # Update trades display
        self.update_trades_display()
        
        # Update chart
        self.draw_chart()
        
    def update_orderbook_display(self):
        """Update order book tree view"""
        # Clear existing items
        for item in self.orderbook_tree.get_children():
            self.orderbook_tree.delete(item)
            
        # Get top 5 bid levels (sorted descending)
        top_bids = sorted(self.order_book.bids.items(), key=lambda x: x[0], reverse=True)[:5]
        # Get top 5 ask levels (sorted ascending)
        top_asks = sorted(self.order_book.asks.items(), key=lambda x: x[0])[:5]
        
        # Display aligned by level
        for i in range(5):
            bid_size = top_bids[i][1] if i < len(top_bids) else ""
            bid_price = f"${top_bids[i][0]:.2f}" if i < len(top_bids) else ""
            ask_price = f"${top_asks[i][0]:.2f}" if i < len(top_asks) else ""
            ask_size = top_asks[i][1] if i < len(top_asks) else ""
            
            self.orderbook_tree.insert('', 'end', values=(bid_size, bid_price, ask_price, ask_size))
            
    def update_order_flow_display(self):
        """Update order flow display"""
        # Clear existing items
        for item in self.flow_tree.get_children():
            self.flow_tree.delete(item)
            
        # Show recent order flow (last 20)
        recent_flow = list(self.order_flow_data)[-20:]
        for flow in reversed(recent_flow):
            side_color = 'green' if flow['side'] == 'BUY' else 'red'
            self.flow_tree.insert('', 'end', values=(
                flow['time'],
                flow['side'],
                f"{flow['qty']:,}",
                f"${flow['price']:.2f}",
                flow['type']
            ))
            
    def update_trades_display(self):
        """Update trades display"""
        # Clear existing items
        for item in self.trades_tree.get_children():
            self.trades_tree.delete(item)
            
        # Show recent trades (last 20)
        recent_trades = self.trades[-20:]
        for trade in reversed(recent_trades):
            self.trades_tree.insert('', 'end', values=(
                trade['step'],
                trade['action'],
                f"{trade['quantity']:,}",
                f"${trade['price']:.2f}",
                f"${trade['value']:,.2f}"
            ))
            
    def draw_chart(self):
        """Draw price chart"""
        self.canvas.delete("all")
        
        if len(self.price_history) < 2:
            return
            
        width = self.canvas.winfo_width()
        height = self.canvas.winfo_height()
        
        if width < 10 or height < 10:
            return
            
        # Calculate scaling
        prices = self.price_history[-200:]  # Show last 200 points
        min_price = min(prices) * 0.999
        max_price = max(prices) * 1.001
        price_range = max_price - min_price
        
        # Draw price line
        points = []
        for i, price in enumerate(prices):
            x = (i / (len(prices) - 1)) * width
            y = height - ((price - min_price) / price_range) * height
            points.append(x)
            points.append(y)
            
        if len(points) >= 4:
            self.canvas.create_line(points, fill='blue', width=2)
            
        # Draw bid/ask spread area
        if len(self.bid_history) >= len(prices) and len(self.ask_history) >= len(prices):
            recent_bids = self.bid_history[-len(prices):]
            recent_asks = self.ask_history[-len(prices):]
            
            # Draw bid area (green)
            bid_points = []
            for i, bid in enumerate(recent_bids):
                x = (i / (len(prices) - 1)) * width
                y = height - ((bid - min_price) / price_range) * height
                bid_points.extend([x, y])
                
            if len(bid_points) >= 4:
                self.canvas.create_line(bid_points, fill='lightgreen', width=1)
                
            # Draw ask area (red)
            ask_points = []
            for i, ask in enumerate(recent_asks):
                x = (i / (len(prices) - 1)) * width
                y = height - ((ask - min_price) / price_range) * height
                ask_points.extend([x, y])
                
            if len(ask_points) >= 4:
                self.canvas.create_line(ask_points, fill='lightcoral', width=1)

def main():
    root = tk.Tk()
    app = OrderFlowSimulation(root)
    root.mainloop()

if __name__ == "__main__":
    main()