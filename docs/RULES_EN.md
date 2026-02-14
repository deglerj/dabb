# Binokel Rules

Binokel is a traditional Swabian card game that combines bidding, melding, and trick-taking. This page explains the rules as implemented in Dabb.

## Players

2, 3, or 4 players. In a 4-player game, players sitting across from each other form a team.

## The Deck

Binokel uses a 40-card deck with **two copies** of each card (8 unique cards per suit).

**Suits:** Kreuz (clubs), Schippe (spades), Herz (hearts), Bollen (diamonds)

**Ranks (from weakest to strongest):**

| Rank  | Strength | Points |
| ----- | -------- | ------ |
| Buabe | 1        | 2      |
| Ober  | 2        | 3      |
| König | 3        | 4      |
| Zehn  | 4        | 10     |
| Ass   | 5        | 11     |

Note: The Zehn is stronger than the König, even though it is a "lower" face value.

## Dealing

Cards are dealt to all players and 4 cards go face-down into the **Dabb** (a kitty/talon). The number of cards per player depends on the player count:

| Players | Cards each | Dabb |
| ------- | ---------- | ---- |
| 2       | 18         | 4    |
| 3       | 12         | 4    |
| 4       | 9          | 4    |

The dealer rotates clockwise each round.

## Bidding

The player after the dealer starts the bidding. Players bid in increments of 10, starting at a minimum of **150**. The first bidder **must** bid (they cannot pass without bidding first). All other players may bid higher or pass. The last remaining bidder wins and earns the right to:

1. Take the Dabb
2. Choose the trump suit

## The Dabb

The bid winner picks up the 4 Dabb cards, adds them to their hand, and then discards exactly 4 cards face-down. Discarded cards count toward the bid winner's trick points at the end of the round.

### Going Out (Abgehen)

After taking the Dabb, if the bid winner doesn't think they can make their bid, they can choose to **go out** instead of continuing:

- They choose a trump suit to "go out in"
- The **bid winner loses** points equal to their bid
- All **opponents get** their melds + 40 bonus points each
- The round ends immediately (no tricks are played)

## Declaring Trump

After discarding, the bid winner declares one of the four suits as **trump**. Trump cards are stronger than all non-trump cards during tricks.

## Melding

All players now declare their **melds** (valuable card combinations). Meld points are added to each player's score for the round.

| Meld           | Cards                                         | Points             |
| -------------- | --------------------------------------------- | ------------------ |
| Paar           | König + Ober of the same suit                 | 20 (40 in trump)   |
| Familie        | Ass + Zehn + König + Ober + Buabe of one suit | 100 (150 in trump) |
| Binokel        | Ober of Schippe + Buabe of Bollen             | 40                 |
| Doppel-Binokel | Both Ober of Schippe + both Buabe of Bollen   | 300                |
| Vier Asse      | One Ass from each suit                        | 100                |
| Vier Könige    | One König from each suit                      | 80                 |
| Vier Ober      | One Ober from each suit                       | 60                 |
| Vier Buaben    | One Buabe from each suit                      | 40                 |

**Double melds** (all 8 cards of a rank): Acht Asse (1000), Acht Könige (600), Acht Ober (400), Acht Buaben (200).

Cards used in a Familie cannot also count toward a Paar in the same suit.

## Tricks

The player after the dealer leads the first trick (not the bid winner). Players take turns playing one card each. The following rules apply strictly:

1. **Must follow suit** — If you have cards of the led suit, you must play one
2. **Must beat** — If following suit, you must play a card that beats the current highest card of that suit, if you can
3. **Must trump** — If you cannot follow suit, you must play a trump card if you have one
4. **Must beat trump** — If trumping, you must beat the highest trump already played, if you can
5. **Any card** — Only if you can neither follow suit nor trump, you may play any card

The highest card wins the trick. Trump always beats non-trump. Within the same suit, the card with the higher strength wins. The trick winner leads the next trick.

## Scoring

After all tricks are played, each player's round score is: **meld points + trick points**.

The bid winner **must** reach at least their bid amount with their combined melds and tricks (including discarded cards). If they fall short, they lose points equal to their bid instead of gaining any.

## Winning

The first player (or team) to reach **1000 points** wins the game.
