# Changelog

All notable changes to Dabb are documented here.

## [4.3.2] - 2026-08-10

### Behoben

- Ein fertiger Stich verschwand manchmal sofort vom Tisch, wenn die nächste Karte gleich danach gespielt wurde. Jetzt bleibt er immer mindestens eine Sekunde liegen, damit man ihn in Ruhe ansehen kann.

## [4.3.1] - 2026-08-10

### Verbessert

- Dabb lässt sich jetzt über Suchmaschinen finden: Die Seite hat einen aussagekräftigen Titel und eine Beschreibung, und beim Teilen eines Links in Messengern oder sozialen Netzwerken erscheint eine Vorschau mit Namen, Kurzbeschreibung und Logo.

## [4.3.0] - 2026-08-10

### Neu

- Auf den Schwierigkeitsgraden „Einfach“ und „Mittel“ lassen die Computergegner jetzt nach, wenn sie deutlich in Führung liegen: Sie verspielen dann häufiger Stiche, reizen unpassend oder wählen den falschen Trumpf. Je größer der Vorsprung, desto mehr Fehler — bei einem Rückstand spielen sie wieder ganz normal, aber nie besser als der gewählte Schwierigkeitsgrad. Auf „Schwer“ ändert sich nichts.
- Bei vier Spielern zählt dafür der Punktestand des Teams. Der Computer-Partner eines Menschen ist ausgenommen und spielt immer gleich stark — er soll nicht dafür bestraft werden, dass sein eigenes Team führt.

## [4.2.2] - 2026-08-10

### Intern

- Reste der alten React-Native-Version (React Native, Metro und deren Abhängigkeiten) fliegen aus der Installation. Sie wurden nie ausgeliefert, brachten aber zwei als hoch eingestufte Sicherheitsmeldungen mit.

## [4.2.1] - 2026-08-10

### Behoben

- In der Punkteübersicht stehen die Spalten jetzt genau unter ihren Überschriften. Vorher rutschten die Namen in der Kopfzeile nach rechts, je weiter rechts die Spalte stand.

## [4.2.0] - 2026-08-09

### Neu

- Die Punkteleiste oben zeigt jetzt zu jeder Punktzahl den passenden Namen. Bisher standen dort nur nackte Zahlen und man musste die Punkteübersicht öffnen, um zu sehen, wem welche gehört.
- Ein kleines Dreieck markiert, wer die Runde eröffnet, also die erste Karte im ersten Stich spielt.
- Wer gerade am Zug ist, bekommt einen hellen Rahmen um seinen Eintrag in der Punkteleiste.

## [4.1.3] - 2026-08-09

### Behoben

- Auf Handy und Tablet ließen sich Karten nicht mehr nach oben ziehen, um sie zu spielen – der Browser hat die Wischbewegung als Scrollen verstanden und das Ziehen abgebrochen. Karten lassen sich jetzt wieder ganz normal auf den Tisch ziehen.

## [4.1.2] - 2026-08-09

### Behoben

- Der letzte Stich einer Runde verschwand sofort vom Tisch, statt kurz liegen zu bleiben. Man sah nie, welche Karten die Mitspieler gelegt hatten. Jetzt bleibt auch der letzte Stich liegen und wird ganz normal eingesammelt.
- Im Online-Spiel legten die Computergegner ihre Karten ohne jede Pause – bei schneller Verbindung praktisch im selben Moment, in dem man selbst gespielt hatte. Sie lassen sich jetzt genauso viel Zeit wie im Offline-Spiel.
- Nach dem Neuladen einer laufenden Partie wurde ein längst gespielter Stich noch einmal eingesammelt.
- Ein Computergegner konnte in seltenen Fällen aufhören zu spielen und die Partie damit anhalten.

## [4.1.1] - 2026-08-09

### Sonstiges

- Bausteine, aus denen Dabb gebaut wird, auf den aktuellen Stand gebracht. Am Spiel ändert sich nichts.
- Eine Einstellung hielt Dabb auf einer älteren Version der Oberflächen-Bibliothek fest, obwohl längst eine neuere eingetragen war. Sie ist entfernt; künftige Aktualisierungen kommen jetzt auch wirklich an.

## [4.1.0] - 2026-08-09

### Neu

- **Ihr könnt euch am Tisch kurz zu Wort melden.** Neben dem Zahnrad sitzt ein neuer Knopf mit sechs Reaktionen: 😄 freut mich, 👏 gut gespielt, ⏳ ungeduldig, 😠 verärgert, 🤦 Kopf auf den Tisch und 😕 verwirrt. Wer eine auswählt, zeigt sie den anderen zehn Sekunden lang neben seinem Namen. Einen Chat gibt es weiterhin nicht — die sechs Reaktionen sind alles, was gesendet werden kann.
- **Auch KI-Mitspieler reagieren jetzt.** Sie freuen sich über einen fetten Stich, ärgern sich über einen verlorenen und gratulieren, wenn jemand anderes die Runde klar für sich entscheidet. Ein- bis zweimal pro Runde, nicht mehr.

## [4.0.1] - 2026-08-09

### Behoben

- **Beim Drücken seht ihr wieder, dass ihr dran seid.** Seit Trumpf vor dem Ablegen kommt, blieb die Rückmeldung beim Drücken aus — kein Vibrieren, kein Hinweis, dass das Spiel auf euch wartet.
- **Am Ende wird der richtige Sieger genannt.** Erreichen mehrere in derselben Runde die 1000, gewinnt die höchste Punktzahl. Die Schlussmeldung richtete sich stattdessen nach der Sitzreihenfolge und gratulierte dadurch mitunter dem Falschen — im Punktestand stand die ganze Zeit das Richtige.
- **Die Spielstärke der KI wirkt sich in Online-Runden wieder aus.** Ihr konntet zwischen leicht, mittel und schwer wählen, gespielt hat die KI aber immer auf mittel. Ihr könnt jetzt auch verschiedene Stärken an einem Tisch mischen; neben jedem KI-Mitspieler steht, wie stark er eingestellt ist. Offline-Spiele waren nie betroffen.
- **Ihr seht wieder, wenn ein Mitspieler die Verbindung verliert.** Der Hinweis "(offline)" neben dem Namen konnte nie erscheinen. Wer das Spiel noch gar nicht geöffnet hat, wird ebenfalls als offline angezeigt.
- **Fehlermeldungen beim Beitreten sind wieder lesbar.** Bei einem falsch eingetippten Spielcode stand dort "SESSION_NOT_FOUND" statt "Sitzung nicht gefunden".
- **Beendet jemand die Runde, sagt Dabb das auch dann, wenn der Name unbekannt ist.** Vorher blieb in diesem Fall die Meldung "Verbindung wird wiederhergestellt" stehen, obwohl das Spiel schon vorbei war.
- **KI-Mitspieler bekommen keine doppelten Namen mehr.** Über mehrere Runden hinweg konnte derselbe Name zweimal am Tisch landen.

### Sonstiges

- Große Aufräumaktion unter der Haube: Die Spielregeln — Punkte zählen, Runden abschließen, Züge prüfen — lagen in drei getrennten Kopien für Online-, Offline- und Testspiele vor und waren mit der Zeit auseinandergelaufen. Sie stehen jetzt an einer Stelle, die alle drei benutzen. Am Spiel selbst ändert sich dadurch nichts, aber Regelfehler wie die oben behobenen können nicht mehr nur eine der drei Varianten betreffen. Insgesamt rund 1000 Zeilen weniger Code.

## [4.0.0] - 2026-08-09

### Breaking Changes

- **Bitte alle Mitspieler die Seite neu laden lassen, bevor ihr eine neue Runde startet.** Der Reizgewinner sagt jetzt zuerst Trumpf an und drückt erst danach — der Ablauf einer Runde hat sich also geändert. Wer noch die alte Version im Browser hat, kann einer Runde aus der neuen Version nicht mehr folgen. Dabb fragt beim Start selbst nach, sobald eine neue Version bereitsteht; ein laufendes Spiel solltet ihr vorher zu Ende spielen. Auch ein gespeichertes Offline-Spiel aus der alten Version lässt sich nicht fortsetzen — startet es bitte neu.

### Neues

- **Trumpf ansagen kommt jetzt vor dem Drücken.** Der Reizgewinner nimmt den Dabb, sagt Trumpf an und legt erst dann vier Karten ab. So ist das Drücken eine echte Entscheidung: Ihr wisst beim Ablegen, was Trumpf ist.
- **Gedrückte Trümpfe werden angesagt.** Wer beim Drücken einen Trumpf wegwirft, muss das ansagen — im Spielverlauf steht dann zum Beispiel "Anna legt Herz-Ass ab (Trumpf)". Die übrigen abgelegten Karten bleiben wie bisher verdeckt.
- **Die Regelseite erklärt jetzt auch das Zählen.** Neu dazugekommen sind die Abschnitte "Punkte" und "Abgehen": Was die gedrückten Karten und der letzte Stich bringen, was ein verfehltes Gebot kostet und was beim Abgehen passiert.

### Behoben

- **Ein verfehltes Gebot ist im Punktestand nachvollziehbar.** Die Rundenübersicht zeigte Meldungen und Stiche an und darunter eine Zahl, die zu beidem nicht passte. Jetzt steht dort, woher sie kommt: "Gebot 160 × 2".
- **Die Kartenzahl des Reizgewinners stimmt wieder.** Für die Mitspieler sah es so aus, als behalte er den Dabb die ganze Runde über auf der Hand — bei zwei Spielern also 22 statt 18 Karten.
- **Gleichstand beim Sieg geht an den Reizgewinner.** Erreichen mehrere in derselben Runde die 1000 und stehen exakt gleich, gewinnt jetzt, wer gereizt hat — vorher entschied schlicht die Sitzreihenfolge.
- **Meldungen lassen sich nicht mehr fälschen.** Was gemeldet wird, ermittelt das Spiel jetzt selbst aus der Hand, statt es vom Client entgegenzunehmen.
- Abgehen fragt nicht mehr nach einer Farbe — Trumpf ist zu diesem Zeitpunkt bereits angesagt.

### Sonstiges

- Die Regeln, nach denen Dabb rechnet, stehen jetzt vollständig in der README: Kartenverteilung je Spielerzahl, Reizen, Punkte, Abgehen und welche Karten in mehreren Meldungen zählen dürfen.

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
