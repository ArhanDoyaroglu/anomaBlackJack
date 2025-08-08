# AnomaBlackjack 🎰

Modern single-player Blackjack game with FitCoin integration.

## Features
- Single-player gameplay against dealer (S17 rules)
- FitCoin currency system
- Animated card dealing
- Magical dealer mascot with dynamic reactions
- Modern UI with responsive design

## Tech Stack
- Pure JavaScript (No frameworks)
- HTML5 & CSS3
- SVG card assets

## Setup
1. Clone the repository
```bash
git clone https://github.com/ArhanDoyaroglu/anomaBlackJack.git
```

2. Open `index.html` in your browser or serve with a local server:
```bash
# Using Python
python -m http.server 5173

# Using Node.js
npx --yes serve -s -l 5173
```

3. Visit `http://localhost:5173` in your browser

## Game Rules
- Dealer stands on all 17s (including soft 17)
- Blackjack pays 1.5x
- Minimum bet: 10 FITCOIN
- Starting balance: 1000 FITCOIN
