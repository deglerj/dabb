# ADR 004: Use Swabian German Terminology

## Status

Accepted

## Context

Binokel is a traditional Swabian card game. We need to decide on the terminology for suits and ranks.

## Decision

We will use **Swabian German terminology** for authenticity:

### Suits

| English  | Standard German | Swabian (Our Choice) |
| -------- | --------------- | -------------------- |
| Clubs    | Kreuz/Eichel    | **Kreuz**            |
| Spades   | Pik/Blatt       | **Schippe**          |
| Hearts   | Herz            | **Herz**             |
| Diamonds | Karo/Schell     | **Bollen**           |

### Ranks

| English    | Standard German | Swabian (Our Choice) |
| ---------- | --------------- | -------------------- |
| Ace        | Ass             | **Ass**              |
| Ten        | Zehn            | **Zehn**             |
| King       | König           | **König**            |
| Over/Queen | Ober/Dame       | **Ober**             |
| Under/Jack | Unter/Bube      | **Buabe**            |

## Consequences

### Positive

- **Authenticity**: True to Swabian tradition
- **Regional Appeal**: Familiar to Swabian players
- **Distinction**: Sets apart from standard implementations

### Negative

- **Accessibility**: May confuse non-Swabian players
- **Translation**: Harder to internationalize
- **Documentation**: Need to explain terms

## Notes

- "Buabe" is Swabian dialect for "Buben" (boys/jacks)
- "Schippe" is Swabian dialect for "Schaufel" (shovel/spade)
- "Bollen" means balls/bells in Swabian
