# 3. Context and Scope

## 3.1 Business Context

```plantuml
@startuml
!theme plain

actor "Player" as player
rectangle "Dabb System" as dabb {
  component "Web App" as web
  component "Mobile App" as mobile
  component "Server" as server
  database "PostgreSQL" as db
}

player --> web : Play via browser
player --> mobile : Play via Android
web --> server : Socket.IO
mobile --> server : Socket.IO
server --> db : Store events

@enduml
```

### Communication Partners

| Partner        | Interface         | Description               |
| -------------- | ----------------- | ------------------------- |
| Web Browser    | HTTPS + WebSocket | React SPA                 |
| Android Device | HTTPS + WebSocket | Expo app                  |
| PostgreSQL     | TCP/IP            | Event and session storage |

## 3.2 Technical Context

```plantuml
@startuml
!theme plain

skinparam componentStyle rectangle

package "Client Layer" {
  [Web Browser] as web
  [Android App] as android
}

package "Application Layer" {
  [Express Server] as express
  [Socket.IO] as socketio
}

package "Data Layer" {
  database "PostgreSQL" as db
}

web -down-> socketio : WebSocket\n(Socket.IO)
android -down-> socketio : WebSocket\n(Socket.IO)
web -down-> express : HTTP\n(REST API)
android -down-> express : HTTP\n(REST API)
express -down-> db : SQL
socketio -down-> db : SQL

@enduml
```

### Technical Interfaces

| Interface | Protocol   | Purpose                                      |
| --------- | ---------- | -------------------------------------------- |
| REST API  | HTTP/JSON  | Session management (create, join, reconnect) |
| WebSocket | Socket.IO  | Real-time game events                        |
| Database  | PostgreSQL | Persistent storage                           |
