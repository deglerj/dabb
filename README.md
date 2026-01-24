<div align="center">

# Dabb

### A Multiplayer Binokel Card Game

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933.svg?logo=node.js)](https://nodejs.org/)
[![Expo](https://img.shields.io/badge/Expo-54-000020.svg?logo=expo)](https://expo.dev/)
[![License](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](LICENSE)

_Play the traditional Swabian card game Binokel with friends online!_

[Play Now](#getting-started) | [Game Rules](#game-rules) | [Development](#development)

</div>

---

## What is Binokel?

**Binokel** (also known as _Binocle_) is a traditional German card game that originated in Swabia. It combines elements of trick-taking and melding, making it a strategic and engaging game for 2-4 players.

### Key Features

- **Real-time multiplayer** - Play with friends anywhere
- **Cross-platform** - Web and Android support
- **Event-sourced** - Reliable state management with reconnection support
- **Swabian dialect** - Authentic card names and terminology
- **AI slop** - Purely vibe coded - nix mit schaffe, schaffe, ...

---

## Game Rules

### Overview

Binokel is played with a **40-card deck** (two copies of each card). The goal is to score points through **melds** (card combinations) and **tricks** (winning rounds).

### Cards

| Rank | Name (Swabian) | Points |
| ---- | -------------- | ------ |
| A    | Ass            | 11     |
| 10   | Zehn           | 10     |
| K    | König          | 4      |
| O    | Ober           | 3      |
| U    | Buabe          | 2      |

**Suits**: Kreuz (♣), Schippe (♠), Herz (♥), Bollen (♦)

### Game Phases

1. **Dealing** - Cards are dealt to players and the _Dabb_ (extra cards)
2. **Bidding** - Players bid for the right to name trump (starts at 150)
3. **Dabb** - Bid winner takes the Dabb and discards cards
4. **Trump** - Bid winner declares the trump suit
5. **Melding** - All players declare their melds for points
6. **Tricks** - Play 11-15 rounds to win tricks
7. **Scoring** - Calculate points and update scores

### Melds

| Meld           | Description                           | Points             |
| -------------- | ------------------------------------- | ------------------ |
| Paar           | King + Ober of same suit              | 20 (40 if trump)   |
| Familie        | A-10-K-O-U of same suit               | 100 (150 if trump) |
| Binokel        | Ober Schippe + Buabe Bollen           | 40                 |
| Doppel-Binokel | Both Ober Schippe + both Buabe Bollen | 300                |
| Vier Ass       | All four Asses                        | 100                |
| Vier König     | All four Kings                        | 80                 |
| Vier Ober      | All four Obers                        | 60                 |
| Vier Buabe     | All four Buaben                       | 40                 |

### Trick Rules

1. **Must follow suit** if possible
2. **Must beat** the highest card of the led suit if following
3. **Must play trump** if unable to follow suit
4. **Must beat** the highest trump if trumping
5. Any card is valid only if you cannot follow or trump

### Winning

The first team/player to reach **1000 points** wins the game!

---

## Getting Started

### Play Online

Visit [your-deployment-url] to play instantly in your browser!

### Join a Game

1. Get a **game code** from the host (e.g., `schnell-fuchs-42`)
2. Enter your **nickname**
3. Click **Join Game**

### Create a Game

1. Click **New Game**
2. Choose **player count** (2, 3, or 4)
3. Enter your **nickname**
4. Share the **game code** with friends

---

## Development

### Tech Stack

| Component | Technology                    |
| --------- | ----------------------------- |
| Monorepo  | pnpm + Turborepo              |
| Backend   | Node.js + Express + Socket.IO |
| Database  | PostgreSQL                    |
| Web       | React + Vite                  |
| Mobile    | React Native + Expo           |
| Types     | TypeScript                    |

### Project Structure

```
dabb/
├── apps/
│   ├── web/        # React web client
│   ├── mobile/     # React Native Android app
│   └── server/     # Node.js backend
├── packages/
│   ├── game-logic/     # Core game engine
│   ├── shared-types/   # TypeScript types
│   ├── ui-shared/      # Shared React hooks
│   └── card-assets/    # SVG card graphics
└── turbo.json
```

### Prerequisites

**For Docker/Podman development (recommended):**

- Docker or Podman with compose support

**For native development:**

- Node.js 22+
- pnpm 9+
- PostgreSQL 16+

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/dabb.git
cd dabb

# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Run tests
pnpm test
```

### Development Server

```bash
# Start the backend server
pnpm --filter @dabb/server dev

# Start the web client (in another terminal)
pnpm --filter @dabb/web dev

# Start the mobile app
pnpm --filter @dabb/mobile start
```

### Mobile Development with Expo Go

To test the mobile app on a physical device using [Expo Go](https://expo.dev/go):

1. **Install Expo Go** on your phone (iOS App Store / Google Play)

2. **Find your computer's local IP:**

   ```bash
   # Linux
   hostname -I
   # macOS
   ipconfig getifaddr en0
   ```

3. **Configure the server URL** in `apps/mobile/.env`:

   ```env
   EXPO_PUBLIC_SERVER_URL=http://YOUR_LOCAL_IP:3000
   ```

4. **Start the server and mobile app:**

   ```bash
   # Terminal 1
   pnpm --filter @dabb/server dev

   # Terminal 2
   pnpm --filter @dabb/mobile start
   ```

5. **Scan the QR code** in the terminal with your phone's camera (iOS) or Expo Go app (Android)

**Note:** Your phone and computer must be on the same WiFi network.

### Local Development with Docker/Podman

The easiest way to run the full stack locally is using the `dev.sh` script, which works with both Docker and Podman (with docker aliases):

```bash
# Start all services (PostgreSQL, Server, Web)
./dev.sh start

# Or using pnpm
pnpm run docker:start
```

**Access points:**

- Web app: http://localhost:8080
- Server API: http://localhost:3000
- PostgreSQL: `postgresql://dabb:dabb_dev_password@localhost:5432/dabb`

**Available commands:**

| Command                    | Description                                     |
| -------------------------- | ----------------------------------------------- |
| `./dev.sh start`           | Start all services                              |
| `./dev.sh stop`            | Stop all services                               |
| `./dev.sh restart`         | Restart all services                            |
| `./dev.sh logs`            | Follow logs (add service name to filter)        |
| `./dev.sh status`          | Show container status                           |
| `./dev.sh health`          | Health check all services                       |
| `./dev.sh shell <service>` | Open shell in container (postgres, server, web) |
| `./dev.sh db`              | Connect to PostgreSQL CLI                       |
| `./dev.sh reset`           | Remove all data and start fresh                 |
| `./dev.sh build`           | Rebuild images                                  |

**Requirements:** Docker or Podman with compose support.

### Environment Variables

Create `.env` files in the respective apps:

**apps/server/.env**

```env
DATABASE_URL=postgresql://localhost:5432/dabb
PORT=3000
```

**apps/web/.env**

```env
VITE_SERVER_URL=http://localhost:3000
```

**apps/mobile/.env**

```env
EXPO_PUBLIC_SERVER_URL=http://localhost:3000
```

---

## Architecture

The project uses **event sourcing** for reliable game state management:

1. All game actions are stored as **events** in the database
2. Game state is computed by **replaying events** through a reducer
3. **Reconnection** is handled by syncing missed events
4. **Anti-cheat** filtering ensures players only see their own cards

See the [Architecture Documentation](docs/arc42/) for details.

---

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests (`pnpm test`)
5. Submit a pull request

---

## License

CC BY-NC 4.0 License - see [LICENSE](LICENSE) for details.

---

<div align="center">

Made with ♥ in Swabia

</div>
