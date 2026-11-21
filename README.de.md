# Trainingsplan

[English](README.md) | **Deutsch**

Ein persönlicher Heimtrainingsplan als kleine Web-App – mit eingebauten Timern, Übungsbildern und voller Offline-Unterstützung auf dem iPhone.

**Live:** https://davekrn.github.io/trainingsplan/

> Die Inhalte sind auf Deutsch und auf meine eigenen Ziele und meine Ausrüstung zugeschnitten (Fettabbau bei Muskelerhalt/-aufbau, dazu eine Mobilitätsroutine für Vielsitzer). Gerne umschauen oder für sich anpassen – keine medizinische Beratung.

## Funktionen

- **Wochenplan:** 6 Trainingstage + 1 Ruhetag, ca. 30 Minuten pro Einheit, an vier Tagen mit einer Mobilitätsroutine von 10–12 Minuten
- **Timer für jede Übung:** Sätze mit Pause, Halteübungen (mit Seitenwechsel), Intervalle und feste Dauer – inklusive Vorlaufzeit, Signaltönen und automatischem Wechsel zur nächsten Übung
- **Anpassbare Zeiten:** −/+ pro Übung; die Einstellung bleibt auf dem Gerät gespeichert
- **Bildschirm bleibt an** während des Trainings
- **Bilder:** einfache Strichfiguren zu jeder Übung
- **Druckansicht:** saubere Druckfassung über die Druckfunktion des Browsers
- **History:** am Ende jedes Tages „Training erledigt“ antippen; der Tab *History* zeigt pro Woche eine Zeile (z. B. `W647` = Kalenderwoche 47/2026 nach ISO), neueste oben, mit Export/Import als JSON-Sicherungsdatei

## Technik

Reines HTML, CSS und JavaScript – kein Framework, kein Build-Schritt, kein serverseitiger Code.

| Datei | Zweck |
|---|---|
| `index.html` | Seitengerüst |
| `app.js` | Darstellung, Timer, Töne (Web Audio API), Bildschirm-Wachhaltung |
| `style.css` | Layout inkl. `@media print` für die Druckansicht |
| `plan.json` | **Alle Inhalte und Timer-Einstellungen** – die einzige Datei, die für Planänderungen bearbeitet wird |
| `sw.js` | Service Worker für den Offline-Betrieb |
| `manifest.json`, `icon.png` | Web-App-Manifest (Name, Symbol, Vollbildstart) |
| `nosleep.mp4` | Rückfallebene, damit der Bildschirm bei älteren iOS-Versionen an bleibt |
| `README.md`, `README.de.md` | Dieser Text (Englisch/Deutsch), auch im Tab „About“ |
| `Bilder/` | Übungsbilder |

Kostenlos gehostet auf **GitHub Pages**, direkt aus diesem Repository.

## Offline-Funktion

Die Seite ist eine **Progressive Web App (PWA)**. Einmal mit Internetverbindung geöffnet, funktioniert sie komplett ohne Netz – z. B. im Keller oder in einem Gartenraum ohne WLAN.

**So funktioniert es**

- Beim ersten Besuch installiert der Browser den **Service Worker** (`sw.js`).
- Dieser speichert alle App-Dateien *und* jedes in `plan.json` verwendete Bild im **Cache Storage** des Browsers.
- Danach wird jede Anfrage zuerst aus diesem lokalen Speicher beantwortet („cache first“); das Netz wird nur für noch nicht gespeicherte Dateien verwendet.
- Persönliche Timer-Anpassungen und die Trainings-History liegen im `localStorage` des Browsers. Die App bittet den Browser um dauerhafte Speicherung, die Daten bleiben aber auf dem jeweiligen Gerät (Home-Bildschirm-App und Safari speichern getrennt) – zur Sicherung *History → Exportieren* verwenden.

**Auf dem iPhone verwenden**

1. https://davekrn.github.io/trainingsplan/ in **Safari** öffnen.
2. **Teilen → Zum Home-Bildschirm** tippen.
3. Die App über das neue Symbol auf dem Home-Bildschirm starten. Sie öffnet sich im Vollbild wie eine native App und funktioniert offline.

Auf Android bietet Chrome im Menü *App installieren* / *Zum Startbildschirm hinzufügen*; am Computer zeigen Chrome und Edge ein Installationssymbol in der Adressleiste.

## Updates veröffentlichen

Der Speicher wird nur erneuert, wenn sich der Service Worker ändert. Deshalb bei jedem Update:

1. Dateien bearbeiten (meist nur `plan.json`).
2. `VERSION` in `sw.js` erhöhen (z. B. `tp-7` → `tp-8`).
3. Geänderte Dateien in dieses Repository hochladen (*Add file → Upload files → Commit changes*).
4. 1–2 Minuten auf GitHub Pages warten, dann die App einmal **mit** Verbindung öffnen, schliessen und neu öffnen.

## Für sich anpassen

Repository forken, GitHub Pages aktivieren (*Settings → Pages → Deploy from branch: main*) und `plan.json` bearbeiten. Übungen, Texte, Bilder und Timer-Arten (`sets`, `hold`, `interval`, `duration`) sind alle dort definiert.
