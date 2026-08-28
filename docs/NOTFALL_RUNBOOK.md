# Notfall-Runbook & Papier-Notbetrieb

Dieses Dokument beschreibt die betrieblichen Abläufe, wenn auf einer Großveranstaltung unvorhergesehene Totalausfälle (z. B. langanhaltender Stromausfall des gesamten Geländes) eintreten.

---

## 🛑 Stufenplan bei Störungen

```
Stufe 1: WLAN-Ausfall              ──► Kein Problem: Tablets arbeiten im Offline-First Modus weiter
Stufe 2: Drucker-Ausfall           ──► Bonkasse schaltet auf Virtuellen Drucker / Küchendisplay um
Stufe 3: Hardwareausfall Server-Pi ──► Kalt-Standby Pi einschalten & Litestream-Restore (3–5 Min)
Stufe 4: Kompletter Stromausfall   ──► Umschalten auf Papier-Notbetrieb
```

---

## 📝 Papier-Notbetrieb (Stufe 4)

### Vorbereitung (vor dem Fest)
- An jeder Schänke, Grillstation und Kellnerstation liegt ein versiegelter **Notfall-Block** (durchnummerierte Papier-Kellnerblöcke mit Durchschlag).
- Ausreichend Kugelschreiber und eine gedruckte Preisliste liegen bereit.

### Ablauf bei Ausruf des Notbetriebs
1. **Festleitung / Schichtleiter** ruft den Notbetrieb aus.
2. Kellner schreiben Bestellungen handschriftlich mit Tisch- und Tischnummer auf die Papierblöcke.
3. Der Durchschlag geht an die Küche/Schänke, das Original bleibt beim Kellner zur Abrechnung.
4. An der Theke wird Bargeld kassiert und handschriftlich auf der Tagesquittungsliste vermerkt.

### Nacherfassung im System
- Sobald Strom und Kassen-Server wieder laufen, werden die handschriftlichen Bons über die Funktion **Nacherfassung / Kassenbuch** eingegeben.
- Damit stimmen die Z-Bon-Abrechnung, DATEV- und DSFinV-K-Exporte mit den tatsächlichen Kassenbeständen überein.
