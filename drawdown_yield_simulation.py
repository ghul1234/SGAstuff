"""
QuantConnect Drawdown Yield Simulation
Simulates the 1.6% drawdown yield event with volatility modeling
"""

from AlgorithmImports import *

class DrawdownYieldSimulation(QCAlgorithm):
    def Initialize(self):
        # Set start date and cash
        self.SetStartDate(2024, 1, 1)
        self.SetEndDate(2024, 12, 31)
        self.SetCash(1000000)
        
        # Add ES (E-mini S&P 500 Futures) with 10x leverage
        self.sga_symbol = self.AddFuture("ES", Resolution.Minute).Symbol
        self.SetFilter(lambda universe: universe.FrontMonth())
        
        # Set 10x leverage for futures
        self.Securities[self.sga_symbol].SetLeverage(10)
        
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
        
        # Schedule drawdown yield event (random time during simulation)
        self.Schedule.On(self.DateRules.EveryDay(), self.TriggerDrawdownYield)
        
        # Warm up indicators
        self.SetWarmUp(TimeSpan.FromMinutes(30))
        
    def TriggerDrawdownYield(self):
        """Trigger the drawdown yield event at a random time"""
        if not self.drawdown_event_triggered:
            # Schedule for random time during the day (between 10:00 AM and 3:00 PM)
            random_hour = self.Random.Next(10, 15)
            random_minute = self.Random.Next(0, 60)
            
            self.Schedule.On(self.DateRules.EveryDay(), 
                            self.TimeRules.At(random_hour, random_minute), 
                            self.ExecuteDrawdownYield)
    
    def ExecuteDrawdownYield(self):
        """Execute the drawdown yield event"""
        if self.drawdown_event_triggered:
            return
            
        self.drawdown_event_triggered = True
        self.drawdown_timestamp = self.Time
        
        # Get current price before drawdown
        self.pre_drawdown_price = self.Securities[self.sga_symbol].Price
        
        # Calculate ex-dividend adjustment (1.6% drawdown)
        self.ex_dividend_adjustment = self.pre_drawdown_price * self.drawdown_yield_pct
        
        # Apply immediate price drop (ex-dividend effect)
        self.Liquidate(self.sga_symbol)  # Simulate selling pressure
        
        # Increase volatility temporarily after drawdown
        self.current_volatility = self.volatility_baseline * 2.0  # Double volatility
        
        self.Log(f"Drawdown Yield Triggered at {self.Time}")
        self.Log(f"Pre-drawdown price: ${self.pre_drawdown_price:.2f}")
        self.Log(f"Ex-dividend adjustment: ${self.ex_dividend_adjustment:.2f} ({self.drawdown_yield_pct:.1%})")
        self.Log(f"Volatility increased to: {self.current_volatility:.1%}")
    
    def OnData(self, data):
        """Main data handler"""
        if not self.Securities[self.sga_symbol].IsTradeable:
            return
            
        current_price = self.Securities[self.sga_symbol].Price
        
        # Check if we're in the drawdown cooldown period
        if self.drawdown_event_triggered:
            time_since_drawdown = (self.Time - self.drawdown_timestamp).TotalMinutes
            
            if time_since_drawdown < self.drawdown_cooldown_minutes:
                # In cooldown period - prevent short selling
                remaining_minutes = self.drawdown_cooldown_minutes - time_since_drawdown
                self.Log(f"Short selling restricted - {remaining_minutes:.1f} minutes remaining")
                
                # Simulate continued volatility with downward bias
                if self.Random.NextDouble() < 0.3:  # 30% chance of additional downward pressure
                    self.Liquidate(self.sga_symbol)
            else:
                # Cooldown period over - return to normal volatility
                self.current_volatility = self.volatility_baseline
                self.Log(f"Short selling restriction lifted at {self.Time}")
                self.Log(f"Volatility returned to baseline: {self.current_volatility:.1%}")
        
        # Volatility-based trading logic
        self.VolatilityBasedTrading(current_price)
    
    def VolatilityBasedTrading(self, current_price):
        """Execute trading based on volatility regime"""
        # Generate random price movements based on current volatility
        price_change_pct = (self.Random.NextDouble() - 0.5) * 2 * self.current_volatility
        
        # Apply regime-specific logic
        if self.drawdown_event_triggered:
            # Post-drawdown: higher probability of downward moves
            if self.Random.NextDouble() < 0.6:  # 60% downward bias
                price_change_pct = -abs(price_change_pct)
        
        # Calculate new target price
        target_price = current_price * (1 + price_change_pct)
        
        # Execute trade if significant movement
        if abs(price_change_pct) > 0.01:  # 1% threshold
            if price_change_pct > 0:
                self.SetHoldings(self.sga_symbol, self.Portfolio[self.sga_symbol].Quantity + 1)
            else:
                if not (self.drawdown_event_triggered and 
                       (self.Time - self.drawdown_timestamp).TotalMinutes < self.drawdown_cooldown_minutes):
                    self.SetHoldings(self.sga_symbol, self.Portfolio[self.sga_symbol].Quantity - 1)
    
    def OnOrderEvent(self, orderEvent):
        """Handle order events"""
        order = self.Transactions.GetOrderById(orderEvent.OrderId)
        self.Log(f"Order {order.Type} {orderEvent.Status} @ {orderEvent.FillPrice}")
    
    def OnEndOfDay(self):
        """End of day reporting"""
        self.Log(f"End of Day - Portfolio Value: ${self.Portfolio.TotalPortfolioValue:,.2f}")
        if self.drawdown_event_triggered:
            self.Log(f"Drawdown event occurred today - 10-minute short selling restriction was active")
    
    def OnEndOfAlgorithm(self):
        """Algorithm end summary"""
        self.Log("=== SIMULATION SUMMARY ===")
        self.Log(f"Total Return: {self.Portfolio.TotalPortfolioValue / self.Portfolio.StartingCash - 1:.2%}")
        self.Log(f"Drawdown Event Triggered: {self.drawdown_event_triggered}")
        if self.drawdown_event_triggered:
            self.Log(f"Drawdown Time: {self.drawdown_timestamp}")
            self.Log(f"Pre-drawdown Price: ${self.pre_drawdown_price:.2f}")
            self.Log(f"Ex-dividend Adjustment: ${self.ex_dividend_adjustment:.2f}")


# Alternative version with more detailed SGA-specific simulation
# Commented out for now - focus on main ES futures simulation
# 
# class SGADrawdownYieldAdvanced(QCAlgorithm):
#     def Initialize(self):
#         self.SetStartDate(2024, 1, 1)
#         self.SetEndDate(2024, 12, 31)
#         self.SetCash(1000000)
#         
#         # Add multiple ES futures contracts for comprehensive simulation
#         self.sga_indices = []
#         for i in range(10):  # Simulate 10 different SGA entities
#             symbol = self.AddFuture(f"ES", Resolution.Minute).Symbol
#             self.SetFilter(lambda universe: universe.FrontMonth())
#             self.Securities[symbol].SetLeverage(10)
#             self.sga_indices.append(symbol)
#         
#         # Enhanced simulation parameters
#         self.drawdown_yield_pct = 0.016
#         self.base_volatility = 0.05
#         self.current_volatility = 0.05
#         self.drawdown_cooldown_minutes = 10
#         self.drawdown_events = {}  # Track drawdown events per SGA
#         
#         # Liquidity tier factors (as per original logic)
#         self.liquidity_tiers = {
#             'mega': 0.6,      # >$1T GDP: 60% of daily limit
#             'large': 0.8,     # $200B-$1T: 80% of daily limit
#             'mid': 1.0,       # $50B-$200B: baseline
#             'small': 1.3      # <$50B: 130% of daily limit
#         }
#         
#         # Schedule drawdown events
#         self.Schedule.On(self.DateRules.Every(DayOfWeek.Monday), 
#                         self.TimeRules.At(10, 30), 
#                         self.TriggerRandomDrawdown)
#         
#         self.SetWarmUp(TimeSpan.FromMinutes(30))
#     
#     def TriggerRandomDrawdown(self):
#         """Trigger drawdown on random SGA entity"""
#         target_sga = self.Random.Next(0, len(self.sga_indices))
#         symbol = self.sga_indices[target_sga]
#         
#         # Get liquidity tier for this SGA (simulated)
#         gdp_tier = self.Random.Next(0, 4)
#         tier_names = ['mega', 'large', 'mid', 'small']
#         tier = tier_names[gdp_tier]
#         liquidity_factor = self.liquidity_tiers[tier]
#         
#         # Record drawdown event
#         self.drawdown_events[symbol] = {
#             'timestamp': self.Time,
#             'tier': tier,
#             'liquidity_factor': liquidity_factor,
#             'cooldown_end': self.Time + timedelta(minutes=self.drawdown_cooldown_minutes)
#         }
#         
#         self.Log(f"Drawdown triggered on {symbol} (Tier: {tier}, Liquidity Factor: {liquidity_factor})")
#     
#     def OnData(self, data):
#         """Advanced data handler with liquidity tier logic"""
#         for symbol in self.sga_indices:
#             if symbol in self.drawdown_events:
#                 event = self.drawdown_events[symbol]
#                 time_since_drawdown = (self.Time - event['timestamp']).TotalMinutes
#                 
#                 if time_since_drawdown < self.drawdown_cooldown_minutes:
#                     # Apply liquidity-adjusted volatility
#                     adjusted_volatility = self.base_volatility * event['liquidity_factor'] * 2.0
#                     
#                     # Restrict short selling during cooldown
#                     self.Log(f"{symbol}: Short selling restricted ({self.drawdown_cooldown_minutes - time_since_drawdown:.1f} min remaining)")
#                     
#                     # Simulate price impact with liquidity consideration
#                     price_impact = self.CalculatePriceImpact(adjusted_volatility, event['tier'])
#                     
#                 elif time_since_drawdown >= self.drawdown_cooldown_minutes:
#                     # Cooldown over - remove restriction
#                     del self.drawdown_events[symbol]
#                     self.Log(f"{symbol}: Short selling restriction lifted")
#     
#     def CalculatePriceImpact(self, volatility, tier):
#         """Calculate price impact based on volatility and liquidity tier"""
#         # Higher volatility + lower liquidity = higher price impact
#         tier_impact = {
#             'mega': 0.5,    # Large, stable economies - lower impact
#             'large': 0.75,  # Large economies - moderate impact
#             'mid': 1.0,     # Mid-size economies - baseline impact
#             'small': 1.5    # Small economies - higher impact
#         }
#         
#         return volatility * tier_impact[tier]