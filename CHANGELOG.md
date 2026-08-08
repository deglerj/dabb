# Changelog

All notable changes to Dabb are documented here.

## [3.1.0] - 2026-08-08

### Neues

- **Partnerausnahme zu viert**: Sticht euer Partner gerade, müsst ihr ihn nicht mehr überbieten und auch nicht für ihn trumpfen. Bedient werden muss weiterhin. So könnt ihr dem Partner hohe Karten **schmieren**, statt ihm den eigenen Stich wegzunehmen. Die Kartenauswahl am Tisch zeigt die zusätzlich erlaubten Karten automatisch an, und die KI spielt entsprechend mit. Nachzulesen unter "Regeln".

### Behoben

- **Spiele zu viert funktionieren wieder.** Bisher blieb die Punktzahl beider Teams dauerhaft bei 0 stehen, das Reizen hatte keine Folgen und kein Spiel konnte je gewonnen werden.
- **Teams stehen sich jetzt gegenüber.** Wie es die Regeln vorsehen, bilden die gegenübersitzenden Spieler ein Team — vorher wurden die Teams zufällig ausgelost. Am Tisch zeigt ein 🤝 neben dem Namen, wer mit euch zusammenspielt, und die Anzeige oben nennt beide Teams mit Namen und Punktestand.
- **Abgehen zu viert beendet die Runde wieder.** Vorher lief das Spiel danach in die Stichphase weiter und blieb dort hängen.
- **KI-Mitspieler in Online-Runden spielen wieder mit.** Sie haben bisher weder gereizt, den Dabb genommen, Trumpf angesagt noch gemeldet — eine Runde mit KI-Spielern kam gar nicht erst über das Reizen hinaus.
- **Abgedrückte Karten zählen wieder.** Die vier Karten, die der Reizgewinner nach dem Dabb ablegt, gingen beim Start der Stichphase verloren, statt zu seinen Stichpunkten zu zählen.
- **Genauere Punkte zu viert.** Die Stichpunkte eines Teams werden jetzt einmal am Ende gerundet statt für jeden Spieler einzeln — das konnte pro Runde bis zu 20 Punkte zu viel ergeben.
- Die KI spielt ihrem Partner wieder Punkte zu, wenn er den Stich ohnehin gewinnt.
- Die Meldungs-Anzeige verschwindet jetzt, sobald ihr eure Meldungen bestätigt habt, statt bis zum Ende der Meldephase stehen zu bleiben. Wer abgeht, wird nicht mehr zum Melden aufgefordert.

## [3.0.0] - 2026-08-08

### Breaking Changes

- **Die Android-App wird eingestellt.** Dabb läuft ab sofort ausschließlich im Browser — als installierbare Web-App (PWA). Die bestehende Android-App aus dem Play Store funktioniert vorerst weiter, wird aber nicht mehr aktualisiert. Bitte wechselt auf die Web-Version unter [dabb.degler.info](https://dabb.degler.info).

### Neues

- **Installierbar wie eine App**: Dabb lässt sich jetzt auf dem Homescreen installieren — auf Android über das Chrome-Menü (⋮) → "Zum Startbildschirm hinzufügen", auf dem iPhone über das Teilen-Symbol in Safari → "Zum Home-Bildschirm". Danach startet Dabb im Vollbild wie eine echte App.
- **Schnellerer Start**: Die Seite lädt jetzt deutlich schneller, besonders beim ersten Besuch.
- Beim Erscheinen einer neuen Version fragt Dabb künftig nach, bevor sie geladen wird — laufende Spiele werden dadurch nicht mehr unterbrochen.

### Sonstiges

- Zahlreiche interne Umbauten unter der Haube (Technologie-Wechsel des gesamten Clients), ohne Auswirkung auf das Spielerlebnis.

## [2.2.1] - 2026-07-05

### Fehlerbehebungen

- Build-Fehler behoben, der Updates verzögert hätte

## [2.2.0] - 2026-06-28

### Verbesserungen

- Abhängigkeiten aktualisiert für mehr Stabilität und Sicherheit

## [2.1.0] - 2026-04-14

### Neues

- **Lokal gegen KI**: Spiele Binokel offline gegen KI-Gegner — kein Internet nötig. Wähle Spieleranzahl und Schwierigkeit. Das Spiel wird automatisch gespeichert und kann jederzeit fortgesetzt werden.

## [2.0.0] - 2026-03-14

### Breaking Changes

- **Users must update the app** to continue playing. This release replaces the separate web and mobile apps with a single unified Expo client (Android, iOS, web).

### New Features

- Unified app: one app runs on Android, iOS, and web instead of two separate apps
- New Skia-powered card table with smooth animations and a felt-textured game board
- Animated card dealing and trick sweeping
- Bidding, melding, Dabb, and trump selection shown in elegant overlay panels
- Face cards (König, Ober, Buabe) now display with distinct colored markings

## [1.0.0] - 2026-02-21

First public release of Dabb! Create a lobby, invite friends, and play Binokel together online.
