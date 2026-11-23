# Bestellsystem Bergwiesenhof – Tablet-App

Version 1.0.0 · für Samsung Galaxy Tab A 10.5 (SM-T590) mit Chrome

Die App ersetzt die Excel-Datei mit allen Makros. Sie läuft nach der Installation **komplett offline**.
Internet braucht es nur zum Teilen (WhatsApp, Mail), für die Datensicherung in die Cloud und für Updates.

## Was drin ist

| Excel / Makro | in der App |
|---|---|
| Eingabefenster (Strg+Umschalt+B) | **+ Bestellung** (Kunde, Tier, Pakete, Einzelartikel mit Anzahl × g, am Stück, vakuumieren, Sonderwünsche, Tüten) |
| Bestellungen, Kunden, Sonderwünsche, Portionen | **Bestellungen**, **Kunden** (Suche, Statistik, „letzte Bestellung übernehmen“) |
| Tier-Fenster (Strg+Umschalt+T), Warteliste | **Tiere** |
| Mengenprüfung, Metzgerauftrag | **Schlachttag** → Mengenprüfung / Metzgerauftrag (als Bild an WhatsApp) |
| Makro Packplan, Blatt Auto | **Schlachttag** → Packplan (mit Draufsicht und Einladereihenfolge) → „In Kisten übernehmen“ |
| Kisten, Tier abgeschlossen | **Schlachttag** → Kisten |
| Hackfleisch-Zettel, Innereien, Packliste Kühlhaus | **Schlachttag** → je ein Reiter (teilen oder drucken) |
| Kommissionierung | **Kommissionieren** – „aus Kiste 3 → 2,0 kg Braten“, antippen wenn erledigt |
| Hofladen | **Hofladen** |
| Preisliste, Ausbeute, Auto | **Einstellungen** |
| Neues Jahr, Mappe zurücksetzen | **Einstellungen → Daten & Sicherung** |

Preise, Ausbeute-Anteile, Stückgewichte, Beutelgrößen und Stellplätze sind aus `Bestellsystem_Bergwiesenhof.xlsm` übernommen.

## Installation (einmalig)

Damit Android eine App offline speichert, muss sie **einmal über eine https-Adresse** geladen werden.
Eine Datei direkt vom Tablet-Speicher öffnen reicht dafür nicht.

1. Den Ordner `Tablet-App` auf einen kostenlosen Webspeicher legen, z. B. **GitHub Pages**.
   (Die Adresse sieht dann etwa so aus: `https://<name>.github.io/bergwiesenhof/`.)
2. Auf dem Tablet in **Chrome** diese Adresse öffnen.
3. Menü ⋮ → **„Zum Startbildschirm hinzufügen“** bzw. **„App installieren“**.
4. Ab jetzt die App über das Kuh-Symbol auf dem Startbildschirm öffnen. Sie funktioniert ohne Internet.

Die Daten (Bestellungen, Kunden …) liegen **nur auf dem Tablet**, nicht auf dem Webspeicher.

## Datensicherung

**Einstellungen → Daten & Sicherung → „Sicherung teilen“** (zu Hause im WLAN) → z. B. OneDrive, Google Drive oder Mail an dich selbst.
Bitte jede Woche machen. Die App erinnert, wenn die letzte Sicherung älter als 7 Tage ist.
Zusätzlich legt die App selbst eine Tageskopie der letzten 14 Tage auf dem Tablet an.

Mit **„Sicherung einspielen“** lässt sich alles wiederherstellen, z. B. auf einem neuen Tablet.

## Updates

Neue Dateien auf den Webspeicher legen und in `sw.js` die Zeile `VERSION` hochzählen.
Beim nächsten Öffnen im WLAN meldet die App „Neue Version“. Die Daten bleiben erhalten.

## Dateien

`index.html`, `app.css`, `app.js`, `views2.js` (Oberfläche) · `logic.js` (Rechenregeln aus Excel/VBA) ·
`store.js` (Speicher, Sicherung, Excel-Export) · `docs.js` (Unterlagen als Bild/Druck) · `defaults.js` (Startwerte) ·
`sw.js`, `manifest.webmanifest`, Icons (Offline-Installation)
