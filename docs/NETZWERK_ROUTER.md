# 🌐 Netzwerk-, Router- und Kartenzahlungs-Setup

OrderAssist Web ist so konzipiert, dass es **100% offline im lokalen Netzwerk** funktioniert. Es wird für den regulären Kassenbetrieb kein Internetanschluss benötigt.

---

## 🔌 Router-Topologie & Internet-Flexibilität

```
                ┌─────────────────────────────────────────┐
                │        FESTZELT-ROUTER (z.B. FritzBox)   │
                │        Lokale IP: 192.168.1.1           │
                └─────┬──────────────┬──────────────┬─────┘
                      │              │              │
        ┌─────────────┴──────┐       │       ┌──────┴───────────────┐
        │  OPTIONALER        │       │       │                      │
        │  INTERNET-UPLINK   │       │       │                      │
        │  (z.B. LAN-Kabel   │       │       │                      │
        │   oder LTE-Modem)  │       │       │                      │
        └────────────────────┘       │       │                      │
                                     │       ▼                      ▼
                                     │  ┌───────────────┐   ┌───────────────┐
                                     │  │ THERMODRUCKER │   │ THERMODRUCKER │
                                     │  │ Küche (9100)  │   │ Schank (9100) │
                                     │  └───────────────┘   └───────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           │                  WLAN / ACCESS POINTS             │
           └───────┬─────────────────────────┬─────────────────┘
                   │                         │
                   ▼                         ▼
         ┌──────────────────┐      ┌──────────────────┐
         │ KELLNER-HANDYS   │      │ SUMUP / KARTEN-  │
         │ (Web-Browser)    │      │ TERMINALE        │
         └──────────────────┘      └──────────────────┘
```

### Fall 1: Reine Barzahlung (100% Offline, kein Internet)
1. Router ohne Internetverbindung im Festzelt aufstellen.
2. PC per LAN-Kabel an den Router anschließen.
3. Handys mit dem Festzelt-WLAN verbinden.
4. Alle Bestellungen, Küchenbons und Zahlungen laufen mit maximaler Geschwindigkeit im internen LAN.

### Fall 2: Kartenzahlung erwünscht (SumUp, SPOS, Terminal)
- **Einfache Lösung**: Stecke ein LAN-Kabel vom Vereinsheim / DSL-Modem in den **WAN-/LAN1-Port** des Festzelt-Routers (oder nutze einen LTE-Stick / mobilen Hotspot).
- Der Router verteilt das Internet automatisch an die angemeldeten Handys und Kartenterminals weiter, **ohne** dass an den Kassen-Einstellungen etwas geändert werden muss.
- Fällt das Internet temporär aus, läuft der Kassenbetrieb (Barzahlung & Bons) unterbrechungsfrei weiter!

---

## 🖨️ Feste IP-Adressen für Bondrucker
Vergib im Router für alle ESC/POS Thermodrucker feste DHCP-Leases, z. B.:
- **192.168.1.201**: Küchendrucker Grillstation (Port 9100)
- **192.168.1.202**: Getränkedrucker Ausschank (Port 9100)
- **192.168.1.203**: Bonkasse / Thekendrucker (Port 9100)
