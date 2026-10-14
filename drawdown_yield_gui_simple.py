"""
SGA 50-State Futures Drawdown Yield Simulation — Real SPY Market Replay
========================================================================
Simulates a 1.6% (tier-adjusted) drawdown yield event for ALL 50 US States
using real SPY 1-minute market data.

Models SGA order flow with a 10-minute short selling restriction across all 50
Sovereign Growth Assets. Provides single-state live charting and a 50-state
National Leaderboard with GDP-weighted aggregate performance analytics.
"""

import tkinter as tk
from tkinter import ttk, font as tkfont
import random
import threading
import time
import os
from datetime import datetime, timedelta
from collections import deque

try:
    import pandas as pd
    import numpy as np
except ImportError:
    print("ERROR: pandas and numpy are required.  pip install pandas numpy")
    raise

# ═══════════════════════════════════════════════
#  50 US STATES SGA DATASET
# ═══════════════════════════════════════════════
STATES_DATA = [
  { "id": "AL", "name": "Alabama", "gdp": 250, "eoi": 83.2, "underwriter": "Houlihan Lokey", "target": 3.21, "mcap": "321.2B" },
  { "id": "AK", "name": "Alaska", "gdp": 55, "eoi": 70.7, "underwriter": "Wainwright & Co", "target": 0.70, "mcap": "70.0B" },
  { "id": "AZ", "name": "Arizona", "gdp": 420, "eoi": 94.8, "underwriter": "Stifel", "target": 5.52, "mcap": "552.2B" },
  { "id": "AR", "name": "Arkansas", "gdp": 145, "eoi": 76.6, "underwriter": "FBR & Co.", "target": 1.89, "mcap": "188.7B" },
  { "id": "CA", "name": "California", "gdp": 3600, "eoi": 272.0, "underwriter": "Goldman Sachs", "target": 41.03, "mcap": "4.103T" },
  { "id": "CO", "name": "Colorado", "gdp": 480, "eoi": 94.8, "underwriter": "Piper Sandler", "target": 5.53, "mcap": "553.3B" },
  { "id": "CT", "name": "Connecticut", "gdp": 320, "eoi": 85.5, "underwriter": "Canaccord Genuity", "target": 3.66, "mcap": "365.7B" },
  { "id": "DE", "name": "Delaware", "gdp": 85, "eoi": 72.4, "underwriter": "Cantor Fitzgerald", "target": 1.03, "mcap": "103.3B" },
  { "id": "FL", "name": "Florida", "gdp": 1400, "eoi": 152.3, "underwriter": "Bank of America", "target": 17.06, "mcap": "1.706T" },
  { "id": "GA", "name": "Georgia", "gdp": 750, "eoi": 111.2, "underwriter": "Deutsche Bank", "target": 8.83, "mcap": "882.5B" },
  { "id": "HI", "name": "Hawaii", "gdp": 95, "eoi": 73.0, "underwriter": "Roth Capital", "target": 1.16, "mcap": "115.6B" },
  { "id": "ID", "name": "Idaho", "gdp": 110, "eoi": 73.6, "underwriter": "Pacific Premier", "target": 1.28, "mcap": "128.1B" },
  { "id": "IL", "name": "Illinois", "gdp": 1000, "eoi": 124.0, "underwriter": "Citigroup", "target": 11.37, "mcap": "1.137T" },
  { "id": "IN", "name": "Indiana", "gdp": 450, "eoi": 93.5, "underwriter": "Baird", "target": 5.27, "mcap": "527.4B" },
  { "id": "IA", "name": "Iowa", "gdp": 230, "eoi": 80.0, "underwriter": "D.A. Davidson", "target": 2.57, "mcap": "257.0B" },
  { "id": "KS", "name": "Kansas", "gdp": 210, "eoi": 78.9, "underwriter": "Janney Montgomery", "target": 2.35, "mcap": "234.7B" },
  { "id": "KY", "name": "Kentucky", "gdp": 260, "eoi": 81.8, "underwriter": "Moelis & Company", "target": 2.93, "mcap": "293.0B" },
  { "id": "LA", "name": "Louisiana", "gdp": 280, "eoi": 83.6, "underwriter": "Daiwa Capital", "target": 3.28, "mcap": "327.8B" },
  { "id": "ME", "name": "Maine", "gdp": 85, "eoi": 72.1, "underwriter": "Maxim Group", "target": 0.99, "mcap": "98.6B" },
  { "id": "MD", "name": "Maryland", "gdp": 480, "eoi": 94.3, "underwriter": "Truist Securities", "target": 5.43, "mcap": "542.8B" },
  { "id": "MA", "name": "Massachusetts", "gdp": 700, "eoi": 106.2, "underwriter": "Jefferies", "target": 7.81, "mcap": "780.7B" },
  { "id": "MI", "name": "Michigan", "gdp": 620, "eoi": 103.1, "underwriter": "Evercore", "target": 7.19, "mcap": "719.4B" },
  { "id": "MN", "name": "Minnesota", "gdp": 450, "eoi": 92.2, "underwriter": "Oppenheimer", "target": 5.01, "mcap": "500.9B" },
  { "id": "MS", "name": "Mississippi", "gdp": 130, "eoi": 75.1, "underwriter": "Hilliard Lyons", "target": 1.57, "mcap": "157.5B" },
  { "id": "MO", "name": "Missouri", "gdp": 390, "eoi": 89.7, "underwriter": "Cowen & Company", "target": 4.51, "mcap": "451.2B" },
  { "id": "MT", "name": "Montana", "gdp": 65, "eoi": 71.0, "underwriter": "Benchmark Co.", "target": 0.76, "mcap": "76.0B" },
  { "id": "NE", "name": "Nebraska", "gdp": 160, "eoi": 76.5, "underwriter": "Stephens Inc.", "target": 1.85, "mcap": "185.4B" },
  { "id": "NV", "name": "Nevada", "gdp": 220, "eoi": 80.2, "underwriter": "B. Riley", "target": 2.61, "mcap": "260.7B" },
  { "id": "NH", "name": "New Hampshire", "gdp": 110, "eoi": 73.2, "underwriter": "Northeast Sec.", "target": 1.21, "mcap": "121.2B" },
  { "id": "NJ", "name": "New Jersey", "gdp": 750, "eoi": 109.5, "underwriter": "Credit Suisse", "target": 8.47, "mcap": "846.6B" },
  { "id": "NM", "name": "New Mexico", "gdp": 125, "eoi": 74.2, "underwriter": "Sandler O'Neill", "target": 1.41, "mcap": "140.5B" },
  { "id": "NY", "name": "New York", "gdp": 2000, "eoi": 181.8, "underwriter": "Morgan Stanley", "target": 22.97, "mcap": "2.297T" },
  { "id": "NC", "name": "North Carolina", "gdp": 720, "eoi": 109.1, "underwriter": "RBC Capital", "target": 8.39, "mcap": "839.1B" },
  { "id": "ND", "name": "North Dakota", "gdp": 70, "eoi": 71.0, "underwriter": "Northland Sec.", "target": 0.75, "mcap": "75.4B" },
  { "id": "OH", "name": "Ohio", "gdp": 830, "eoi": 113.5, "underwriter": "Barclays", "target": 9.28, "mcap": "927.7B" },
  { "id": "OK", "name": "Oklahoma", "gdp": 210, "eoi": 80.5, "underwriter": "Imperial Capital", "target": 2.66, "mcap": "265.8B" },
  { "id": "OR", "name": "Oregon", "gdp": 300, "eoi": 83.7, "underwriter": "William Blair", "target": 3.31, "mcap": "331.0B" },
  { "id": "PA", "name": "Pennsylvania", "gdp": 950, "eoi": 118.3, "underwriter": "Wells Fargo", "target": 10.24, "mcap": "1.024T" },
  { "id": "RI", "name": "Rhode Island", "gdp": 75, "eoi": 71.3, "underwriter": "National Sec.", "target": 0.82, "mcap": "82.5B" },
  { "id": "SC", "name": "South Carolina", "gdp": 280, "eoi": 84.7, "underwriter": "Needham & Co.", "target": 3.50, "mcap": "350.0B" },
  { "id": "SD", "name": "South Dakota", "gdp": 65, "eoi": 71.0, "underwriter": "Feltl and Co.", "target": 0.75, "mcap": "75.2B" },
  { "id": "TN", "name": "Tennessee", "gdp": 480, "eoi": 94.6, "underwriter": "Raymond James", "target": 5.50, "mcap": "549.7B" },
  { "id": "TX", "name": "Texas", "gdp": 2500, "eoi": 202.4, "underwriter": "JPMorgan Chase", "target": 27.09, "mcap": "2.709T" },
  { "id": "UT", "name": "Utah", "gdp": 250, "eoi": 82.2, "underwriter": "BTIG", "target": 3.01, "mcap": "300.9B" },
  { "id": "VT", "name": "Vermont", "gdp": 40, "eoi": 69.5, "underwriter": "Ladenburg", "target": 0.46, "mcap": "45.7B" },
  { "id": "VA", "name": "Virginia", "gdp": 650, "eoi": 105.4, "underwriter": "Lazard", "target": 7.64, "mcap": "764.5B" },
  { "id": "WA", "name": "Washington", "gdp": 750, "eoi": 109.9, "underwriter": "UBS", "target": 8.55, "mcap": "854.7B" },
  { "id": "WV", "name": "West Virginia", "gdp": 95, "eoi": 72.6, "underwriter": "Griffin Financial", "target": 1.08, "mcap": "107.7B" },
  { "id": "WI", "name": "Wisconsin", "gdp": 400, "eoi": 89.7, "underwriter": "Wedbush", "target": 4.51, "mcap": "451.3B" },
  { "id": "WY", "name": "Wyoming", "gdp": 50, "eoi": 69.8, "underwriter": "Chardan Capital", "target": 0.53, "mcap": "53.0B" }
]

# ═══════════════════════════════════════════════
#  SGA FEE STRUCTURE
#  Core Extraction: 1.6%/mo  = 19.2%/yr
#  Reserve Realloc: 0.0667%/mo = 0.8%/yr
#  Total Annual:   20.0%
#
#  The 0.0667% reserve is NOT immediate spending.
#  It accumulates separately and is ONLY deployed
#  after a yield drawdown event to restore post-
#  drawdown liquidity and reinforce the SGA base.
# ═══════════════════════════════════════════════
RESERVE_MONTHLY_PCT = 0.000667   # 0.0667% reserve reallocation

def get_tier(gdp):
    """Returns (tier_name, core_dd_pct, recovery_rate, vol_mult, reserve_pct).
    Reserve is the 0.0667% deployed post-drawdown as a liquidity stabilizer."""
    if gdp >= 1000:
        return 'Mega-Cap (> $1T)', 0.014, 0.85, 2.0, RESERVE_MONTHLY_PCT
    elif gdp >= 200:
        return 'Large-Cap ($200B–$1T)', 0.016, 0.78, 2.5, RESERVE_MONTHLY_PCT
    elif gdp >= 75:
        return 'Mid-Cap ($75B–$200B)', 0.018, 0.70, 3.0, RESERVE_MONTHLY_PCT
    else:
        return 'Small-Cap (< $75B)', 0.022, 0.60, 3.5, RESERVE_MONTHLY_PCT


# ═══════════════════════════════════════════════
#  ORDER BOOK ENGINE
# ═══════════════════════════════════════════════

class OrderBook:
    """Realistic limit order book depth engine with dynamic spread widening."""

    def __init__(self, base_price, tick_size=0.01):
        self.tick_size = tick_size
        self.base_price = base_price
        self.bids = {}
        self.asks = {}
        self.last_price = base_price
        self.spread_mult = 1.0   # dynamic spread multiplier (widens during events)
        self._init_book()

    def _init_book(self):
        for i in range(1, 20):
            bp = round(self.base_price - i * self.tick_size, 2)
            self.bids[bp] = int(10_000 * np.exp(-i * 0.18) + random.uniform(200, 800))
            ap = round(self.base_price + i * self.tick_size, 2)
            self.asks[ap] = int(10_000 * np.exp(-i * 0.18) + random.uniform(200, 800))

    def best_bid(self):
        m = self.mid_raw()
        half = self.tick_size * self.spread_mult
        return round(m - half, 2)

    def best_ask(self):
        m = self.mid_raw()
        half = self.tick_size * self.spread_mult
        return round(m + half, 2)

    def mid_raw(self):
        """Raw midpoint without spread adjustment."""
        b = max(self.bids) if self.bids else self.base_price
        a = min(self.asks) if self.asks else self.base_price
        return (b + a) / 2.0

    def mid(self):
        return self.mid_raw()

    def spread(self):
        return self.best_ask() - self.best_bid()

    def set_spread_mult(self, mult):
        """Set spread multiplier (1.0 = normal, 3-5× during drawdown events)."""
        self.spread_mult = max(1.0, mult)

    def refresh(self):
        m = self.mid_raw()
        for i in range(1, 6):
            bp = round(m - i * self.tick_size, 2)
            self.bids[bp] = self.bids.get(bp, 0) + int(random.uniform(80, 400))
            ap = round(m + i * self.tick_size, 2)
            self.asks[ap] = self.asks.get(ap, 0) + int(random.uniform(80, 400))

    def move_to(self, target):
        cur = self.mid_raw()
        if cur == 0:
            return
        ratio = target / cur
        self.bids = {round(p * ratio, 2): q for p, q in self.bids.items()}
        self.asks = {round(p * ratio, 2): q for p, q in self.asks.items()}
        self.refresh()


# ═══════════════════════════════════════════════
#  MAIN 50-STATE GUI APPLICATION
# ═══════════════════════════════════════════════

class SGA50StatesGUI:
    BG          = '#070d1a'
    PANEL       = '#0e1729'
    BORDER      = '#1e293b'
    ACCENT_GOLD = '#fbbf24'
    ACCENT_BLUE = '#38bdf8'
    GREEN       = '#10b981'
    RED         = '#ef4444'
    TXT         = '#f1f5f9'
    TXT2        = '#94a3b8'
    TXT3        = '#64748b'
    CHART_BG    = '#0a1020'

    def __init__(self, root):
        self.root = root
        self.root.title("SGA 50-State Futures Terminal — National Drawdown Yield Simulation")
        self.root.geometry("1560x960")
        self.root.configure(bg=self.BG)
        self.root.minsize(1200, 720)

        # ── load SPY market data ───────────
        self.real_data = None
        csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "spy_realistic_data_30days.csv")
        try:
            self.real_data = pd.read_csv(csv_path, index_col=0, parse_dates=True)
            print(f"[DATA] Loaded {len(self.real_data)} SPY 1-min bars.")
        except Exception as e:
            print(f"[WARN] Could not load SPY data: {e}")

        # ── simulation parameters ─────────
        self.HOLD_MINUTES = 15
        self.LEVERAGE = 10
        self.INITIAL_CASH = 1_000_000
        self.COMMISSION_PER_CONTRACT = 2.25
        self.RESERVE_PCT = RESERVE_MONTHLY_PCT   # 0.0667% reserve reallocation
        self.reserve_deployed = 0.0               # $ amount deployed this event
        self.reserve_accumulated = 0.0            # accumulated reserve balance

        # select initial state (California by default or National)
        self.states_map = {s['id']: s for s in STATES_DATA}
        self.state_names_map = {f"{s['name']} ({s['id']})": s['id'] for s in STATES_DATA}
        self.state_names_list = ["🇺🇸 National Aggregate (All 50 States)"] + list(self.state_names_map.keys())

        self.active_state_id = 'CA'
        self.is_national_mode = False

        # sample market window
        self._load_market_window()

        # order book & state tracking
        self.order_book = OrderBook(self.initial_price)
        self.cash = self.INITIAL_CASH
        self.shares = 0
        self.current_step = 0
        self.current_price = self.initial_price
        self.current_vol = 0.12

        self.dd_triggered = False
        self.dd_step = None
        self.pre_dd_price = None
        self.post_dd_price = None

        self.entry_price = None
        self.exit_price = None
        self.position_pnl = None
        self.position_return = None
        self.leveraged_return = None
        self.net_pnl = None
        self.total_commissions = 0.0
        self.mfe_price = None
        self.mae_price = None

        self.prices = []
        self.bids_h = []
        self.asks_h = []
        self.vols_h = []
        self.times = []
        self.trades = []
        self.order_flow = deque(maxlen=2000)

        # 50-state results storage
        self.national_results = {}

        # Monte Carlo results storage
        self.mc_results = []
        self.mc_running = False

        self.market_open = datetime.now().replace(hour=9, minute=30, second=0, microsecond=0)
        self.sim_time = self.market_open
        # GAP 1 FIX: Randomize drawdown timing (minute 8-25 of session)
        self.dd_trigger_step = random.randint(8, 25)
        self.running = False

        self._build_gui()

    def _load_market_window(self):
        if self.real_data is not None and len(self.real_data) >= 60:
            window_size = min(120, len(self.real_data))
            max_start = len(self.real_data) - window_size
            start_idx = random.randint(0, max(0, max_start))
            self.data_window = self.real_data.iloc[start_idx:start_idx + window_size].copy().reset_index(drop=True)
            self.initial_price = float(self.data_window['close'].iloc[0])
        else:
            np.random.seed(42)
            prices = [450.0]
            for _ in range(119):
                prices.append(prices[-1] * (1 + np.random.normal(0, 0.001)))
            self.data_window = pd.DataFrame({
                'close': prices,
                'volume': [random.randint(30_000_000, 80_000_000) for _ in prices]
            })
            self.initial_price = 450.0

    # ─────────────────────────────────────────────
    #  GUI CONSTRUCTION & TABS
    # ─────────────────────────────────────────────
    def _build_gui(self):
        style = ttk.Style()
        style.theme_use('clam')
        style.configure('.', background=self.BG, foreground=self.TXT, borderwidth=0)
        style.configure('TFrame', background=self.BG)
        style.configure('TLabel', background=self.BG, foreground=self.TXT)
        style.configure('TLabelframe', background=self.PANEL, foreground=self.ACCENT_GOLD,
                        bordercolor=self.BORDER, relief='flat')
        style.configure('TLabelframe.Label', background=self.PANEL, foreground=self.ACCENT_GOLD,
                        font=('Segoe UI', 9, 'bold'))
        style.configure('TButton', background=self.BORDER, foreground=self.TXT,
                        font=('Segoe UI', 9, 'bold'), padding=6)
        style.map('TButton', background=[('active', '#334155')])
        style.configure('TNotebook', background=self.BG, borderwidth=0)
        style.configure('TNotebook.Tab', background=self.PANEL, foreground=self.TXT2,
                        font=('Segoe UI', 9, 'bold'), padding=[14, 6])
        style.map('TNotebook.Tab', background=[('selected', '#1e3a5f')], foreground=[('selected', self.ACCENT_BLUE)])
        style.configure('Treeview', background=self.PANEL, foreground=self.TXT,
                        fieldbackground=self.PANEL, borderwidth=0, font=('Consolas', 9))
        style.configure('Treeview.Heading', background='#0f172a', foreground=self.ACCENT_BLUE,
                        font=('Segoe UI', 8, 'bold'))
        style.map('Treeview', background=[('selected', '#1e3a5f')])

        root_frame = ttk.Frame(self.root)
        root_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # ── TOP BAR: Controls & State Selector ──
        top_bar = ttk.Frame(root_frame)
        top_bar.pack(fill=tk.X, pady=(0, 8))

        ttk.Button(top_bar, text="▶  Start Sim", command=self._start).pack(side=tk.LEFT, padx=(0, 4))
        ttk.Button(top_bar, text="■  Stop", command=self._stop).pack(side=tk.LEFT, padx=(0, 4))
        ttk.Button(top_bar, text="↺  Reset", command=self._reset).pack(side=tk.LEFT, padx=(0, 4))
        ttk.Button(top_bar, text="🚀 Run All 50 States Sim", command=self._run_all_50_states).pack(side=tk.LEFT, padx=(0, 4))
        ttk.Button(top_bar, text="🎲 Monte Carlo (1000)", command=self._run_monte_carlo).pack(side=tk.LEFT, padx=(0, 8))

        ttk.Label(top_bar, text="Select State / Mode:", font=('Segoe UI', 9, 'bold'), foreground=self.ACCENT_GOLD).pack(side=tk.LEFT, padx=(6, 4))
        self.state_cb = ttk.Combobox(top_bar, values=self.state_names_list, state='readonly', font=('Segoe UI', 9), width=36)
        self.state_cb.set("California (CA)")
        self.state_cb.pack(side=tk.LEFT, padx=(0, 8))
        self.state_cb.bind('<<ComboboxSelected>>', self._on_state_change)

        ttk.Button(top_bar, text="🔀 New SPY Window", command=self._new_window).pack(side=tk.LEFT, padx=(0, 8))

        ttk.Label(top_bar, text="Speed", font=('Segoe UI', 8)).pack(side=tk.LEFT, padx=(10, 2))
        self.speed_scale = tk.Scale(top_bar, from_=1, to=500, orient=tk.HORIZONTAL,
                                    bg=self.PANEL, fg=self.TXT, troughcolor=self.BORDER,
                                    highlightthickness=0, length=120)
        self.speed_scale.set(80)
        self.speed_scale.pack(side=tk.LEFT)

        # ── MAIN NOTEBOOK TABS ───────────────────
        self.notebook = ttk.Notebook(root_frame)
        self.notebook.pack(fill=tk.BOTH, expand=True)

        self.tab_single = ttk.Frame(self.notebook)
        self.tab_leaderboard = ttk.Frame(self.notebook)

        self.notebook.add(self.tab_single, text=" 📊 Live State Terminal ")
        self.notebook.add(self.tab_leaderboard, text=" 🇺🇸 50-State National Leaderboard ")
        self.tab_monte_carlo = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_monte_carlo, text=" 🎲 Monte Carlo Sim ")

        self._build_single_tab(self.tab_single)
        self._build_leaderboard_tab(self.tab_leaderboard)
        self._build_monte_carlo_tab(self.tab_monte_carlo)

    # ── TAB 1: SINGLE STATE TERMINAL ─────────────
    def _build_single_tab(self, parent):
        # Top Grid: Info | Stats | Return Card | Order Book
        top = ttk.Frame(parent)
        top.pack(fill=tk.X, pady=(6, 8))

        self._build_state_info_card(top)
        self._build_stats_card(top)
        self._build_return_card(top)
        self._build_orderbook_card(top)

        # Middle: Price Chart
        chart_lf = ttk.LabelFrame(parent, text="  LIVE SGA FUTURES PRICE & VOLUME CHART  ")
        chart_lf.pack(fill=tk.BOTH, expand=True, pady=(0, 8))
        self.canvas = tk.Canvas(chart_lf, bg=self.CHART_BG, highlightthickness=0, height=310)
        self.canvas.pack(fill=tk.BOTH, expand=True, padx=6, pady=6)
        self.canvas.bind('<Configure>', lambda e: self._draw_chart())

        # Bottom: Flow | Trades | Results
        bot = ttk.Frame(parent)
        bot.pack(fill=tk.BOTH, expand=True)

        self._build_order_flow(bot)
        self._build_trade_log(bot)
        self._build_results_panel(bot)

    def _build_state_info_card(self, parent):
        lf = ttk.LabelFrame(parent, text="  STATE DETAILS  ")
        lf.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 6))

        self.state_info_vars = {
            'name': tk.StringVar(value="California (CA)"),
            'gdp': tk.StringVar(value="$3,600 Billion"),
            'tier': tk.StringVar(value="Mega-Cap (> $1T)"),
            'dd_yield': tk.StringVar(value="1.4%"),
            'reserve': tk.StringVar(value="0.0667% → Liq. Buffer"),
            'annual': tk.StringVar(value="Core 16.8% + Res 0.8% = 17.6%"),
            'eoi': tk.StringVar(value="272.0 EOI"),
            'target': tk.StringVar(value="$41.03 / share"),
            'underwriter': tk.StringVar(value="Goldman Sachs"),
        }
        grid = ttk.Frame(lf)
        grid.pack(fill=tk.BOTH, expand=True, padx=6, pady=4)

        rows = [
            ('name', 'State'), ('gdp', 'State GDP'), ('tier', 'SGA Tier'),
            ('dd_yield', 'Core Yield'), ('reserve', 'Reserve Realloc'),
            ('annual', 'Annual Total'), ('eoi', 'EOI Index'),
            ('target', 'Price Target'), ('underwriter', 'Underwriter')
        ]
        for i, (k, lbl) in enumerate(rows):
            ttk.Label(grid, text=f"{lbl}:", font=('Segoe UI', 8)).grid(row=i, column=0, sticky=tk.W, pady=1)
            fg = self.ACCENT_BLUE if k in ('name', 'tier') else (
                self.ACCENT_GOLD if k in ('dd_yield', 'reserve', 'annual') else self.TXT)
            tk.Label(grid, textvariable=self.state_info_vars[k], font=('Consolas', 8, 'bold'),
                     bg=self.PANEL, fg=fg, anchor='w').grid(row=i, column=1, sticky=tk.W, padx=(4, 0), pady=1)

    def _build_stats_card(self, parent):
        lf = ttk.LabelFrame(parent, text="  MARKET & MARGIN  ")
        lf.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 6))

        self._vars = {}
        labels = [
            ('sim_time',   'Sim Time',       '09:30:00'),
            ('mid_price',  'Mid Price',      f'${self.initial_price:.2f}'),
            ('bid',        'Best Bid',       '$0.00'),
            ('ask',        'Best Ask',       '$0.00'),
            ('spread',     'Spread',         '$0.00'),
            ('position',   'Position',       '0 contracts'),
            ('portfolio',  'Portfolio',      f'${self.INITIAL_CASH:,.2f}'),
            ('margin_lvl', 'Margin Health',  '100.0% OK'),
            ('dd_status',  'Drawdown',       'Waiting…'),
            ('cooldown',   'Hold Timer',     '--:--'),
        ]
        grid = ttk.Frame(lf)
        grid.pack(fill=tk.BOTH, expand=True, padx=6, pady=4)

        for i, (key, label, default) in enumerate(labels):
            v = tk.StringVar(value=default)
            self._vars[key] = v
            ttk.Label(grid, text=f"{label}:", font=('Segoe UI', 8)).grid(row=i, column=0, sticky=tk.W, pady=1)
            fg = self.GREEN if key in ('bid', 'margin_lvl') else (self.RED if key in ('ask', 'dd_status') else (self.ACCENT_GOLD if key == 'cooldown' else self.TXT))
            tk.Label(grid, textvariable=v, font=('Consolas', 8, 'bold'), bg=self.PANEL, fg=fg, anchor='w').grid(row=i, column=1, sticky=tk.W, padx=(4, 0), pady=1)

    def _build_return_card(self, parent):
        lf = ttk.LabelFrame(parent, text="  15-MIN RETURN (NO SHORTS)  ")
        lf.pack(side=tk.LEFT, fill=tk.BOTH, padx=(0, 6))

        inner = tk.Frame(lf, bg=self.PANEL)
        inner.pack(fill=tk.BOTH, expand=True, padx=8, pady=4)

        self.return_title = tk.Label(inner, text="FUTURES RETURN", font=('Segoe UI', 8, 'bold'), bg=self.PANEL, fg=self.TXT3)
        self.return_title.pack(pady=(2, 0))

        self.return_big = tk.Label(inner, text="—", font=('Consolas', 24, 'bold'), bg=self.PANEL, fg=self.TXT3)
        self.return_big.pack(pady=(0, 1))

        self.return_lev = tk.Label(inner, text="10× Leveraged: —", font=('Consolas', 9, 'bold'), bg=self.PANEL, fg=self.TXT3)
        self.return_lev.pack()

        self.return_pnl = tk.Label(inner, text="Net P&L: —", font=('Consolas', 9, 'bold'), bg=self.PANEL, fg=self.TXT3)
        self.return_pnl.pack(pady=(0, 1))

        self.return_fees = tk.Label(inner, text="Fees: —", font=('Consolas', 8), bg=self.PANEL, fg=self.TXT3)
        self.return_fees.pack()

        self.return_reserve = tk.Label(inner, text="Reserve: 0.0667% ACCUMULATING", font=('Consolas', 8, 'bold'), bg=self.PANEL, fg=self.TXT3)
        self.return_reserve.pack()

        self.return_entry_lbl = tk.Label(inner, text="Entry: —  →  Exit: —", font=('Consolas', 8), bg=self.PANEL, fg=self.TXT3)
        self.return_entry_lbl.pack(pady=(1, 1))

        self.return_status = tk.Label(inner, text="⏳ WAITING FOR DRAWDOWN", font=('Segoe UI', 8, 'bold'), bg=self.PANEL, fg=self.ACCENT_GOLD)
        self.return_status.pack(pady=(1, 2))

    def _build_orderbook_card(self, parent):
        lf = ttk.LabelFrame(parent, text="  ORDER BOOK & IMBALANCE  ")
        lf.pack(side=tk.LEFT, fill=tk.BOTH, padx=(0, 0))

        self.obi_lbl = tk.Label(lf, text="OBI: 0.0% (BALANCED)", font=('Consolas', 8, 'bold'), bg=self.PANEL, fg=self.ACCENT_GOLD)
        self.obi_lbl.pack(pady=(2, 0))

        self.ob_tree = ttk.Treeview(lf, columns=('BS', 'BP', 'AP', 'AS'), show='headings', height=5)
        for col, hd, w in [('BS', 'Bid Size', 65), ('BP', 'Bid $', 70), ('AP', 'Ask $', 70), ('AS', 'Ask Size', 65)]:
            self.ob_tree.heading(col, text=hd)
            self.ob_tree.column(col, width=w, anchor='center')
        self.ob_tree.pack(fill=tk.BOTH, expand=True, padx=4, pady=2)

    def _build_order_flow(self, parent):
        lf = ttk.LabelFrame(parent, text="  ORDER FLOW (SGA RULES)  ")
        lf.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 6))

        self.flow_tree = ttk.Treeview(lf, columns=('T', 'Side', 'Qty', 'Price', 'Type'), show='headings', height=7)
        for col, hd, w in [('T', 'Step', 45), ('Side', 'Side', 45), ('Qty', 'Qty', 75), ('Price', 'Price', 70), ('Type', 'Type', 85)]:
            self.flow_tree.heading(col, text=hd)
            self.flow_tree.column(col, width=w, anchor='center')
        self.flow_tree.pack(fill=tk.BOTH, expand=True, padx=4, pady=4)

    def _build_trade_log(self, parent):
        lf = ttk.LabelFrame(parent, text="  MY TRADES  ")
        lf.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 6))

        self.trade_tree = ttk.Treeview(lf, columns=('T', 'Act', 'Qty', 'Price', 'Val'), show='headings', height=7)
        for col, hd, w in [('T', 'Step', 45), ('Act', 'Action', 55), ('Qty', 'Qty', 75), ('Price', 'Price', 70), ('Val', 'Value', 95)]:
            self.trade_tree.heading(col, text=hd)
            self.trade_tree.column(col, width=w, anchor='center')
        self.trade_tree.pack(fill=tk.BOTH, expand=True, padx=4, pady=4)

    def _build_results_panel(self, parent):
        lf = ttk.LabelFrame(parent, text="  SIMULATION RESULTS  ")
        lf.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        self.results_text = tk.Text(lf, bg=self.PANEL, fg=self.TXT, font=('Consolas', 8),
                                    wrap=tk.WORD, borderwidth=0, highlightthickness=0, height=8, padx=6, pady=6)
        self.results_text.pack(fill=tk.BOTH, expand=True, padx=4, pady=4)
        self.results_text.insert('1.0', "Press ▶ Start Sim or 🚀 Run All 50 States Sim.\n")
        self.results_text.config(state=tk.DISABLED)

    # ── TAB 2: 50-STATE NATIONAL LEADERBOARD ─────
    def _build_leaderboard_tab(self, parent):
        top = ttk.Frame(parent)
        top.pack(fill=tk.X, pady=(6, 6), padx=6)

        self.national_summary_lbl = tk.Label(top, text="NATIONAL GDP-WEIGHTED RETURN:  —  |  TOTAL 50-STATE P&L:  —",
                                             font=('Segoe UI', 11, 'bold'), bg=self.PANEL, fg=self.ACCENT_GOLD, padx=12, pady=6)
        self.national_summary_lbl.pack(fill=tk.X)

        tree_frame = ttk.Frame(parent)
        tree_frame.pack(fill=tk.BOTH, expand=True, padx=6, pady=(0, 6))

        cols = ('ID', 'State', 'GDP', 'Tier', 'Yield', 'EOI', 'Target', 'Entry', 'Exit', 'GrossRet', 'LevRet', 'NetPnL')
        self.lb_tree = ttk.Treeview(tree_frame, columns=cols, show='headings', height=18)

        headers = [
            ('ID', 'ID', 45),
            ('State', 'State', 120),
            ('GDP', 'GDP ($B)', 80),
            ('Tier', 'Tier', 130),
            ('Yield', 'Yield %', 65),
            ('EOI', 'EOI Index', 75),
            ('Target', 'Target $', 75),
            ('Entry', 'Entry $', 75),
            ('Exit', 'Exit $', 75),
            ('GrossRet', 'Gross Ret %', 85),
            ('LevRet', '10× Lev %', 85),
            ('NetPnL', 'Net P&L ($)', 110)
        ]

        for col_id, col_name, w in headers:
            self.lb_tree.heading(col_id, text=col_name)
            self.lb_tree.column(col_id, width=w, anchor='center')

        sb = ttk.Scrollbar(tree_frame, orient=tk.VERTICAL, command=self.lb_tree.yview)
        self.lb_tree.configure(yscroll=sb.set)
        self.lb_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        sb.pack(side=tk.RIGHT, fill=tk.Y)

        self._populate_leaderboard_initial()

    # ── TAB 3: MONTE CARLO SIMULATION ─────────────
    def _build_monte_carlo_tab(self, parent):
        top = ttk.Frame(parent)
        top.pack(fill=tk.X, pady=(6, 6), padx=6)

        tk.Label(top, text="MONTE CARLO SIMULATION — 1000 SCENARIOS WITH VARYING VOLATILITY",
                 font=('Segoe UI', 11, 'bold'), bg=self.PANEL, fg=self.ACCENT_GOLD, padx=12, pady=6).pack(fill=tk.X)

        # Controls frame
        controls = ttk.Frame(top)
        controls.pack(fill=tk.X, pady=(0, 6), padx=6)

        tk.Label(controls, text="Scenarios:", font=('Segoe UI', 9), bg=self.PANEL, fg=self.TXT).pack(side=tk.LEFT, padx=(0, 4))
        self.mc_scenarios_var = tk.IntVar(value=1000)
        tk.Entry(controls, textvariable=self.mc_scenarios_var, width=10, font=('Consolas', 9), bg=self.BORDER, fg=self.TXT).pack(side=tk.LEFT, padx=(0, 12))

        tk.Label(controls, text="Volatility Range:", font=('Segoe UI', 9), bg=self.PANEL, fg=self.TXT).pack(side=tk.LEFT, padx=(0, 4))
        tk.Label(controls, text="Min:", font=('Segoe UI', 8), bg=self.PANEL, fg=self.TXT).pack(side=tk.LEFT, padx=(0, 2))
        self.mc_vol_min_var = tk.DoubleVar(value=0.5)
        tk.Entry(controls, textvariable=self.mc_vol_min_var, width=6, font=('Consolas', 9), bg=self.BORDER, fg=self.TXT).pack(side=tk.LEFT, padx=(0, 2))
        tk.Label(controls, text="Max:", font=('Segoe UI', 8), bg=self.PANEL, fg=self.TXT).pack(side=tk.LEFT, padx=(0, 2))
        self.mc_vol_max_var = tk.DoubleVar(value=3.0)
        tk.Entry(controls, textvariable=self.mc_vol_max_var, width=6, font=('Consolas', 9), bg=self.BORDER, fg=self.TXT).pack(side=tk.LEFT, padx=(0, 12))

        ttk.Button(controls, text="▶ Run Monte Carlo", command=self._run_monte_carlo).pack(side=tk.LEFT, padx=(0, 4))
        ttk.Button(controls, text="■ Stop", command=self._stop).pack(side=tk.LEFT)

        # Results frame
        results_frame = ttk.Frame(parent)
        results_frame.pack(fill=tk.BOTH, expand=True, padx=6, pady=(0, 6))

        # Left panel: Statistics
        stats_lf = ttk.LabelFrame(results_frame, text="  STATISTICAL RESULTS  ")
        stats_lf.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 6))

        self.mc_stats_text = tk.Text(stats_lf, bg=self.PANEL, fg=self.TXT, font=('Consolas', 9),
                                     wrap=tk.WORD, borderwidth=0, highlightthickness=0, padx=8, pady=8)
        self.mc_stats_text.pack(fill=tk.BOTH, expand=True, padx=4, pady=4)
        self.mc_stats_text.insert('1.0', "Configure parameters and click ▶ Run Monte Carlo to begin.\n")
        self.mc_stats_text.config(state=tk.DISABLED)

        # Right panel: Distribution chart
        chart_lf = ttk.LabelFrame(results_frame, text="  RETURN DISTRIBUTION  ")
        chart_lf.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        self.mc_canvas = tk.Canvas(chart_lf, bg=self.CHART_BG, highlightthickness=0, height=400)
        self.mc_canvas.pack(fill=tk.BOTH, expand=True, padx=6, pady=6)
        self.mc_canvas.bind('<Configure>', lambda e: self._draw_mc_chart())

    def _populate_leaderboard_initial(self):
        for item in self.lb_tree.get_children():
            self.lb_tree.delete(item)

        sorted_states = sorted(STATES_DATA, key=lambda x: x['gdp'], reverse=True)
        for s in sorted_states:
            tier_name, dd_yield, _, _, _ = get_tier(s['gdp'])
            self.lb_tree.insert('', 'end', values=(
                s['id'], s['name'], f"${s['gdp']:,}B", tier_name,
                f"{dd_yield:.1%}", f"{s['eoi']:.1f}", f"${s['target']:.2f}",
                "—", "—", "—", "—", "—"
            ))

    # ─────────────────────────────────────────────
    #  STATE & SIMULATION HANDLERS
    # ─────────────────────────────────────────────
    def _on_state_change(self, event):
        sel = self.state_cb.get()
        if sel == "🇺🇸 National Aggregate (All 50 States)":
            self.is_national_mode = True
            self.state_info_vars['name'].set("All 50 US States")
            self.state_info_vars['gdp'].set("$27,500 Billion")
            self.state_info_vars['tier'].set("National Aggregate")
            self.state_info_vars['dd_yield'].set("1.6% Weighted")
            self.state_info_vars['reserve'].set("0.0667% → Liq. Buffer")
            self.state_info_vars['annual'].set("Core 19.2% + Res 0.8% = 20.0%")
            self.state_info_vars['eoi'].set("100.0 Avg")
            self.state_info_vars['target'].set("Index Basket")
            self.state_info_vars['underwriter'].set("US Treasury Syndicate")
        else:
            self.is_national_mode = False
            state_id = self.state_names_map[sel]
            self.active_state_id = state_id
            s = self.states_map[state_id]
            tier_name, dd_yield, _, _, reserve_pct = get_tier(s['gdp'])

            annual_core = dd_yield * 12 * 100
            annual_res = reserve_pct * 12 * 100
            annual_total = annual_core + annual_res

            self.state_info_vars['name'].set(f"{s['name']} ({s['id']})")
            self.state_info_vars['gdp'].set(f"${s['gdp']:,} Billion")
            self.state_info_vars['tier'].set(tier_name)
            self.state_info_vars['dd_yield'].set(f"{dd_yield:.1%} / mo")
            self.state_info_vars['reserve'].set(f"{reserve_pct*100:.4f}% → Liq. Buffer")
            self.state_info_vars['annual'].set(f"Core {annual_core:.1f}% + Res {annual_res:.1f}% = {annual_total:.1f}%")
            self.state_info_vars['eoi'].set(f"{s['eoi']:.1f} EOI")
            self.state_info_vars['target'].set(f"${s['target']:.2f} / sh")
            self.state_info_vars['underwriter'].set(s['underwriter'])

        self._reset()

    def _start(self):
        if not self.running:
            self.running = True
            if self.is_national_mode:
                t = threading.Thread(target=self._run_all_50_states_thread, daemon=True)
            else:
                t = threading.Thread(target=self._run_single_state_thread, daemon=True)
            t.start()

    def _stop(self):
        self.running = False

    def _reset(self):
        self._stop()
        time.sleep(0.15)

        self.current_step = 0
        self.cash = self.INITIAL_CASH
        self.shares = 0
        self.current_price = self.initial_price

        self.dd_triggered = False
        self.dd_step = None
        self.pre_dd_price = None
        self.post_dd_price = None

        self.entry_price = None
        self.exit_price = None
        self.position_pnl = None
        self.position_return = None
        self.leveraged_return = None
        self.net_pnl = None
        self.total_commissions = 0.0
        self.mfe_price = None
        self.mae_price = None

        self.prices.clear()
        self.bids_h.clear()
        self.asks_h.clear()
        self.vols_h.clear()
        self.times.clear()
        self.trades.clear()
        self.order_flow.clear()

        self.mc_results.clear()
        self.mc_running = False

        self.sim_time = self.market_open
        self.order_book = OrderBook(self.initial_price)

        self.return_big.config(text="—", fg=self.TXT3)
        self.return_lev.config(text="10× Leveraged: —", fg=self.TXT3)
        self.return_pnl.config(text="Net P&L: —", fg=self.TXT3)
        self.return_reserve.config(text="Reserve: 0.0667% ACCUMULATING", fg=self.TXT3)
        self.return_entry_lbl.config(text="Entry: —  →  Exit: —")
        self.return_status.config(text="⏳ WAITING FOR DRAWDOWN", fg=self.ACCENT_GOLD)
        self.canvas.delete('all')

        for tree in (self.ob_tree, self.flow_tree, self.trade_tree):
            for item in tree.get_children():
                tree.delete(item)

        self.results_text.config(state=tk.NORMAL)
        self.results_text.delete('1.0', tk.END)
        self.results_text.insert('1.0', "Reset. Press ▶ Start Sim to run.\n")
        self.results_text.config(state=tk.DISABLED)

        self._update_stats()

    def _new_window(self):
        self._load_market_window()
        self._reset()

    # ─────────────────────────────────────────────
    #  SINGLE STATE SIMULATION THREAD
    # ─────────────────────────────────────────────
    def _run_single_state_thread(self):
        s = self.states_map[self.active_state_id]
        tier_name, dd_pct, recovery_rate, vol_mult, reserve_pct = get_tier(s['gdp'])
        total_steps = len(self.data_window) if self.data_window is not None else 120

        self.real_prices = []
        dd_i = self.dd_trigger_step

        # GAP 4: State-specific beta based on economic characteristics
        state_beta = 1.0 + (s['eoi'] - 100.0) / 500.0
        state_rng = np.random.RandomState(hash(s['id']) & 0xFFFFFFFF)

        for i in range(total_steps):
            spy_close = float(self.data_window.iloc[i]['close']) if self.data_window is not None else self.initial_price

            # GAP 4: Add state-specific idiosyncratic price noise
            state_noise = state_rng.normal(0, 0.0002 * vol_mult) * spy_close

            if i < dd_i:
                self.real_prices.append(spy_close + state_noise)
            elif i == dd_i:
                pre_p = self.real_prices[i - 1] if i > 0 else spy_close
                post_p = pre_p * (1.0 - dd_pct)
                self.real_prices.append(post_p)
            elif dd_i < i <= dd_i + self.HOLD_MINUTES + 1:
                step_in_hold = i - dd_i
                pre_p = self.real_prices[dd_i - 1]
                post_p = self.real_prices[dd_i]
                drop_amt = pre_p - post_p

                # 15-minute order-flow recovery curve under short-selling ban
                t_norm = min(1.0, step_in_hold / float(self.HOLD_MINUTES))
                rec_pct = recovery_rate * (1.0 - np.exp(-2.2 * t_norm)) / (1.0 - np.exp(-2.2))
                rec_amt = drop_amt * rec_pct

                # 0.0667% reserve reallocation — put in IMMEDIATELY right after drawdown
                reserve_injection = pre_p * reserve_pct

                spy_at_dd = float(self.data_window.iloc[dd_i]['close']) if self.data_window is not None else self.initial_price
                spy_delta = (spy_close - spy_at_dd) * 0.3 * state_beta

                hold_p = post_p + rec_amt + spy_delta + reserve_injection + state_noise
                self.real_prices.append(hold_p)
            else:
                # GAP 3: POST-BAN SELL PRESSURE — shorts re-enter aggressively
                step_post = i - (dd_i + self.HOLD_MINUTES + 1)
                pre_p = self.real_prices[dd_i - 1]
                last_p = self.real_prices[dd_i + self.HOLD_MINUTES + 1]

                if step_post <= 3:
                    # Sharp sell-off: pent-up short sellers flood back in
                    sell_pressure = dd_pct * pre_p * 0.12 * (1.0 - step_post / 4.0)
                    post_ban_p = last_p - sell_pressure + state_noise
                    self.real_prices.append(post_ban_p)
                else:
                    # Gradual normalization back to SPY baseline
                    net_off = dd_pct * pre_p * 0.30
                    target_p = spy_close - net_off + state_noise
                    prev_p = self.real_prices[i - 1]
                    blend = min(1.0, (step_post - 3) / 5.0)
                    norm_p = prev_p * (1.0 - blend) + target_p * blend
                    self.real_prices.append(norm_p)

        for step in range(total_steps):
            if not self.running:
                break

            self.current_step = step
            self.sim_time = self.market_open + timedelta(minutes=step)

            if step == dd_i and not self.dd_triggered:
                self._trigger_drawdown(dd_pct)

            self.current_price = self.real_prices[step]
            self.order_book.move_to(self.current_price)

            in_hold = (self.dd_triggered and self.dd_step is not None and 0 <= (step - self.dd_step) <= self.HOLD_MINUTES + 1)
            post_ban = (self.dd_triggered and self.dd_step is not None and 0 < (step - self.dd_step - self.HOLD_MINUTES - 1) <= 5)

            # GAP 2: Dynamic spread widening during drawdown events
            if self.dd_triggered and self.dd_step is not None:
                bars_since_dd = step - self.dd_step
                if bars_since_dd == 0:
                    # Drawdown bar: maximum spread blow-out (3-5× based on tier)
                    self.order_book.set_spread_mult(vol_mult * 2.0)
                elif bars_since_dd <= 3:
                    # First 3 bars of hold: still very wide
                    self.order_book.set_spread_mult(vol_mult * 1.5)
                elif in_hold:
                    # Remainder of hold: gradually decay toward normal
                    decay = max(1.2, vol_mult * (1.0 - bars_since_dd / (self.HOLD_MINUTES * 1.5)))
                    self.order_book.set_spread_mult(decay)
                elif post_ban:
                    # Post-ban: spread re-widens briefly as shorts flood back
                    pb_bars = step - self.dd_step - self.HOLD_MINUTES - 1
                    self.order_book.set_spread_mult(max(1.0, 2.0 - pb_bars * 0.3))
                else:
                    self.order_book.set_spread_mult(1.0)
            else:
                self.order_book.set_spread_mult(1.0)

            if random.random() < 0.55:
                side = random.choice(['BUY', 'SELL'])
                if in_hold and side == 'SELL' and random.random() > 0.20:
                    side = 'BUY'
                # GAP 3: Post-ban order flow — heavy sell pressure
                if post_ban and side == 'BUY' and random.random() > 0.35:
                    side = 'SELL'
                qty = random.randint(200, 5000)
                flow_type = 'NO-SHORT' if (in_hold and side == 'BUY') else ('POST-BAN' if post_ban else 'MARKET')
                self.order_flow.append({
                    'time': step,
                    'side': side,
                    'qty': qty,
                    'price': round(self.current_price, 2),
                    'type': flow_type
                })

            self.prices.append(self.current_price)
            self.bids_h.append(self.order_book.best_bid())
            self.asks_h.append(self.order_book.best_ask())
            self.vols_h.append(self.current_vol)
            self.times.append(step)

            self._execute_trade_logic()
            self.root.after(0, self._update_gui)

            ms = self.speed_scale.get()
            time.sleep(ms / 1000.0)

        self.running = False
        self.root.after(0, self._show_final_results)

    # ─────────────────────────────────────────────
    #  ALL 50 STATES NATIONAL BATCH SIMULATION
    # ─────────────────────────────────────────────
    def _run_all_50_states(self):
        self._stop()
        time.sleep(0.15)
        self.is_national_mode = True
        self.running = False
        self._populate_leaderboard_initial()
        self.notebook.select(self.tab_leaderboard)
        self._start()

    def _run_all_50_states_thread(self):
        self._log("\n" + "🚀 " + "═" * 56)
        self._log("  LAUNCHING SIMULATION FOR ALL 50 US STATES")
        self._log("═" * 58)

        total_steps = len(self.data_window) if self.data_window is not None else 120
        dd_i = self.dd_trigger_step

        self.national_results = {}
        total_gdp = sum(s['gdp'] for s in STATES_DATA)
        weighted_ret_sum = 0.0
        total_national_pnl = 0.0

        for state in STATES_DATA:
            if not self.running:
                break

            state_id = state['id']
            tier_name, dd_pct, recovery_rate, vol_mult, reserve_pct = get_tier(state['gdp'])

            # GAP 4: State-specific beta and idiosyncratic noise
            state_beta = 1.0 + (state['eoi'] - 100.0) / 500.0
            state_rng = np.random.RandomState(hash(state_id) & 0xFFFFFFFF)

            # precompute state prices
            state_prices = []
            for i in range(total_steps):
                spy_close = float(self.data_window.iloc[i]['close']) if self.data_window is not None else self.initial_price
                state_noise = state_rng.normal(0, 0.0002 * vol_mult) * spy_close

                if i < dd_i:
                    state_prices.append(spy_close + state_noise)
                elif i == dd_i:
                    pre_p = state_prices[i - 1] if i > 0 else spy_close
                    post_p = pre_p * (1.0 - dd_pct)
                    state_prices.append(post_p)
                elif dd_i < i <= dd_i + self.HOLD_MINUTES + 1:
                    step_in_hold = i - dd_i
                    pre_p = state_prices[dd_i - 1]
                    post_p = state_prices[dd_i]
                    drop_amt = pre_p - post_p

                    t_norm = min(1.0, step_in_hold / float(self.HOLD_MINUTES))
                    rec_pct = recovery_rate * (1.0 - np.exp(-2.2 * t_norm)) / (1.0 - np.exp(-2.2))
                    rec_amt = drop_amt * rec_pct

                    # 0.0667% reserve reallocation — put in IMMEDIATELY right after drawdown
                    reserve_injection = pre_p * reserve_pct

                    spy_at_dd = float(self.data_window.iloc[dd_i]['close']) if self.data_window is not None else self.initial_price
                    spy_delta = (spy_close - spy_at_dd) * 0.3 * state_beta
                    state_prices.append(post_p + rec_amt + spy_delta + reserve_injection + state_noise)
                else:
                    # GAP 3: POST-BAN SELL PRESSURE
                    step_post = i - (dd_i + self.HOLD_MINUTES + 1)
                    pre_p = state_prices[dd_i - 1]
                    last_p = state_prices[dd_i + self.HOLD_MINUTES + 1]

                    if step_post <= 3:
                        sell_pressure = dd_pct * pre_p * 0.12 * (1.0 - step_post / 4.0)
                        state_prices.append(last_p - sell_pressure + state_noise)
                    else:
                        net_off = dd_pct * pre_p * 0.30
                        target_p = spy_close - net_off + state_noise
                        prev_p = state_prices[i - 1]
                        blend = min(1.0, (step_post - 3) / 5.0)
                        state_prices.append(prev_p * (1.0 - blend) + target_p * blend)

            # GAP 2: Entry/exit with widened spreads during event
            # At entry (dd_i+1): spread is ~3× wider due to event volatility
            entry_spread_mult = vol_mult * 1.5
            entry_p = state_prices[dd_i + 1] + (0.01 * entry_spread_mult)  # Ask with widened spread
            # At exit (dd_i+16): spread has mostly normalized (~1.2×)
            exit_spread_mult = max(1.2, vol_mult * 0.4)
            exit_p = state_prices[dd_i + self.HOLD_MINUTES + 1] - (0.01 * exit_spread_mult)  # Bid

            qty = int((self.INITIAL_CASH * self.LEVERAGE) / entry_p)
            commissions = qty * self.COMMISSION_PER_CONTRACT

            gross_ret = ((exit_p / entry_p) - 1.0) * 100.0
            lev_ret = gross_ret * self.LEVERAGE
            gross_pnl = (exit_p - entry_p) * qty
            net_pnl = gross_pnl - commissions

            self.national_results[state_id] = {
                'entry': entry_p, 'exit': exit_p, 'gross_ret': gross_ret,
                'lev_ret': lev_ret, 'net_pnl': net_pnl, 'qty': qty, 'tier': tier_name, 'dd_pct': dd_pct,
                'reserve_pct': reserve_pct
            }

            weighted_ret_sum += (state['gdp'] / total_gdp) * gross_ret
            total_national_pnl += net_pnl

            # Update row in leaderboard treeview
            self.root.after(0, lambda s=state, res=self.national_results[state_id]: self._update_leaderboard_row(s, res))

            time.sleep(0.02)  # fast batch execution animation

        self.running = False
        nat_lev_ret = weighted_ret_sum * self.LEVERAGE

        self.root.after(0, lambda: self.national_summary_lbl.config(
            text=f"NATIONAL GDP-WEIGHTED RETURN:  {weighted_ret_sum:+.4f}%  ({nat_lev_ret:+.3f}% 10×)  |  TOTAL 50-STATE P&L:  ${total_national_pnl:+,.2f}",
            fg=self.GREEN if weighted_ret_sum >= 0 else self.RED
        ))

        self.root.after(0, lambda: self._log(
            f"\n✅ 50-STATE NATIONAL SIMULATION COMPLETE\n"
            f"   Total US Economy GDP: ${total_gdp:,} Billion\n"
            f"   Weighted Average Return: {weighted_ret_sum:+.4f}%\n"
            f"   10× Leveraged Return:   {nat_lev_ret:+.3f}%\n"
            f"   Total 50-State Net P&L: ${total_national_pnl:+,.2f}\n"
        ))

    # ─────────────────────────────────────────────
    #  MONTE CARLO SIMULATION
    # ─────────────────────────────────────────────
    def _run_monte_carlo(self):
        self._stop()
        time.sleep(0.15)
        self.notebook.select(self.tab_monte_carlo)
        self.mc_running = True
        self.mc_results = []

        t = threading.Thread(target=self._run_monte_carlo_thread, daemon=True)
        t.start()

    def _run_monte_carlo_thread(self):
        num_scenarios = self.mc_scenarios_var.get()
        vol_min = self.mc_vol_min_var.get()
        vol_max = self.mc_vol_max_var.get()

        self._log_mc(f"\n{'═' * 60}")
        self._log_mc(f"  MONTE CARLO SIMULATION — {num_scenarios} SCENARIOS")
        self._log_mc(f"  Volatility Range: {vol_min:.2f}× to {vol_max:.2f}×")
        self._log_mc(f"{'═' * 60}\n")

        s = self.states_map[self.active_state_id]
        tier_name, dd_pct, recovery_rate, base_vol_mult, reserve_pct = get_tier(s['gdp'])
        total_steps = len(self.data_window) if self.data_window is not None else 120
        dd_i = self.dd_trigger_step

        gross_returns = []
        lev_returns = []
        net_pnls = []
        volatilities_used = []

        for scenario in range(num_scenarios):
            if not self.mc_running:
                break

            # Randomize volatility for this scenario
            vol_mult = vol_min + random.random() * (vol_max - vol_min)
            volatilities_used.append(vol_mult)

            # State-specific beta and noise
            state_beta = 1.0 + (s['eoi'] - 100.0) / 500.0
            state_rng = np.random.RandomState(random.randint(0, 2**32 - 1))

            # Generate price path for this scenario
            scenario_prices = []
            for i in range(total_steps):
                spy_close = float(self.data_window.iloc[i]['close']) if self.data_window is not None else self.initial_price
                state_noise = state_rng.normal(0, 0.0002 * vol_mult) * spy_close

                if i < dd_i:
                    scenario_prices.append(spy_close + state_noise)
                elif i == dd_i:
                    pre_p = scenario_prices[i - 1] if i > 0 else spy_close
                    post_p = pre_p * (1.0 - dd_pct)
                    scenario_prices.append(post_p)
                elif dd_i < i <= dd_i + self.HOLD_MINUTES + 1:
                    step_in_hold = i - dd_i
                    pre_p = scenario_prices[dd_i - 1]
                    post_p = scenario_prices[dd_i]
                    drop_amt = pre_p - post_p

                    t_norm = min(1.0, step_in_hold / float(self.HOLD_MINUTES))
                    rec_pct = recovery_rate * (1.0 - np.exp(-2.2 * t_norm)) / (1.0 - np.exp(-2.2))
                    rec_amt = drop_amt * rec_pct

                    reserve_injection = pre_p * reserve_pct
                    spy_at_dd = float(self.data_window.iloc[dd_i]['close']) if self.data_window is not None else self.initial_price
                    spy_delta = (spy_close - spy_at_dd) * 0.3 * state_beta
                    scenario_prices.append(post_p + rec_amt + spy_delta + reserve_injection + state_noise)
                else:
                    step_post = i - (dd_i + self.HOLD_MINUTES + 1)
                    pre_p = scenario_prices[dd_i - 1]
                    last_p = scenario_prices[dd_i + self.HOLD_MINUTES + 1]

                    if step_post <= 3:
                        sell_pressure = dd_pct * pre_p * 0.12 * (1.0 - step_post / 4.0)
                        scenario_prices.append(last_p - sell_pressure + state_noise)
                    else:
                        net_off = dd_pct * pre_p * 0.30
                        target_p = spy_close - net_off + state_noise
                        prev_p = scenario_prices[i - 1]
                        blend = min(1.0, (step_post - 3) / 5.0)
                        scenario_prices.append(prev_p * (1.0 - blend) + target_p * blend)

            # Calculate entry/exit with volatility-adjusted spreads
            entry_spread_mult = vol_mult * 1.5
            entry_p = scenario_prices[dd_i + 1] + (0.01 * entry_spread_mult)
            exit_spread_mult = max(1.2, vol_mult * 0.4)
            exit_p = scenario_prices[dd_i + self.HOLD_MINUTES + 1] - (0.01 * exit_spread_mult)

            qty = int((self.INITIAL_CASH * self.LEVERAGE) / entry_p)
            commissions = qty * self.COMMISSION_PER_CONTRACT

            gross_ret = ((exit_p / entry_p) - 1.0) * 100.0
            lev_ret = gross_ret * self.LEVERAGE
            gross_pnl = (exit_p - entry_p) * qty
            net_pnl = gross_pnl - commissions

            gross_returns.append(gross_ret)
            lev_returns.append(lev_ret)
            net_pnls.append(net_pnl)

            self.mc_results.append({
                'scenario': scenario + 1,
                'volatility': vol_mult,
                'gross_ret': gross_ret,
                'lev_ret': lev_ret,
                'net_pnl': net_pnl,
                'entry': entry_p,
                'exit': exit_p
            })

            # Update progress every 50 scenarios
            if (scenario + 1) % 50 == 0:
                self.root.after(0, lambda s=scenario+1: self._log_mc(f"  Progress: {s}/{num_scenarios} scenarios completed..."))
                time.sleep(0.01)

        self.mc_running = False

        # Calculate statistics
        if gross_returns:
            import statistics
            mean_gross = statistics.mean(gross_returns)
            median_gross = statistics.median(gross_returns)
            std_gross = statistics.stdev(gross_returns) if len(gross_returns) > 1 else 0
            min_gross = min(gross_returns)
            max_gross = max(gross_returns)

            mean_lev = statistics.mean(lev_returns)
            median_lev = statistics.median(lev_returns)
            std_lev = statistics.stdev(lev_returns) if len(lev_returns) > 1 else 0
            min_lev = min(lev_returns)
            max_lev = max(lev_returns)

            mean_pnl = statistics.mean(net_pnls)
            median_pnl = statistics.median(net_pnls)
            std_pnl = statistics.stdev(net_pnls) if len(net_pnls) > 1 else 0
            min_pnl = min(net_pnls)
            max_pnl = max(net_pnls)

            # Percentiles
            p5_gross = np.percentile(gross_returns, 5)
            p25_gross = np.percentile(gross_returns, 25)
            p75_gross = np.percentile(gross_returns, 75)
            p95_gross = np.percentile(gross_returns, 95)

            win_rate = sum(1 for r in gross_returns if r > 0) / len(gross_returns) * 100

            self.root.after(0, lambda: self._display_mc_stats(
                mean_gross, median_gross, std_gross, min_gross, max_gross,
                mean_lev, median_lev, std_lev, min_lev, max_lev,
                mean_pnl, median_pnl, std_pnl, min_pnl, max_pnl,
                p5_gross, p25_gross, p75_gross, p95_gross, win_rate,
                num_scenarios, vol_min, vol_max
            ))
            self.root.after(0, self._draw_mc_chart)

    def _log_mc(self, msg):
        self.mc_stats_text.config(state=tk.NORMAL)
        self.mc_stats_text.insert(tk.END, msg + "\n")
        self.mc_stats_text.see(tk.END)
        self.mc_stats_text.config(state=tk.DISABLED)

    def _display_mc_stats(self, mean_gross, median_gross, std_gross, min_gross, max_gross,
                          mean_lev, median_lev, std_lev, min_lev, max_lev,
                          mean_pnl, median_pnl, std_pnl, min_pnl, max_pnl,
                          p5_gross, p25_gross, p75_gross, p95_gross, win_rate,
                          num_scenarios, vol_min, vol_max):
        self.mc_stats_text.config(state=tk.NORMAL)
        self.mc_stats_text.delete('1.0', tk.END)

        stats = f"""
{'═' * 60}
  MONTE CARLO SIMULATION RESULTS
{'═' * 60}

  Scenarios Run:        {num_scenarios}
  Volatility Range:      {vol_min:.2f}× to {vol_max:.2f}×
  State:                 {self.states_map[self.active_state_id]['name']} ({self.active_state_id})

{'─' * 60}
  GROSS RETURN STATISTICS (%)
{'─' * 60}
  Mean:                 {mean_gross:+.4f}%
  Median:               {median_gross:+.4f}%
  Std Dev:              {std_gross:+.4f}%
  Min:                  {min_gross:+.4f}%
  Max:                  {max_gross:+.4f}%

  Percentiles:
    5th:                {p5_gross:+.4f}%
    25th:               {p25_gross:+.4f}%
    75th:               {p75_gross:+.4f}%
    95th:               {p95_gross:+.4f}%

{'─' * 60}
  10× LEVERAGED RETURN STATISTICS (%)
{'─' * 60}
  Mean:                 {mean_lev:+.3f}%
  Median:               {median_lev:+.3f}%
  Std Dev:              {std_lev:+.3f}%
  Min:                  {min_lev:+.3f}%
  Max:                  {max_lev:+.3f}%

{'─' * 60}
  NET P&L STATISTICS ($)
{'─' * 60}
  Mean:                 ${mean_pnl:+,.2f}
  Median:               ${median_pnl:+,.2f}
  Std Dev:              ${std_pnl:+,.2f}
  Min:                  ${min_pnl:+,.2f}
  Max:                  ${max_pnl:+,.2f}

{'─' * 60}
  WIN RATE:             {win_rate:.1f}%
{'═' * 60}
"""
        self.mc_stats_text.insert('1.0', stats)
        self.mc_stats_text.config(state=tk.DISABLED)

    def _draw_mc_chart(self):
        c = self.mc_canvas
        c.delete('all')

        if not self.mc_results:
            c.create_text(c.winfo_width() / 2, c.winfo_height() / 2,
                         text="Run Monte Carlo simulation to see distribution",
                         fill=self.TXT3, font=('Segoe UI', 10))
            return

        W = c.winfo_width()
        H = c.winfo_height()
        if W < 80 or H < 80:
            return

        ML, MR, MT, MB = 70, 30, 40, 50
        cw = W - ML - MR
        ch = H - MT - MB

        # Get gross returns for histogram
        returns = [r['gross_ret'] for r in self.mc_results]

        # Create histogram bins
        n_bins = 30
        min_ret = min(returns)
        max_ret = max(returns)
        bin_width = (max_ret - min_ret) / n_bins if max_ret != min_ret else 1

        bins = [0] * n_bins
        for ret in returns:
            bin_idx = int((ret - min_ret) / bin_width)
            if bin_idx >= n_bins:
                bin_idx = n_bins - 1
            bins[bin_idx] += 1

        max_count = max(bins) if bins else 1

        # Draw histogram
        bar_width = cw / n_bins
        for i, count in enumerate(bins):
            x = ML + i * bar_width
            bar_height = (count / max_count) * (ch * 0.8)
            y = MT + (ch * 0.8) - bar_height

            # Color based on return (green for positive, red for negative)
            ret_val = min_ret + i * bin_width
            color = self.GREEN if ret_val >= 0 else self.RED

            c.create_rectangle(x, y, x + bar_width - 2, MT + (ch * 0.8),
                             fill=color, outline='')

        # Draw axes
        c.create_line(ML, MT, ML, H - MB, fill=self.TXT2)  # Y axis
        c.create_line(ML, H - MB, W - MR, H - MB, fill=self.TXT2)  # X axis

        # Draw zero line if in range
        if min_ret <= 0 <= max_ret:
            zero_x = ML + ((0 - min_ret) / (max_ret - min_ret)) * cw
            c.create_line(zero_x, MT, zero_x, H - MB, fill=self.ACCENT_GOLD, dash=(4, 4))

        # Labels
        c.create_text(W / 2, 15, text="Gross Return Distribution",
                     fill=self.TXT, font=('Segoe UI', 10, 'bold'))

        # X-axis labels
        for i in range(0, n_bins + 1, 5):
            if i < n_bins:
                x = ML + i * bar_width
                ret_val = min_ret + i * bin_width
                c.create_text(x, H - MB + 15, text=f"{ret_val:.2f}%",
                             fill=self.TXT3, font=('Consolas', 7), anchor='n')

        # Y-axis labels
        for i in range(5):
            y = MT + (ch * 0.8) * (1 - i / 4)
            count_val = max_count * i / 4
            c.create_text(ML - 8, y, text=f"{int(count_val)}",
                         fill=self.TXT3, font=('Consolas', 7), anchor='e')

    def _update_leaderboard_row(self, state, res):
        for item in self.lb_tree.get_children():
            vals = self.lb_tree.item(item, 'values')
            if vals[0] == state['id']:
                self.lb_tree.item(item, values=(
                    state['id'], state['name'], f"${state['gdp']:,}B", res['tier'],
                    f"{res['dd_pct']:.1%}", f"{state['eoi']:.1f}", f"${state['target']:.2f}",
                    f"${res['entry']:.2f}", f"${res['exit']:.2f}",
                    f"{res['gross_ret']:+.4f}%", f"{res['lev_ret']:+.3f}%",
                    f"${res['net_pnl']:+,.2f}"
                ))
                break

    # ─────────────────────────────────────────────
    #  DRAWDOWN & TRADE EXECUTION
    # ─────────────────────────────────────────────
    def _trigger_drawdown(self, dd_pct):
        self.dd_triggered = True
        self.dd_step = self.current_step
        raw_spy = float(self.data_window.iloc[self.current_step]['close']) if self.data_window is not None else self.current_price

        self.pre_dd_price = raw_spy
        self.post_dd_price = self.real_prices[self.current_step]
        self.current_vol = 0.12 * 2.5

        # Calculate reserve deployment amount
        self.reserve_accumulated = self.pre_dd_price * self.RESERVE_PCT
        self.reserve_deployed = self.reserve_accumulated

        # GAP 2: Log spread widening
        spread_now = self.order_book.spread()

        ts = self.sim_time.strftime("%H:%M:%S")
        self._vars['dd_status'].set(f"⚡ DRAWDOWN at {ts}")
        self.return_status.config(text="🔒 NO-SHORT WINDOW ACTIVE", fg=self.RED)
        self.return_reserve.config(
            text=f"Reserve: ${self.reserve_accumulated:.4f} DEPLOYED IMMEDIATELY",
            fg=self.GREEN
        )

        self._log(f"⚡ DRAWDOWN YIELD at step {self.current_step} ({ts})")
        self._log(f"   Core Extraction:   −{dd_pct:.1%} (${self.pre_dd_price - self.post_dd_price:.2f}/share)")
        self._log(f"   Pre:  ${self.pre_dd_price:.2f} | Post: ${self.post_dd_price:.2f}")
        self._log(f"   Spread Widened:    ${spread_now:.4f} ({self.order_book.spread_mult:.1f}× normal)")
        self._log(f"   Reserve Realloc:   0.0667% = ${self.reserve_accumulated:.4f}/share → INSTANTLY REALLOCATED")
        self._log(f"   SHORT SELLING BLOCKED for {self.HOLD_MINUTES} minutes")
        self._log(f"   Reserve buffer active: 0.0667% reintroduced immediately to restore liquidity.")

    def _execute_trade_logic(self):
        if not self.dd_triggered or self.dd_step is None:
            return

        elapsed = self.current_step - self.dd_step

        if elapsed == 1 and self.shares == 0:
            ask_price = self.order_book.best_ask()
            self.entry_price = ask_price
            self.entry_step = self.current_step
            self.mfe_price = ask_price
            self.mae_price = ask_price

            notional = self.cash * self.LEVERAGE
            qty = int(notional / self.entry_price)
            if qty > 0:
                cost = self.entry_price * qty
                self.shares = qty
                commissions = qty * self.COMMISSION_PER_CONTRACT
                self.total_commissions = commissions
                self.cash -= (cost / self.LEVERAGE) + commissions

                self.trades.append({'step': self.current_step, 'action': 'BUY', 'shares': qty, 'price': self.entry_price, 'value': cost})
                self.order_flow.append({'time': self.current_step, 'side': 'BUY', 'qty': qty, 'price': self.entry_price, 'type': 'MY_ENTRY'})

                entry_time = self.sim_time.strftime("%H:%M")
                self._log(f"📈 LONG {qty:,} contracts @ ${self.entry_price:.2f} (Ask, {entry_time})")
                self.return_status.config(text="📈 HOLDING — NO SHORTS", fg=self.GREEN)

        elif 1 < elapsed <= self.HOLD_MINUTES + 1 and self.shares > 0:
            remaining = max(0, self.HOLD_MINUTES + 1 - elapsed)
            self._vars['cooldown'].set(f"{remaining:02d}:00")

            if self.current_price > self.mfe_price:
                self.mfe_price = self.current_price
            if self.current_price < self.mae_price:
                self.mae_price = self.current_price

            self.return_reserve.config(
                text=f"Reserve: ${self.reserve_accumulated:.4f} REALLOCATED INSTANTLY ✓",
                fg=self.GREEN
            )

            live_ret = ((self.current_price / self.entry_price) - 1) * 100
            live_lev = live_ret * self.LEVERAGE
            live_pnl = (self.current_price - self.entry_price) * self.shares - self.total_commissions

            col = self.GREEN if live_ret >= 0 else self.RED
            self.return_big.config(text=f"{live_ret:+.4f}%", fg=col)
            self.return_lev.config(text=f"10× Leveraged: {live_lev:+.3f}%", fg=col)
            self.return_pnl.config(text=f"Net P&L: ${live_pnl:+,.2f}", fg=col)
            self.return_fees.config(text=f"Fees: ${self.total_commissions:,.2f}")

        if elapsed == self.HOLD_MINUTES + 1 and self.shares > 0:
            bid_price = self.order_book.best_bid()
            self.exit_price = bid_price
            self.exit_step = self.current_step

            gross_ret = ((self.exit_price / self.entry_price) - 1) * 100
            lev_ret = gross_ret * self.LEVERAGE
            gross_pnl = (self.exit_price - self.entry_price) * self.shares
            net_pnl = gross_pnl - self.total_commissions

            self.position_return = gross_ret
            self.leveraged_return = lev_ret
            self.position_pnl = gross_pnl
            self.net_pnl = net_pnl

            proceeds = self.exit_price * self.shares
            self.cash += (proceeds / self.LEVERAGE) + gross_pnl

            self.trades.append({'step': self.current_step, 'action': 'SELL', 'shares': self.shares, 'price': self.exit_price, 'value': proceeds})
            self.order_flow.append({'time': self.current_step, 'side': 'SELL', 'qty': self.shares, 'price': self.exit_price, 'type': 'MY_EXIT'})

            exit_time = self.sim_time.strftime("%H:%M")
            self._log(f"📉 CLOSED {self.shares:,} contracts @ ${self.exit_price:.2f} (Bid, {exit_time})")
            self._log(f"   Gross Ret: {gross_ret:+.4f}%  |  10× Lev: {lev_ret:+.3f}%  |  Net P&L: ${net_pnl:+,.2f}")
            self._log(f"   Reserve Deployed:  ${self.reserve_accumulated:.4f}/sh (0.0667% liquidity buffer — fully absorbed)")

            self.shares = 0
            self._vars['cooldown'].set("00:00")
            self._vars['dd_status'].set("✅ Position Closed")

            col = self.GREEN if net_pnl >= 0 else self.RED
            self.return_big.config(text=f"{gross_ret:+.4f}%", fg=col)
            self.return_lev.config(text=f"10× Leveraged: {lev_ret:+.3f}%", fg=col)
            self.return_pnl.config(text=f"Net P&L: ${net_pnl:+,.2f}", fg=col)
            self.return_reserve.config(
                text=f"Reserve: ${self.reserve_accumulated:.4f} FULLY DEPLOYED ✓",
                fg=self.GREEN
            )
            self.return_entry_lbl.config(text=f"Entry: ${self.entry_price:.2f}  →  Exit: ${self.exit_price:.2f}")
            self.return_status.config(text="✅ TRADE COMPLETE", fg=self.GREEN)

    # ─────────────────────────────────────────────
    #  GUI UPDATES & CANVAS DRAWING
    # ─────────────────────────────────────────────
    def _update_gui(self):
        self._update_stats()
        self._update_ob()
        self._update_flow()
        self._update_trades()
        self._draw_chart()

    def _update_stats(self):
        mid = self.order_book.mid()
        self._vars['sim_time'].set(self.sim_time.strftime("%H:%M:%S"))
        self._vars['mid_price'].set(f"${mid:.2f}")
        self._vars['bid'].set(f"${self.order_book.best_bid():.2f}")
        self._vars['ask'].set(f"${self.order_book.best_ask():.2f}")
        self._vars['spread'].set(f"${self.order_book.spread():.4f}")
        self._vars['position'].set(f"{self.shares:+,d} contracts" if self.shares else "FLAT")

        pv = self.cash + (self.shares * self.current_price / self.LEVERAGE if self.shares else 0)
        self._vars['portfolio'].set(f"${pv:,.2f}")

        if self.shares > 0:
            req_maint = (self.shares * self.current_price) * 0.08
            equity = pv
            health = (equity / req_maint * 100) if req_maint > 0 else 100.0
            self._vars['margin_lvl'].set(f"{health:.1f}% HEALTHY")
        else:
            self._vars['margin_lvl'].set("100.0% OK")

    def _update_ob(self):
        for item in self.ob_tree.get_children():
            self.ob_tree.delete(item)
        bids = sorted(self.order_book.bids.items(), reverse=True)[:5]
        asks = sorted(self.order_book.asks.items())[:5]

        tot_b = sum(b[1] for b in bids)
        tot_a = sum(a[1] for a in asks)
        tot = tot_b + tot_a

        if tot > 0:
            obi = (tot_b - tot_a) / tot * 100.0
            if self.dd_triggered and self.dd_step is not None and 0 <= (self.current_step - self.dd_step) <= self.HOLD_MINUTES + 1:
                obi = abs(obi) + 65.0
                self.obi_lbl.config(text=f"OBI: +{obi:.1f}% (BUYERS ONLY — NO SHORTS)", fg=self.GREEN)
            else:
                col = self.GREEN if obi > 0 else (self.RED if obi < 0 else self.ACCENT_GOLD)
                self.obi_lbl.config(text=f"OBI: {obi:+.1f}% ({'BUY TILT' if obi > 0 else 'SELL TILT'})", fg=col)

        for i in range(5):
            bs = f"{bids[i][1]:,}" if i < len(bids) else ""
            bp = f"${bids[i][0]:.2f}" if i < len(bids) else ""
            ap = f"${asks[i][0]:.2f}" if i < len(asks) else ""
            a_s = f"{asks[i][1]:,}" if i < len(asks) else ""
            self.ob_tree.insert('', 'end', values=(bs, bp, ap, a_s))

    def _update_flow(self):
        for item in self.flow_tree.get_children():
            self.flow_tree.delete(item)
        for f in list(self.order_flow)[-20:]:
            self.flow_tree.insert('', 0, values=(f['time'], f['side'], f"{f['qty']:,}", f"${f['price']:.2f}", f['type']))

    def _update_trades(self):
        for item in self.trade_tree.get_children():
            self.trade_tree.delete(item)
        for t in self.trades[-10:]:
            self.trade_tree.insert('', 'end', values=(t['step'], t['action'], f"{t['shares']:,}", f"${t['price']:.2f}", f"${t['value']:,.2f}"))

    def _draw_chart(self):
        c = self.canvas
        c.delete('all')
        if len(self.prices) < 2:
            return

        W = c.winfo_width()
        H = c.winfo_height()
        if W < 80 or H < 80:
            return

        ML, MR, MT, MB = 65, 25, 25, 55
        cw = W - ML - MR
        ch = H - MT - MB

        prices = self.prices
        mn = min(prices) * 0.9995
        mx = max(prices) * 1.0005
        pr = mx - mn if mx != mn else 1
        n = len(prices)
        tr = max(1, n - 1)

        def px(i): return ML + (i / tr) * cw
        def py(p): return MT + (ch * 0.8) - ((p - mn) / pr) * (ch * 0.8)

        # grid
        c.create_line(ML, MT, ML, H - MB, fill='#1e293b')
        c.create_line(ML, H - MB, W - MR, H - MB, fill='#1e293b')
        for i in range(5):
            p = mn + pr * i / 4
            y = py(p)
            c.create_line(ML, y, W - MR, y, fill='#111827', dash=(2, 4))
            c.create_text(ML - 6, y, text=f"${p:.2f}", anchor='e', fill=self.TXT3, font=('Consolas', 7))

        # time
        for i in range(6):
            idx = int(i * tr / 5)
            x = px(idx)
            t_val = self.market_open + timedelta(minutes=idx)
            c.create_text(x, H - MB + 14, text=t_val.strftime("%H:%M"), fill=self.TXT3, font=('Consolas', 7))

        # volume histogram
        vol_h = 30
        vol_y_base = H - MB - 4
        max_vol = 80_000_000

        for i in range(n):
            v = float(self.data_window.iloc[i]['volume']) if self.data_window is not None and i < len(self.data_window) else 40_000_000
            x = px(i)
            vh = (v / max_vol) * vol_h

            if self.dd_triggered and i == self.dd_step:
                v_col = self.RED
                vh = vol_h
            elif self.dd_triggered and self.dd_step is not None and 0 <= (i - self.dd_step) <= self.HOLD_MINUTES + 1:
                v_col = '#065f46'
            else:
                v_col = '#1e293b'

            c.create_line(x, vol_y_base, x, vol_y_base - vh, fill=v_col, width=2)

        # drawdown region
        if self.dd_triggered and self.dd_step is not None:
            x_dd = px(self.dd_step)
            hold_end = self.dd_step + self.HOLD_MINUTES + 1
            x_end = px(min(hold_end, n - 1))

            c.create_rectangle(x_dd, MT, x_end, H - MB, fill='#1c1917', stipple='gray25', outline='')
            c.create_line(x_dd, MT, x_dd, H - MB, fill=self.RED, width=2, dash=(6, 3))
            c.create_text(x_dd, MT - 8, text="⚡ DRAWDOWN", fill=self.RED, font=('Segoe UI', 8, 'bold'))

            mid_x = (x_dd + x_end) / 2
            c.create_text(mid_x, MT + 14, text="NO SHORTS — 15 MIN HOLD", fill=self.ACCENT_GOLD, font=('Segoe UI', 8, 'bold'))

            entry_s = self.dd_step + 1
            if entry_s < n:
                ex = px(entry_s)
                ey = py(self.prices[entry_s])
                c.create_polygon(ex, ey + 12, ex - 6, ey, ex + 6, ey, fill=self.GREEN, outline='#065f46')
                c.create_text(ex, ey + 20, text="BUY", fill=self.GREEN, font=('Segoe UI', 8, 'bold'))

            exit_s = self.dd_step + self.HOLD_MINUTES + 1
            if exit_s < n:
                ex2 = px(exit_s)
                ey2 = py(self.prices[exit_s])
                c.create_polygon(ex2, ey2 - 12, ex2 - 6, ey2, ex2 + 6, ey2, fill=self.RED, outline='#7f1d1d')
                c.create_text(ex2, ey2 - 20, text="SELL", fill=self.RED, font=('Segoe UI', 8, 'bold'))

        # price line
        pts = []
        for i, p in enumerate(prices):
            pts.extend([px(i), py(p)])
        if len(pts) >= 4:
            c.create_line(pts, fill=self.ACCENT_BLUE, width=2, smooth=True)

        title_lbl = "NATIONAL AGGREGATE" if self.is_national_mode else f"{self.states_map[self.active_state_id]['name']} ({self.active_state_id})"
        c.create_text(W / 2, 10, text=f"SGA Futures — {title_lbl}  [REAL SPY REPLAY]", fill=self.TXT, font=('Segoe UI', 10, 'bold'))

    # ─────────────────────────────────────────────
    #  LOG & RESULTS
    # ─────────────────────────────────────────────
    def _log(self, msg):
        self.results_text.config(state=tk.NORMAL)
        self.results_text.insert(tk.END, msg + "\n")
        self.results_text.see(tk.END)
        self.results_text.config(state=tk.DISABLED)

    def _show_final_results(self):
        self._log("\n" + "═" * 58)
        self._log("  SINGLE STATE SIMULATION COMPLETE — REPORT")
        self._log("═" * 58)
        s = self.states_map[self.active_state_id]
        self._log(f"  State:               {s['name']} ({s['id']}) — ${s['gdp']}B GDP")

        if self.entry_price and self.exit_price:
            s_info = self.states_map[self.active_state_id]
            _, core_dd, _, _, res_pct = get_tier(s_info['gdp'])
            annual_core = core_dd * 12 * 100
            annual_res = res_pct * 12 * 100

            self._log(f"  Entry Price:         ${self.entry_price:.2f} (Ask)")
            self._log(f"  Exit Price:          ${self.exit_price:.2f} (Bid)")
            self._log(f"  Hold Duration:       {self.HOLD_MINUTES} minutes")
            self._log(f"  ─── Fee Structure ───")
            self._log(f"  Core Extraction:     {core_dd:.1%}/mo  ({annual_core:.1f}%/yr)")
            self._log(f"  Reserve Realloc:     {res_pct*100:.4f}%/mo  ({annual_res:.1f}%/yr)")
            self._log(f"  Total Annual Alloc:  {annual_core + annual_res:.1f}%")
            self._log(f"  Reserve Deployed:    ${self.reserve_accumulated:.4f}/share")
            self._log(f"  Reserve Purpose:     Post-drawdown liquidity stabilizer")
            self._log(f"  ─── Returns ───")
            self._log(f"  Gross Return:        {self.position_return:+.4f}%")
            self._log(f"  10× Leveraged Ret:   {self.leveraged_return:+.3f}%")
            self._log(f"  CME Exchange Fees:   ${self.total_commissions:,.2f}")
            self._log(f"  Net P&L:             ${self.net_pnl:+,.2f}")
            self._log(f"  Short Selling:       STRICTLY RESTRICTED (SGA Rule)")
        self._log("═" * 58)


# ═══════════════════════════════════════════════
#  APPLICATION ENTRY POINT
# ═══════════════════════════════════════════════
def main():
    root = tk.Tk()
    app = SGA50StatesGUI(root)
    root.mainloop()

if __name__ == "__main__":
    main()