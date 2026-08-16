/**
 * Game rules markdown content, exported as string constants.
 * This is the single source of truth for the rules content.
 */

import type { SupportedLanguage } from './types.js';

export const rulesDE = `# Binokel Regeln

Binokel ist ein traditionelles schwäbisches Kartenspiel, das Reizen, Melden und Stiche miteinander verbindet. Hier werden die Regeln erklärt, wie sie in Dabb umgesetzt sind.

## Spieler

2, 3 oder 4 Spieler. Bei 4 Spielern bilden die gegenübersitzenden Spieler ein Team.

## Das Blatt

Binokel verwendet ein 40-Karten-Blatt mit **zwei Exemplaren** jeder Karte (8 verschiedene Karten pro Farbe).

**Farben:** Kreuz, Schippe, Herz, Bollen

**Ränge (vom schwächsten zum stärksten):**

| Rang  | Stärke | Punkte |
| ----- | ------ | ------ |
| Buabe | 1      | 2      |
| Ober  | 2      | 3      |
| König | 3      | 4      |
| Zehn  | 4      | 10     |
| Ass   | 5      | 11     |

Achtung: Die Zehn ist stärker als der König, obwohl sie einen "niedrigeren" Nennwert hat.

## Geben

Die Karten werden an alle Spieler verteilt. 4 Karten gehen verdeckt in den **Dabb** — sie werden aufgedeckt, sobald das Reizen entschieden ist, und der ganze Tisch sieht sie. Die Anzahl der Karten pro Spieler hängt von der Spielerzahl ab:

| Spieler | Karten | Dabb |
| ------- | ------ | ---- |
| 2       | 18     | 4    |
| 3       | 12     | 4    |
| 4       | 9      | 4    |

Der Geber wechselt jede Runde im Uhrzeigersinn.

## Reizen

Der Spieler nach dem Geber beginnt das Reizen. Geboten wird in 10er-Schritten, ab mindestens **150**. Der erste Bieter **muss** bieten (er darf nicht direkt passen). Alle anderen Spieler können höher bieten oder passen. Der letzte verbleibende Bieter gewinnt und darf:

1. Den Dabb aufnehmen
2. Die Trumpffarbe bestimmen
3. Vier Karten abdrücken

## Der Dabb

Der Reizgewinner nimmt die 4 Dabb-Karten offen auf die Hand — alle am Tisch haben sie gesehen — und drückt anschließend genau 4 Karten verdeckt ab. Die abgedrückten Karten zählen am Ende der Runde zu den Stichpunkten des Reizgewinners.

## Trumpf ansagen

**Vor** dem Abdrücken bestimmt der Reizgewinner eine der vier Farben als **Trumpf**. Trumpfkarten stechen im Stich alle Nicht-Trumpf-Karten. Weil Trumpf zuerst feststeht, ist es eine echte Entscheidung, einen Trumpf abzudrücken — ein abgedrückter Trumpf muss angesagt werden und erscheint im Spielverlauf.

### Abgehen

Hat der Reizgewinner nach Dabb und Trumpfansage das Gefühl, sein Gebot nicht erreichen zu können, darf er **abgehen** statt abzudrücken:

- Der **Reizgewinner verliert** Punkte in Höhe seines Gebots (einfach, nicht doppelt)
- Die **Gegenseite erhält** ihre Meldpunkte + 40 Bonuspunkte; zu viert bekommt das gegnerische Team die 40 einmal
- Die Runde endet sofort (es werden keine Stiche gespielt)

## Melden

Alle Spieler melden nun ihre **Kombinationen**. Meldpunkte werden zum Rundenergebnis jedes Spielers addiert.

| Meld           | Karten                                        | Punkte              |
| -------------- | --------------------------------------------- | ------------------- |
| Paar           | König + Ober derselben Farbe                  | 20 (40 in Trumpf)   |
| Familie        | Ass + Zehn + König + Ober + Buabe einer Farbe | 100 (150 in Trumpf) |
| Binokel        | Schippe-Ober + Bollen-Buabe                   | 40                  |
| Doppel-Binokel | Beide Schippe-Ober + beide Bollen-Buaben      | 300                 |
| Vier Asse      | Je ein Ass aus jeder Farbe                    | 100                 |
| Vier Könige    | Je ein König aus jeder Farbe                  | 80                  |
| Vier Ober      | Je ein Ober aus jeder Farbe                   | 60                  |
| Vier Buaben    | Je ein Buabe aus jeder Farbe                  | 40                  |

Karten, die in einer Familie verwendet werden, zählen nicht gleichzeitig als Paar derselben Farbe. Sonst darf eine Karte in mehreren _verschiedenen_ Meldungen zählen — der Kreuz-König zahlt im Kreuz-Paar und in Vier Könige.

Hat man eine Meldung doppelt, zählt sie doppelt: alle acht Asse sind zwei Mal Vier Asse (200), beide Familien einer Farbe geben 200 (300 in Trumpf). Das Doppel-Binokel ist die Ausnahme — es **ersetzt** das einfache Binokel und gibt 300, nicht 340.

## Stiche

Der Spieler nach dem Geber spielt die erste Karte aus (nicht der Reizgewinner). Die Spieler legen reihum je eine Karte. Es gelten folgende Regeln:

1. **Farbzwang** — Wer Karten der ausgespielten Farbe hat, muss bedienen
2. **Stichzwang** — Beim Bedienen muss die höchste bereits gespielte Karte der Farbe überboten werden, wenn möglich
3. **Trumpfzwang** — Wer nicht bedienen kann, muss Trumpf spielen, wenn vorhanden
4. **Trumpf überbieten** — Beim Trumpfen muss der höchste bereits gespielte Trumpf überboten werden, wenn möglich
5. **Freie Wahl** — Nur wer weder bedienen noch trumpfen kann, darf eine beliebige Karte spielen

**Partnerausnahme (nur zu viert):** Sticht der eigene Partner gerade, entfallen die Regeln 2 bis 4 — der Stich gehört ohnehin dem eigenen Team. Man muss den Partner also weder überbieten noch für ihn trumpfen. Bedient werden muss trotzdem (Regel 1). So kann man dem Partner hohe Karten **schmieren**, statt ihm den Stich wegzunehmen.

Die höchste Karte gewinnt den Stich. Trumpf sticht immer Nicht-Trumpf. Innerhalb derselben Farbe gewinnt die Karte mit der höheren Stärke. Der Stichgewinner spielt zum nächsten Stich aus.

## Wertung

Nach allen Stichen ergibt sich das Rundenergebnis jedes Spielers aus: **Meldpunkte + Stichpunkte**. Der letzte Stich bringt 10 Punkte extra.

Der Reizgewinner **muss** mit Meld- und Stichpunkten (inkl. abgedrückter Karten) mindestens sein Gebot erreichen. Schafft er das nicht, bekommt er für die Runde nichts und ihm werden **das Doppelte seines Gebots** abgezogen. Genau deshalb lohnt sich das Abgehen: dort kostet es nur das einfache Gebot.

**Kein Stich, keine Meldung:** Wer in einer Runde keinen einzigen Stich macht, verliert seine Meldpunkte für diese Runde. Zu viert gilt das pro Team — macht der Partner einen Stich, zählen beide Meldungen. Die abgedrückten Karten des Reizgewinners sind kein Stich.

## Spielende

Gewonnen hat, wer **1000 Punkte** erreicht. Da jeder seine eigenen Meld- und Stichpunkte schreibt, können mehrere in derselben Runde über die 1000 kommen — dann gewinnt die höchste Punktzahl, und bei exaktem Gleichstand der Reizgewinner.`;

export const rulesEN = `# Binokel Rules

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

Cards are dealt to all players and 4 cards go face-down into the **Dabb** (a kitty/talon) — they are turned face up for the whole table once the bidding is settled. The number of cards per player depends on the player count:

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
3. Lay four cards away

## The Dabb

The bid winner picks up the 4 Dabb cards face up — the whole table has seen them — adds them to their hand, and then discards exactly 4 cards face-down. Discarded cards count toward the bid winner's trick points at the end of the round.

## Declaring Trump

**Before** laying away, the bid winner declares one of the four suits as **trump**. Trump cards are stronger than all non-trump cards during tricks. Because trump is settled first, burying a trump card is a real decision — and it has to be announced, so every trump laid away shows up in the game log.

### Going Out (Abgehen)

After taking the Dabb and declaring trump, if the bid winner doesn't think they can make their bid, they can choose to **go out** instead of laying away:

- The **bid winner loses** points equal to their bid (once, not twice)
- The **opposition gets** their melds + 40 bonus points; with 4 players the opposing team collects the 40 once
- The round ends immediately (no tricks are played)

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

Cards used in a Familie cannot also count toward a Paar in the same suit. Otherwise a card may count in several _different_ melds — the König of Kreuz pays in a Kreuz-Paar and in Vier Könige.

Hold a meld twice and it counts twice: all eight Asse are two Vier Asse (200), and both Familien of one suit score 200 (300 in trump). The Doppel-Binokel is the exception — it **replaces** the single Binokel and scores 300, not 340.

## Tricks

The player after the dealer leads the first trick (not the bid winner). Players take turns playing one card each. The following rules apply strictly:

1. **Must follow suit** — If you have cards of the led suit, you must play one
2. **Must beat** — If following suit, you must play a card that beats the current highest card of that suit, if you can
3. **Must trump** — If you cannot follow suit, you must play a trump card if you have one
4. **Must beat trump** — If trumping, you must beat the highest trump already played, if you can
5. **Any card** — Only if you can neither follow suit nor trump, you may play any card

**Partner exemption (4-player games only):** if your own partner is currently winning the trick, rules 2 to 4 are lifted — the trick already belongs to your team. You need neither overtake your partner nor spend a trump on them. You must still follow suit (rule 1). This lets you **smear** high-value cards onto your partner's trick instead of taking it from them.

The highest card wins the trick. Trump always beats non-trump. Within the same suit, the card with the higher strength wins. The trick winner leads the next trick.

## Scoring

After all tricks are played, each player's round score is: **meld points + trick points**. The last trick is worth 10 extra.

The bid winner **must** reach at least their bid amount with their combined melds and tricks (including discarded cards). If they fall short, they score nothing for the round and lose **twice their bid** — which is exactly why going out, at once the bid, is worth choosing.

**No trick, no melds:** A player who wins no trick at all in a round forfeits their meld points for that round. In 4-player games this counts per team — if your partner wins a trick, both players' melds count. The bid winner's discarded cards are not a trick.

## Winning

Reaching **1000 points** wins the game. Since everyone scores their own melds and tricks, several players can cross 1000 in the same round — the highest total takes it, and on an exact tie the bid winner wins.`;

const rulesMap: Record<SupportedLanguage, string> = {
  de: rulesDE,
  en: rulesEN,
};

export function getRulesMarkdown(lang: SupportedLanguage): string {
  return rulesMap[lang] ?? rulesDE;
}
