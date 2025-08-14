// Single-player Blackjack (S17)

const SUITS = ["♠", "♥", "♦", "♣"]; // siyah: ♠ ♣, kırmızı: ♥ ♦
const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
// Card assets folder (adjust if needed)
const ASSETS_BASE = "SVG-cards-1.3/SVG-cards-1.3";
// Settings
const NUM_DECKS = 4; // number of decks (shoe)
const CUT_REMAIN_RATIO = 0.15; // reshuffle when remaining ratio below this threshold

/** Game state */
const game = {
  deck: [],
  playerHand: [], // alias to current hand's cards for backward compatibility
  playerHands: [], // [{ cards: Card[], bet: number, isComplete: bool, isDoubled: bool, hasHit: bool, isBlackjack?: bool }]
  currentHandIndex: 0,
  dealerHand: [],
  inRound: false,
  dealerHidden: true,
  isAnimating: false,
  shoeSize: 52 * NUM_DECKS,
  balance: 1000,
  currentBet: 0,
  hasSplit: false,
};

// UI refs
const dealerCardsEl = document.getElementById("dealer-cards");
const playerCardsEl = document.getElementById("player-cards");
const dealerScoreEl = document.getElementById("dealer-score");
const playerScoreEl = document.getElementById("player-score");
const statusEl = document.getElementById("status");
const btnStart = document.getElementById("btn-start");
const inlineControls = document.getElementById("inline-controls");
const btnHit = document.getElementById("btn-hit");
const btnStand = document.getElementById("btn-stand");
const btnDouble = document.getElementById("btn-double");
const btnSplit = document.getElementById("btn-split");
const mascotSpeech = document.getElementById("mascot-speech");
const speechBubble = document.querySelector(".speech-bubble");
const balanceEl = document.getElementById("balance");
const betInput = document.getElementById("bet-amount");
const chipButtons = document.querySelectorAll(".chip");
const betControlsEl = document.querySelector(".bet-controls");

function updateBalanceUI(){
  const balanceText = document.querySelector(".balance-text");
  if (!balanceText) return;
  balanceText.textContent = `${game.balance.toFixed(2)} fitcoin`;
}

function setBetControlsDisabled(disabled){
  if (betInput) betInput.disabled = disabled;
  chipButtons.forEach(btn => btn.disabled = disabled);
}

function parseBet(){
  const raw = betInput ? Number(betInput.value) : 0;
  if (!Number.isFinite(raw) || raw < 10) return 0;
  return Math.floor(raw);
}

function lockBet(){
  const amount = parseBet();
  if (amount <= 0){
    setStatus("Minimum bet is 10.");
    return false;
  }
  if (amount > game.balance){
    setStatus("Insufficient balance.", "lose");
    return false;
  }
  game.currentBet = amount;
  return true;
}

function buildDeck(){
  const deck = [];
  for (const suit of SUITS){
    for (const rank of RANKS){
      const isRed = (suit === "♥" || suit === "♦");
      deck.push({ rank, suit, isRed });
    }
  }
  return deck;
}

function buildShoe(numDecks = NUM_DECKS){
  let shoe = [];
  for (let i = 0; i < numDecks; i++){
    shoe = shoe.concat(buildDeck());
  }
  return shoe;
}

function shuffle(array){
  for (let i = array.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function cardValue(rank){
  if (rank === "A") return 11; // dinamik olarak 1'e düşebilir
  if (["K","Q","J"].includes(rank)) return 10;
  return Number(rank);
}

// Split için kartların aynı değerde olup olmadığını kontrol et
function canSplitCards(card1, card2){
  // Aynı rank ise split edilebilir
  if (card1.rank === card2.rank) return true;
  
  // J, Q, K ve 10 değerindeki kartlar da split edilebilir
  const value1 = cardValue(card1.rank);
  const value2 = cardValue(card2.rank);
  
  return value1 === value2 && value1 === 10;
}

function handTotals(hand){
  // Compute best total: Aces can be 11 or 1
  let total = 0;
  let aces = 0;
  for (const c of hand){
    total += cardValue(c.rank);
    if (c.rank === "A") aces++;
  }
  while (total > 21 && aces > 0){
    total -= 10; // bir As'ı 11'den 1'e düşür
    aces--;
  }
  return total;
}

// Compute display text for totals (e.g., 9/19 when Ace present)
function handTotalsDisplayText(hand){
  let minTotal = 0;
  let aces = 0;
  for (const c of hand){
    if (c.rank === "A") aces++;
    else minTotal += cardValue(c.rank);
  }
  // tüm As'ları 1 say
  minTotal += aces;
  const softTotal = aces > 0 ? minTotal + 10 : null;

  if (hand.length === 0) return "Total: 0";

  // İki seçenek de 21 veya altındaysa ikisini göster (örn. 9/19)
  if (softTotal !== null && softTotal <= 21 && minTotal <= 21){
    return `Total: ${minTotal}/${softTotal}`;
  }
  // Otherwise show the single best total
  return `Total: ${handTotals(hand)}`;
}

function dealCard(){
  if (game.deck.length === 0){
    // Rebuild shoe if empty
    game.deck = shuffle(buildShoe());
    game.shoeSize = 52 * NUM_DECKS;
  }
  return game.deck.pop();
}

function rankToName(rank){
  switch(rank){
    case "A": return "ace";
    case "J": return "jack";
    case "Q": return "queen";
    case "K": return "king";
    default: return rank; // 2..10
  }
}

function suitToName(suit){
  return suit === "♠" ? "spades" : suit === "♥" ? "hearts" : suit === "♦" ? "diamonds" : "clubs";
}

function cardImageSrc(card){
  return `${ASSETS_BASE}/${rankToName(card.rank)}_of_${suitToName(card.suit)}.svg`;
}

const SLEEP_MS = 600;
function sleep(ms = SLEEP_MS){
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function dealTo(hand){
  hand.push(dealCard());
  render();
  await sleep();
}

function render(){
  // Dealer
  dealerCardsEl.innerHTML = "";
  game.dealerHand.forEach((c, idx) => {
    const div = document.createElement("div");
    div.className = "card";
    if (game.dealerHidden && idx === 0 && game.inRound){
      div.classList.add("back");
      dealerCardsEl.appendChild(div);
      return;
    }
    const img = document.createElement("img");
    img.alt = `${c.rank}${c.suit}`;
    img.src = cardImageSrc(c);
    div.appendChild(img);
    dealerCardsEl.appendChild(div);
  });

  // Player (support multi-hand)
  playerCardsEl.innerHTML = "";
  const hands = game.playerHands.length ? game.playerHands : [{ cards: game.playerHand, bet: game.currentBet }];
  hands.forEach((hand, idx) => {
    const handWrap = document.createElement("div");
    handWrap.style.display = "flex";
    handWrap.style.flexDirection = "column";
    handWrap.style.gap = "6px";
    handWrap.style.padding = "6px";
    handWrap.style.border = idx === game.currentHandIndex && game.inRound ? "2px solid #f59e0b" : "1px solid rgba(255,255,255,.1)";
    handWrap.style.borderRadius = "10px";

    const cardsRow = document.createElement("div");
    cardsRow.className = "cards";
    hand.cards.forEach(c => {
      const div = document.createElement("div");
      div.className = "card";
      const img = document.createElement("img");
      img.alt = `${c.rank}${c.suit}`;
      img.src = cardImageSrc(c);
      div.appendChild(img);
      cardsRow.appendChild(div);
    });

    const meta = document.createElement("div");
    meta.className = "score";
    meta.textContent = `${handTotalsDisplayText(hand.cards)} • Bet: ${hand.bet}`;

    handWrap.appendChild(cardsRow);
    handWrap.appendChild(meta);
    playerCardsEl.appendChild(handWrap);
  });

  // Skorlar
  playerScoreEl.textContent = handTotalsDisplayText(game.playerHand);

  const dealerText = (game.dealerHidden && game.inRound)
    ? handTotalsDisplayText(game.dealerHand.slice(1))
    : handTotalsDisplayText(game.dealerHand);
  dealerScoreEl.textContent = dealerText;

  // Button states
  const shouldDisable = !game.inRound || game.isAnimating;
  btnHit.disabled = shouldDisable;
  btnStand.disabled = shouldDisable;
  // Double / Split conditions
  const active = game.playerHands[game.currentHandIndex];
  const canFirstAction = !!active && active.cards.length === 2 && !shouldDisable && !active.hasHit;
  btnDouble.disabled = !canFirstAction || game.balance < active?.bet;
  const canSplit = !!active && active.cards.length === 2 && !game.hasSplit && canSplitCards(active.cards[0], active.cards[1]) && game.balance >= active.bet && !shouldDisable;
  btnSplit.disabled = !canSplit;

  // Bet controls visibility based on round state
  const betControlsEl = document.querySelector('.bet-controls');
  if (betControlsEl){
    betControlsEl.style.display = game.inRound ? 'none' : '';
  }
}

function setMascotSpeech(message, show = true) {
  if (!mascotSpeech || !speechBubble) return;
  mascotSpeech.textContent = message;
  speechBubble.classList.toggle("show", show);
  if (show) {
    setTimeout(() => {
      speechBubble.classList.remove("show");
    }, 4000);
  }
}

function setStatus(message, type = "info"){
  statusEl.textContent = message;
  statusEl.style.color = type === "win" ? "var(--ok)" : type === "lose" ? "var(--danger)" : "#fef3c7";
  
  // Mascot reactions
  if (message.includes("Push")) {
    setMascotSpeech("Not bad, not bad! The magic was balanced this time! 🎭");
  } else if (type === "win") {
    setMascotSpeech("✨ Amazing play! The magic was with you! ✨");
  } else if (type === "lose") {
    setMascotSpeech("Don't worry, magic takes practice! Try again! 🎩");
  }
}

async function startHand(){
  if (game.isAnimating) return;
  // Cut-card/reshuffle check
  if (game.deck.length === 0 || game.deck.length < game.shoeSize * CUT_REMAIN_RATIO){
    game.deck = shuffle(buildShoe());
    game.shoeSize = 52 * NUM_DECKS;
  }
  game.inRound = true;
  game.dealerHidden = true;
  game.dealerHand = [];
  // init player hands
  const firstHand = { cards: [], bet: game.currentBet, isComplete: false, isDoubled: false, hasHit: false, isBlackjack: false };
  game.playerHands = [firstHand];
  game.currentHandIndex = 0;
  game.playerHand = firstHand.cards; // alias for backward-compat
  game.hasSplit = false;
  game.isAnimating = true;
  setStatus("Dealing...");
  render();

  // Sequential deal: Player (face-up), Dealer (face-down), Player (face-up), Dealer (face-up)
  await dealTo(game.playerHands[0].cards);
  await dealTo(game.dealerHand); // first dealer facedown
  await dealTo(game.playerHands[0].cards);
  await dealTo(game.dealerHand);

  // Natural blackjack check
  const playerTotal = handTotals(game.playerHands[0].cards);
  const dealerTotal = handTotals(game.dealerHand);
  game.isAnimating = false;

  if (playerTotal === 21 || dealerTotal === 21){
    if (playerTotal === 21 && dealerTotal !== 21) {
      game.playerHands[0].isBlackjack = true;
    }
    game.dealerHidden = false;
    await endRound();
    return;
  }

  setStatus("You can Hit or Stand.");
  render();
}

async function playerHit(){
  if (!game.inRound || game.isAnimating) return;
  game.isAnimating = true;
  const active = game.playerHands[game.currentHandIndex];
  active.hasHit = true;
  await dealTo(active.cards);
  const total = handTotals(active.cards);
  game.isAnimating = false;
  if (total > 21){
    active.isComplete = true;
    await advanceOrEnd();
  } else {
    render();
  }
}

async function advanceOrEnd(){
  // Move to next incomplete hand or go to dealer
  const nextIdx = game.playerHands.findIndex((h, i) => !h.isComplete && i >= game.currentHandIndex);
  if (nextIdx !== -1 && nextIdx !== game.currentHandIndex){
    game.currentHandIndex = nextIdx;
    game.playerHand = game.playerHands[game.currentHandIndex].cards;
    render();
    return;
  }
  const remaining = game.playerHands.findIndex(h => !h.isComplete);
  if (remaining !== -1){
    game.currentHandIndex = remaining;
    game.playerHand = game.playerHands[game.currentHandIndex].cards;
    render();
    return;
  }
  // all done → dealer
  game.dealerHidden = false;
  await endRound();
}

async function dealerPlay(){
  // S17: stand on all 17 (including soft 17)
  while (handTotals(game.dealerHand) < 17){
    await dealTo(game.dealerHand);
  }
}

function decideOutcome(){
  const p = handTotals(game.playerHand);
  const d = handTotals(game.dealerHand);

  // returnMult: total return multiplier on settlement AFTER stake was deducted at start
  // loss: 0, push: 1, win: 2, blackjack: 2.5
  if (p > 21) return { type:"lose", text:"Busted! Dealer wins.", returnMult: 0 };
  if (d > 21) return { type:"win", text:"Dealer busted. You win!", returnMult: 2 };
  if (p === d) return { type:"info", text:"Push.", returnMult: 1 };
  if (p === 21 && game.playerHand.length === 2 && !(d === 21 && game.dealerHand.length === 2)){
    return { type:"win", text:"Blackjack!", returnMult: 2.5 };
  }
  return p > d ? { type:"win", text:"You win!", returnMult: 2 } : { type:"lose", text:"Dealer wins.", returnMult: 0 };
}

function decideOutcomeForHand(hand){
  const p = handTotals(hand.cards);
  const d = handTotals(game.dealerHand);
  // Natural BJ only if flagged
  if (hand.isBlackjack) return { type: "win", text: "Blackjack!", returnMult: 2.5 };
  if (p > 21) return { type:"lose", text:"Busted! Dealer wins.", returnMult: 0 };
  if (d > 21) return { type:"win", text:"Dealer busted. You win!", returnMult: 2 };
  if (p === d) return { type:"info", text:"Push.", returnMult: 1 };
  return p > d ? { type:"win", text:"You win!", returnMult: 2 } : { type:"lose", text:"Dealer wins.", returnMult: 0 };
}

async function endRound(){
  if (!game.inRound && !game.dealerHidden) {
    // zaten bitmiş olabilir
  }
  game.inRound = false;
  game.isAnimating = true;
  game.dealerHidden = false;
  render();
  await sleep(SLEEP_MS); // flip moment matches deal delay

  const playerTotal = handTotals(game.playerHand);
  if (playerTotal <= 21){
    setStatus("Dealer is playing...");
    await dealerPlay();
  }

  const result = decideOutcome();
  game.isAnimating = false;
  // If multiple hands, summarize and settle each
  if (game.playerHands.length > 1){
    let messages = [];
    for (let i = 0; i < game.playerHands.length; i++){
      const h = game.playerHands[i];
      const r = decideOutcomeForHand(h);
      // Double edilmiş bahisler için doğru hesaplama
      const payout = h.bet * r.returnMult;
      game.balance += payout;
      messages.push(`Hand ${i+1}: ${r.text}`);
    }
    updateBalanceUI();
    setStatus(messages.join(" | "));
  } else {
    setStatus(result.text, result.type);
    // Apply settlement (stake already deducted at start)
    // Double edilmiş bahisler için doğru hesaplama
    const currentHand = game.playerHands[0];
    if (currentHand && currentHand.bet > 0 && typeof result.returnMult === "number"){
      const payout = currentHand.bet * result.returnMult;
      game.balance += payout;
      updateBalanceUI();
    }
  }
  render();

  // Round ended: hide controls and show New Hand button
  inlineControls.hidden = true;
  btnStart.textContent = "New Hand";
  btnStart.hidden = false;

  // Unlock bet controls for next hand
  setBetControlsDisabled(false);
  if (betControlsEl) betControlsEl.hidden = false;
}

btnStart.addEventListener("click", () => {
  // Start: hide button, show controls
  if (!lockBet()) return;
  // Deduct stake immediately
  game.balance -= game.currentBet;
  updateBalanceUI();
  setBetControlsDisabled(true);
  if (betControlsEl) betControlsEl.hidden = true;
  btnStart.hidden = true;
  inlineControls.hidden = false;
  startHand();
});

btnHit.addEventListener("click", () => { playerHit(); });

btnStand.addEventListener("click", () => {
  if (!game.inRound || game.isAnimating) return;
  const active = game.playerHands[game.currentHandIndex];
  active.isComplete = true;
  advanceOrEnd();
});

btnDouble.addEventListener("click", async () => {
  if (!game.inRound || game.isAnimating) return;
  const active = game.playerHands[game.currentHandIndex];
  if (!active || active.cards.length !== 2 || active.hasHit) return;
  if (game.balance < active.bet) { setStatus("Insufficient balance to double.", "lose"); return; }
  
  // Double için ek bahis çıkar (mevcut bahis zaten başlangıçta çıkarılmıştı)
  // Burada sadece ek bahis çıkarıyoruz, toplam bahis 2 katına çıkacak
  game.balance -= active.bet;
  updateBalanceUI();
  active.bet *= 2;
  active.isDoubled = true;
  game.isAnimating = true;
  await dealTo(active.cards);
  game.isAnimating = false;
  active.isComplete = true;
  await advanceOrEnd();
});

btnSplit.addEventListener("click", async () => {
  if (!game.inRound || game.isAnimating) return;
  const active = game.playerHands[game.currentHandIndex];
  if (!active || active.cards.length !== 2 || game.hasSplit) return;
  if (!canSplitCards(active.cards[0], active.cards[1])) return;
  if (game.balance < active.bet) { setStatus("Insufficient balance to split.", "lose"); return; }
  // Deduct extra stake for new hand
  game.balance -= active.bet;
  updateBalanceUI();
  // Create new hand from second card
  const secondCard = active.cards.pop();
  const newHand = { cards: [secondCard], bet: active.bet, isComplete: false, isDoubled: false, hasHit: false };
  // Insert new hand right after current
  game.playerHands.splice(game.currentHandIndex + 1, 0, newHand);
  game.hasSplit = true;
  render();
  // Deal one new card to each split hand
  game.isAnimating = true;
  await dealTo(active.cards);
  await dealTo(newHand.cards);
  game.isAnimating = false;
  render();
});

// Initial state (no auto-start)
inlineControls.hidden = true;
btnStart.hidden = false;
setStatus("Ready");
render();
updateBalanceUI();

// Welcome message
setMascotSpeech("Welcome to the magical Blackjack table! 🎩✨");

// Chip buttons logic
chipButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    if (!betInput) return;
    const amtAttr = btn.getAttribute("data-amt");
    if (!amtAttr) return;
    if (amtAttr === "clear"){ betInput.value = "0"; return; }
    const add = Number(amtAttr);
    const current = parseBet();
    const next = Math.max(0, current + (Number.isFinite(add) ? add : 0));
    betInput.value = String(next);
  });
});



