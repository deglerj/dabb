# 1. Introduction and Goals

## 1.1 Requirements Overview

Dabb is a multiplayer implementation of the Swabian card game **Binokel** that allows 2-4 players to play together online.

### Core Requirements

| ID  | Requirement                                   | Priority |
| --- | --------------------------------------------- | -------- |
| F1  | Support 2, 3, and 4 player games              | Must     |
| F2  | Real-time multiplayer gameplay                | Must     |
| F3  | Implement all Binokel game rules              | Must     |
| F4  | Web browser support                           | Must     |
| F5  | Android mobile support                        | Should   |
| F6  | Session persistence (rejoin after disconnect) | Must     |
| F7  | Human-readable session codes                  | Should   |

### Game Flow Requirements

| ID  | Requirement                     | Priority |
| --- | ------------------------------- | -------- |
| G1  | Bidding phase with pass option  | Must     |
| G2  | Dabb (extra cards) mechanism    | Must     |
| G3  | Trump suit selection            | Must     |
| G4  | Meld declaration and scoring    | Must     |
| G5  | Trick-taking with Binokel rules | Must     |
| G6  | Score tracking to target (1500) | Must     |

## 1.2 Quality Goals

| Priority | Quality Goal        | Scenario                                              |
| -------- | ------------------- | ----------------------------------------------------- |
| 1        | **Reliability**     | Game state is never lost, even after server restart   |
| 2        | **Responsiveness**  | UI responds to user actions within 100ms              |
| 3        | **Security**        | Players cannot see other players' cards               |
| 4        | **Usability**       | New players can join a game within 30 seconds         |
| 5        | **Maintainability** | New features can be added without changing core logic |

## 1.3 Stakeholders

| Role       | Expectations                                      |
| ---------- | ------------------------------------------------- |
| Players    | Intuitive UI, fast gameplay, reliable connections |
| Developers | Clean code, good documentation, easy local setup  |
| Operators  | Easy deployment, monitoring, scalability          |
