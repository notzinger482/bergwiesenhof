# Bestellsystem Bergwiesenhof – Tablet-App

Version 1.9.1 · für Samsung Galaxy Tab A 10.5 (SM-T590) mit Chrome

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
| Bestellformular A4/A5, Infozettel (PDF) | **Übersicht → Vordrucke drucken** (Preise automatisch aus der Preisliste) |
| Mappe zurücksetzen | **Einstellungen → Daten & Sicherung** (ein „Neues Jahr“ gibt es nicht mehr – Bestellungen laufen über den Jahreswechsel einfach weiter) |

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

**Verschlüsselt (ab 1.9.0):** Alle Sicherungen, die das Tablet verlassen (Google Drive, „Sicherung teilen“, „als Datei speichern“),
werden mit dem **Sicherungs-Passwort** verschlüsselt (AES-256, Einstellungen → Daten & Sicherung). Das Passwort liegt nur auf dem
Tablet und gehört aufgeschrieben – ohne es lässt sich keine Sicherung einspielen. Ohne Passwort wird nichts gesichert.

**Automatisch in Google Drive:** Sobald das Tablet Internet hat und die App offen ist, sichert sie bei Änderungen
(höchstens 1× pro Stunde) in den Drive-Ordner **„Bergwiesenhof“**. Dafür läuft in deinem Google-Konto das kleine
Skript `Google-Sicherung\Code.gs` (Einrichtung siehe Anleitung im Chat). Aufgeräumt wird automatisch:
die neuesten 30 Sicherungen bleiben, davor eine pro Tag für 90 Tage.

**Von Hand:** Einstellungen → Daten & Sicherung → „Sicherung teilen“ (z. B. Gmail an dich selbst).
Zusätzlich legt die App selbst eine Tageskopie der letzten 14 Tage auf dem Tablet an.

**Wiederherstellen:** Sicherungsdatei aus Drive aufs Tablet laden → Einstellungen → „Sicherung einspielen“ (fragt nach dem Passwort, mit dem die Datei erstellt wurde).

## Datenschutz

Kunden: nur Name, Telefon, Mail und eine kurze Notiz (keine Gesundheitsangaben). Kunden ohne Bestellung seit der Frist (Standard 3 Jahre)
werden unter Einstellungen → Daten & Sicherung anonymisiert; die Übersicht erinnert daran. Der Metzgerauftrag enthält nur Bestell-Nummern.
Kopien vor Import/Zurücksetzen werden nach 30 Tagen vom Tablet gelöscht.

## Updates

Neue Dateien auf den Webspeicher legen und in `sw.js` die Zeile `VERSION` hochzählen.
Beim nächsten Öffnen im WLAN meldet die App „Neue Version“. Die Daten bleiben erhalten.

## Dateien

`index.html`, `app.css`, `app.js`, `views2.js` (Oberfläche) · `logic.js` (Rechenregeln aus Excel/VBA) ·
`store.js` (Speicher, Sicherung, Excel-Export) · `docs.js` (Unterlagen als Bild/Druck) · `defaults.js` (Startwerte) ·
`sw.js`, `manifest.webmanifest`, Icons (Offline-Installation)
