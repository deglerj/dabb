# 6. Runtime View

## 6.1 Create and Join Game

```mermaid
sequenceDiagram
    actor playerA as Player A
    actor playerB as Player B
    participant web as Web App
    participant server as Server
    participant db as PostgreSQL

    rect rgb(240, 240, 240)
        Note over playerA, db: Create Game
        playerA->>web: Click "New Game"
        web->>server: POST /sessions
        server->>db: INSERT session
        server-->>web: { sessionId, code }
        web->>server: POST /sessions/:code/join
        server->>db: INSERT player
        server-->>web: { secretId, playerIndex }
        web->>server: Connect Socket.IO
        server-->>web: game:state
    end

    rect rgb(240, 240, 240)
        Note over playerA, db: Join Game
        playerB->>web: Enter code, click "Join"
        web->>server: POST /sessions/:code/join
        server->>db: INSERT player
        server-->>web: { secretId, playerIndex }
        web->>server: Connect Socket.IO
        server-->>playerA: player:joined
        server-->>web: game:state
    end
```

## 6.2 Bidding Phase

```mermaid
sequenceDiagram
    actor playerA as Player A
    actor playerB as Player B
    participant server as Server

    rect rgb(240, 240, 240)
        Note over playerA, server: Player A Bids
        playerA->>server: game:bid { amount: 160 }
        server->>server: Validate bid
        server-->>playerA: game:events [BID_PLACED]
        server-->>playerB: game:events [BID_PLACED]
    end

    rect rgb(240, 240, 240)
        Note over playerA, server: Player B Passes
        playerB->>server: game:pass
        server->>server: Determine winner
        server-->>playerA: game:events [BID_PASSED, BIDDING_WON]
        server-->>playerB: game:events [BID_PASSED, BIDDING_WON]
    end
```

## 6.3 Playing a Card

```mermaid
sequenceDiagram
    actor player as Player
    participant web as Web App
    participant server as Server
    participant logic as Game Logic
    participant db as DB

    player->>web: Tap card
    web->>web: Check validity
    web->>server: game:playCard { cardId }
    server->>logic: getValidPlays()
    server->>server: Validate move
    server->>db: INSERT event
    server-->>web: game:events [CARD_PLAYED]
    web->>logic: gameReducer()
    web->>web: Update UI
```

## 6.4 Going Out (Forfeit Round)

When the bid winner doesn't think they can make their bid after seeing the Dabb, they can choose to "go out".

```mermaid
sequenceDiagram
    actor winner as Bid Winner
    actor opponent as Opponent
    participant server as Server
    participant db as DB

    rect rgb(240, 240, 240)
        Note over winner, db: Take Dabb
        winner->>server: game:takeDabb
        server->>db: INSERT DABB_TAKEN event
        server-->>winner: game:events [DABB_TAKEN]
    end

    rect rgb(240, 240, 240)
        Note over winner, db: Go Out
        winner->>server: game:goOut { suit: 'schippe' }
        server->>server: Validate (is bid winner, in dabb phase, dabb taken)
        server->>db: INSERT GOING_OUT event
        server-->>winner: game:events [GOING_OUT]
        server-->>opponent: game:events [GOING_OUT]
    end

    rect rgb(240, 240, 240)
        Note over winner, db: Melding (Opponent Only)
        opponent->>server: game:declareMelds { melds }
        server->>db: INSERT MELDS_DECLARED
        server->>server: All opponents declared
        server->>db: INSERT MELDING_COMPLETE
        server->>server: Calculate going out scores
        Note right of server: Bid winner: -bid amount<br/>Opponent: melds + 30 bonus
        server->>db: INSERT ROUND_SCORED
        server->>db: INSERT NEW_ROUND_STARTED, CARDS_DEALT
        server-->>winner: game:events [...]
        server-->>opponent: game:events [...]
    end
```

**Key Points:**

- Bid winner can only go out after taking the dabb
- Going out skips the trump declaration, tricks phase entirely
- Bid winner cannot declare melds when going out
- Opponents each get their melds + 30 bonus points
- Bid winner loses their bid amount

## 6.5 Reconnection

```mermaid
sequenceDiagram
    actor player as Player
    participant web as Web App
    participant server as Server
    participant db as DB

    player->>web: Reopen browser
    web->>web: Load secretId from storage
    web->>server: POST /sessions/:code/reconnect
    server->>db: Find player by secretId
    server-->>web: { playerIndex, sessionId }
    web->>server: Connect Socket.IO
    server->>db: SELECT events
    server-->>web: game:state { events }
    web->>web: Replay events
```
