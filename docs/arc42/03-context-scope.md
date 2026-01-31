# 3. Context and Scope

## 3.1 Business Context

```mermaid
flowchart TB
    player((Player))

    subgraph dabb [Dabb System]
        web[Web App]
        mobile[Mobile App]
        server[Server]
        db[(PostgreSQL)]
    end

    player -->|Play via browser| web
    player -->|Play via Android| mobile
    web -->|Socket.IO| server
    mobile -->|Socket.IO| server
    server -->|Store events| db
```

### Communication Partners

| Partner        | Interface         | Description               |
| -------------- | ----------------- | ------------------------- |
| Web Browser    | HTTPS + WebSocket | React SPA                 |
| Android Device | HTTPS + WebSocket | Expo app                  |
| PostgreSQL     | TCP/IP            | Event and session storage |

## 3.2 Technical Context

```mermaid
flowchart TB
    subgraph client [Client Layer]
        web[Web Browser]
        android[Android App]
    end

    subgraph app [Application Layer]
        express[Express Server]
        socketio[Socket.IO]
    end

    subgraph data [Data Layer]
        db[(PostgreSQL)]
    end

    web -->|"WebSocket (Socket.IO)"| socketio
    android -->|"WebSocket (Socket.IO)"| socketio
    web -->|"HTTP (REST API)"| express
    android -->|"HTTP (REST API)"| express
    express -->|SQL| db
    socketio -->|SQL| db
```

### Technical Interfaces

| Interface | Protocol   | Purpose                                      |
| --------- | ---------- | -------------------------------------------- |
| REST API  | HTTP/JSON  | Session management (create, join, reconnect) |
| WebSocket | Socket.IO  | Real-time game events                        |
| Database  | PostgreSQL | Persistent storage                           |
