# Rummy Online

A real-time 2-player Indian Rummy game playable over a local network (LAN). Built with React, Node.js, and Socket.io.

[https://rummy-online-yg60.onrender.com](url)

---

## Features

### Gameplay
- Full **Indian Rummy** rules (13-card hand, single 52-card deck)
- **Pure Sequence (Life)** — 3+ consecutive cards, same suit, no jokers
- **Impure Sequence (2nd Life)** — 3+ consecutive cards, same suit, jokers allowed as substitutes
- **Set (Triplet)** — 3–4 cards of the same rank, different suits, jokers allowed
- Win by grouping all 13 cards into valid groups and clicking **Show**
- Show is only valid with at least 1 pure sequence (Life) and at least 2 sequences before any sets
- **Wild Joker** — one card rank randomly chosen each game; all cards of that rank act as jokers
- **Printed Jokers** — configurable number of pure joker cards in the deck

### Room & Lobby
- Create a room and get a shareable 6-character room code
- Join by room code or from the open rooms list
- Host can configure room settings before the opponent joins:
  - **Turn time** — 30s, 45s, 60s, 90s, 120s, 180s, or 300s per turn
  - **Printed jokers** — 0 to 4 joker cards in the deck
- Settings lock once the opponent joins

### In-Game UI
- **Chess clock** — per-player countdown timer; pulses red when ≤10s remain; auto-discards on timeout
- **Card grouping** — select 3+ cards and label them as Life (L), 2nd Life (S), or Triplet (T)
- **Group names** — groups are labeled L1, L2, S1, T1, etc.; each card in your hand shows its group badge
- **Drag to rearrange** — drag cards in your hand to reorder them
- **Show validation** — invalid groups are identified by name in the error message (e.g. "L2: invalid pure sequence")
- **Discard** — draw a card, select exactly 1 ungrouped card, and click Discard
- **Leave Game** button — forfeits the game and awards the win to the opponent
- Opponent's hand shown as face-down card backs with count

### Authentication
- **Guest login** — pick a username and play immediately (session lasts 24h)
- **Account registration / login** — persistent accounts stored in SQLite; email login is case-insensitive
- Logging out or closing the tab clears the session automatically

### Networking
- Works over **LAN** — any device on the same Wi-Fi can join using the host machine's IP address
- Server runs on port **3001**, client dev server on port **5173**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS |
| State | Zustand (with localStorage persistence for auth) |
| Routing | React Router v6 |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Real-time | Socket.io |
| Backend | Node.js, Express |
| Database | SQLite via Prisma ORM |
| Auth | JWT + bcrypt |

---

## Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or later
- npm v9 or later

### 1. Install dependencies

From the repo root:

```bash
npm install
```

This installs dependencies for both the `client` and `server` workspaces.

### 2. Set up the database

```bash
cd server
npx prisma migrate deploy
cd ..
```

If this is a fresh clone with no migrations yet, use `migrate dev` instead:

```bash
cd server
npx prisma migrate dev --name init
cd ..
```

### 3. Configure environment variables

The server needs a `.env` file. Create `server/.env`:

```
DATABASE_URL="file:./dev.db"
JWT_SECRET="change-this-to-a-random-secret"
PORT=3001
```

### 4. Run in development

From the repo root:

```bash
npm run dev
```

This starts both the server (port 3001) and the Vite dev server (port 5173) concurrently.

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## LAN Play

To play with another device on the same Wi-Fi network:

1. Find your machine's local IP address (e.g. `192.168.1.42`)
   - Windows: run `ipconfig` in a terminal, look for **IPv4 Address**
2. Start the app with `npm run dev` as above
3. On the other device, open `http://192.168.1.42:5173` in a browser

Both the Vite dev server (`host: true`) and the Express server (`0.0.0.0`) bind to all network interfaces, so no extra configuration is needed.

---

## How to Play

1. **Log in** as a guest or with a registered account
2. One player clicks **Create Room** — a 6-character room code appears
3. The host can adjust turn time and joker count in the settings panel
4. The other player clicks **Join by Room Code** and enters the code (or joins from the Open Rooms list)
5. Both players click **I'm Ready!**
6. The game starts — player 0 goes first
7. On your turn:
   - Click the **Deck** or **Open Pile** to draw a card
   - Click cards to select them, then label them as a group (Life, 2nd Life, or Triplet) in the Group Panel
   - Drag cards to rearrange your hand
   - Select 1 ungrouped card and click **Discard selected card** to end your turn
   - Or, if all 13 cards are in valid groups, click **Show!** to win
8. If your timer runs out, a card is auto-discarded and the turn passes
