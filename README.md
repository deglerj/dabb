<div align="center">

# Dabb

### A Multiplayer Binokel Card Game

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-22-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Expo](https://img.shields.io/badge/Expo-55-000020.svg?logo=expo&logoColor=white)](https://expo.dev/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101.svg?logo=socket.io&logoColor=white)](https://socket.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1.svg?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Turborepo](https://img.shields.io/badge/Turborepo-2-EF4444.svg?logo=turborepo&logoColor=white)](https://turbo.build/)
[![pnpm](https://img.shields.io/badge/pnpm-10-F69220.svg?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Vitest](https://img.shields.io/badge/Vitest-4-6E9F18.svg?logo=vitest&logoColor=white)](https://vitest.dev/)
[![License](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](LICENSE)
[![AI Slop](https://img.shields.io/badge/AI%20Slop-100%25-blueviolet.svg?logo=openai&logoColor=white)](#ai-slop-history)

_Play the traditional Swabian card game Binokel with friends online!_

[Play Now](#getting-started) | [Development](#development)

</div>

---

## What is Binokel?

**Binokel** (also known as _Binocle_) is a traditional German card game that originated in Swabia. It combines elements of trick-taking and melding, making it a strategic and engaging game for 2-4 players.

### Key Features

- **Real-time multiplayer** - Play with friends anywhere
- **AI opponents** - Add AI players to fill empty seats or practice solo
- **Cross-platform** - Web and Android support
- **Multi-language** - German and English UI (Swabian card terms preserved)
- **Event-sourced** - Reliable state management with reconnection support
- **Swabian dialect** - Authentic card names and terminology
- **AI slop** - Purely vibe coded - nix mit schaffe, schaffe, ...

### AI Slop History

<p align="center">
  <img src="docs/ai-slop-history.svg" alt="AI Slop History" width="600">
</p>

---

## FAQ

### "But that's not how we play it!"

Ah yes, the eternal Binokel debate. Every village, every family, every Stammtisch has their own "correct" rules. Your uncle swears the winning score is 1500. Your grandmother insists you need all four 10s for a valid meld. Your neighbor plays with a 48-card deck and looks at you like you're a heretic for doing otherwise.

Here's the thing: the rules implemented in this app are based on the one true tradition, passed down through generations of Swabian card players who definitely knew what they were doing. Any deviation you may have encountered in your life was simply... incorrect. We're sorry you had to find out this way.

**Common "variations" (read: mistakes) we've heard:**

| What you might think                   | The truth                                                                |
| -------------------------------------- | ------------------------------------------------------------------------ |
| "Winning score should be 1500!"        | 1000 is the correct threshold. Your games just lasted too long.          |
| "We play with 48 cards including 9s!"  | The 9 (Neun) was banished for being too weak. It knows what it did.      |
| "All four 10s should be a valid meld!" | No. The 10 already gets 10 points per trick. It doesn't need more glory. |
| "We call the Ober 'Unter'!"            | The Ober is above the Buabe. It's in the name. Geography matters.        |
| "Going out gives others 30 points!"    | It's 40. Your opponents deserve proper compensation for your cowardice.  |
| "The bid winner plays the first card!" | The player after the dealer leads — same one who started the bidding.    |

If your local rules differ, we respectfully suggest that your ancestors may have misheard the rules at some point, and the error has been propagated through generations. It happens to the best of us.

That said, feel free to open an issue if you want to argue. We enjoy reading passionate defenses of objectively wrong rule variants.

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

### AI Players

Don't have enough friends online? Add AI players to fill empty seats:

1. In the **lobby**, click **Add AI Player**
2. The AI will join with a random name and play all phases automatically
3. You can mix human and AI players in any combination

The AI plays a reasonable game — it evaluates melds for bidding, chooses trump strategically, and follows trick-taking rules with card-counting heuristics. See [`docs/AI_STRATEGY.md`](docs/AI_STRATEGY.md) for details on its decision logic.

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
│   ├── card-assets/    # SVG card graphics
│   └── i18n/           # Internationalization
└── turbo.json
```

### Prerequisites

**For Docker/Podman development (recommended):**

- Docker or Podman with compose support

**For native development:**

- Node.js 22+
- pnpm 10+
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

2. **Start the Docker services**, then **start the Expo dev server:**

   ```bash
   ./dev.sh start
   ./dev.sh mobile
   ```

   This auto-detects your LAN IP and configures `EXPO_PUBLIC_SERVER_URL` so physical devices can reach the server.

3. **Scan the QR code** shown by Expo in the terminal with your phone's camera (iOS) or Expo Go app (Android)

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
| `./dev.sh mobile`          | Start Expo mobile dev server                    |

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

## License

CC BY-NC 4.0 License - see [LICENSE](LICENSE) for details.

---

<div align="center">

Made with ♥ in Swabia

</div>
