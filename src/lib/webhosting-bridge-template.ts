/**
 * Vorlagen für die OpenBon Webhosting-Brücke (PHP / Netcup / Plesk / Apache).
 * Ermöglicht den Abruf von E-Bons und Speisekarten ohne DynDNS oder Portfreigaben.
 */

export function generateIndexPhp(config: { syncToken: string; eventName: string; defaultBaseUrl: string }): string {
  return `<?php
/**
 * OpenBon Webhosting-Brücke v1.0
 * Anzeige digitaler Kassenbelege (E-Bon) & Speisekarten für Gäste.
 * Automatische Beleg-Löschung nach 24 Stunden (DSGVO-konform).
 */

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');

$syncToken = '${config.syncToken.replace(/'/g, "\\'")}';
$eventName = '${(config.eventName || 'Vereinsfest').replace(/'/g, "\\'")}';

// 0. Aktuellen Festnamen dynamisch aus event.json laden (falls von OpenBon synchronisiert)
$eventFile = __DIR__ . '/event.json';
if (file_exists($eventFile)) {
    $evtRaw = @file_get_contents($eventFile);
    if ($evtRaw) {
        $evtData = json_decode($evtRaw, true);
        if (!empty($evtData['name'])) {
            $eventName = $evtData['name'];
        }
    }
}

$receiptsDir = __DIR__ . '/receipts';
$now = time();

// 1. Automatische Selbstreinigung: Belege älter als 24 Stunden (86.400 Sek.) löschen
if (is_dir($receiptsDir)) {
    $files = glob($receiptsDir . '/*.json');
    if ($files) {
        foreach ($files as $f) {
            if (is_file($f) && ($now - filemtime($f) > 86400)) {
                @unlink($f);
            }
        }
    }
}

// 1b. Automatische Selbstreinigung der Speisekarte: Nach 7 Tagen (604.800 Sek.) oder Wunsch-Ablaufdatum löschen
$menuMetaFile = __DIR__ . '/menu-meta.json';
$menuExpired = false;
if (file_exists($menuMetaFile)) {
    $meta = json_decode(@file_get_contents($menuMetaFile), true);
    if (!empty($meta['expiresAt']) && is_numeric($meta['expiresAt']) && $now >= (int)$meta['expiresAt']) {
        $menuExpired = true;
    }
}

$menuFiles = [__DIR__ . '/menu.pdf', __DIR__ . '/menu.jpg', __DIR__ . '/menu.png', __DIR__ . '/products.json'];
$anyFileExpired = false;
foreach ($menuFiles as $mf) {
    if (file_exists($mf) && ($now - filemtime($mf) > 604800)) {
        $anyFileExpired = true;
    }
}
if ($menuExpired || $anyFileExpired) {
    foreach ($menuFiles as $mf) {
        @unlink($mf);
    }
    @unlink($menuMetaFile);
}

// 2. Parameter auswerten
$code = isset($_GET['code']) ? trim($_GET['code']) : '';
$view = isset($_GET['view']) ? trim($_GET['view']) : '';

// Fallback: URL wie /receipt/EBON-... aus REQUEST_URI oder PATH_INFO extrahieren
if (empty($code)) {
    $reqUri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
    if (preg_match('#receipt/([A-Za-z0-9\\-_]+)#', $reqUri, $matches)) {
        $code = $matches[1];
    } elseif (isset($_SERVER['PATH_INFO']) && preg_match('#([A-Za-z0-9\\-_]+)#', $_SERVER['PATH_INFO'], $matches)) {
        $code = $matches[1];
    }
}

// 3. Fall: Speisekarte anzeigen
if ($view === 'menu' || $view === 'karte' || (empty($code) && empty($view))) {
    $pdfExists = file_exists(__DIR__ . '/menu.pdf');
    $imgJpgExists = file_exists(__DIR__ . '/menu.jpg');
    $imgPngExists = file_exists(__DIR__ . '/menu.png');
    $productsJsonExists = file_exists(__DIR__ . '/products.json');

    // Wenn ein Belegcode fehlt und eine Speisekarte vorhanden ist, Speisekarte anzeigen:
    if ($pdfExists || $imgJpgExists || $imgPngExists || $productsJsonExists || empty($code)) {
        renderMenuPage($eventName, $pdfExists, $imgJpgExists, $imgPngExists, $productsJsonExists);
        exit;
    }
}

// 4. Fall: Digitalen Beleg anzeigen
if (!empty($code)) {
    // Sicherheitsprüfung: Code darf nur Buchstaben, Ziffern und Bindestriche enthalten
    if (!preg_match('/^[A-Za-z0-9\\-]+$/', $code)) {
        renderErrorPage('Ungültiges Belegformat', 'Der angegebene Belegcode ist ungültig.');
        exit;
    }

    $receiptFile = $receiptsDir . '/' . $code . '.json';
    if (!file_exists($receiptFile)) {
        renderErrorPage(
            'Beleg nicht gefunden oder abgelaufen',
            'Dieser Kassenbeleg existiert nicht mehr. Belege werden aus Datenschutzgründen automatisch nach 24 Stunden vom Server gelöscht.'
        );
        exit;
    }

    $content = file_get_contents($receiptFile);
    $data = json_decode($content, true);
    if (!$data || !isset($data['payment'])) {
        renderErrorPage('Fehler beim Laden', 'Die Belegdaten konnten nicht verarbeitet werden.');
        exit;
    }

    renderReceiptPage($code, $data, $eventName);
    exit;
}

renderErrorPage('Keine Auswahl', 'Bitte scanne den QR-Code auf deinem Beleg oder am Tisch.');
exit;

// -----------------------------------------------------------------------------
// Layout-Funktionen
// -----------------------------------------------------------------------------

function renderReceiptPage($code, $data, $defaultEventName) {
    $payment = $data['payment'] ?? [];
    $eventName = !empty($data['eventName']) ? $data['eventName'] : $defaultEventName;
    $items = $payment['items'] ?? [];
    
    $totalGross = isset($payment['totalGross']) ? (float)$payment['totalGross'] : (isset($payment['totalGrossCents']) ? $payment['totalGrossCents'] / 100 : 0.0);
    $tipAmount = isset($payment['tipAmount']) ? (float)$payment['tipAmount'] : (isset($payment['tipAmountCents']) ? $payment['tipAmountCents'] / 100 : 0.0);
    $givenAmount = isset($payment['givenAmount']) ? (float)$payment['givenAmount'] : (isset($payment['givenAmountCents']) ? $payment['givenAmountCents'] / 100 : 0.0);
    $changeAmount = isset($payment['changeAmount']) ? (float)$payment['changeAmount'] : (isset($payment['changeAmountCents']) ? $payment['changeAmountCents'] / 100 : 0.0);
    $finalTotal = $totalGross + $tipAmount;
    
    $invoiceNumber = $payment['invoiceNumber'] ?? 'BELEG';
    $paymentMethod = $payment['paymentMethod'] ?? 'BAR';
    $waiterName = $payment['waiterName'] ?? '';
    $createdAt = !empty($payment['createdAt']) ? date('d.m.Y, H:i:s', strtotime($payment['createdAt'])) : date('d.m.Y, H:i:s');
    
    $tse = $payment['tse'] ?? [];
    ?>
    <!DOCTYPE html>
    <html lang="de" class="dark">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Digitaler Beleg #<?= htmlspecialchars($invoiceNumber) ?></title>
        <style>
            :root { color-scheme: dark; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #030712; color: #f9fafb; padding: 16px; display: flex; justify-content: center; }
            .container { width: 100%; max-width: 480px; }
            .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 24px; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
            .header { text-align: center; border-bottom: 2px dashed #334155; padding-bottom: 16px; margin-bottom: 16px; }
            .event-name { font-size: 20px; font-weight: 900; color: #38bdf8; margin-bottom: 4px; }
            .sub-header { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
            .meta-row { display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; margin-bottom: 6px; }
            .meta-value { font-weight: 700; color: #f1f5f9; }
            .items-table { width: 100%; margin: 16px 0; border-collapse: collapse; }
            .items-table th { text-align: left; font-size: 10px; color: #64748b; text-transform: uppercase; padding-bottom: 8px; border-bottom: 1px solid #1e293b; }
            .items-table td { padding: 10px 0; font-size: 13px; border-bottom: 1px solid #1e293b/60; }
            .item-price { text-align: right; font-family: monospace; font-weight: 700; }
            .total-section { border-top: 2px solid #334155; padding-top: 14px; margin-top: 10px; }
            .total-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
            .final-total { font-size: 22px; font-weight: 900; color: #10b981; }
            .badge { display: inline-block; padding: 3px 8px; border-radius: 8px; font-size: 10px; font-weight: 800; background: #1e293b; color: #94a3b8; }
            .btn { display: block; width: 100%; padding: 14px; background: #2563eb; color: #ffffff; border: none; border-radius: 16px; font-size: 14px; font-weight: 700; text-align: center; text-decoration: none; cursor: pointer; margin-top: 20px; transition: all 0.2s; }
            .btn:active { transform: scale(0.98); }
            .footer-info { text-align: center; font-size: 11px; color: #64748b; margin-top: 20px; line-height: 1.5; }
            .tse-box { background: #020617; border: 1px solid #1e293b; border-radius: 12px; padding: 12px; margin-top: 16px; font-family: monospace; font-size: 9px; color: #94a3b8; word-break: break-all; }
            @media print {
                body { background: #ffffff; color: #000000; }
                .card { border: none; box-shadow: none; padding: 0; }
                .btn, .no-print { display: none !important; }
                .event-name, .final-total { color: #000000; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <div class="header">
                    <div class="event-name"><?= htmlspecialchars($eventName) ?></div>
                    <div class="sub-header">Offizieller digitaler Kassenbeleg (§ 33 KassenSichV)</div>
                </div>

                <div class="meta-row">
                    <span>Belegnummer:</span>
                    <span class="meta-value">#<?= htmlspecialchars($invoiceNumber) ?></span>
                </div>
                <div class="meta-row">
                    <span>Datum & Uhrzeit:</span>
                    <span class="meta-value"><?= htmlspecialchars($createdAt) ?></span>
                </div>
                <?php if (!empty($waiterName)): ?>
                <div class="meta-row">
                    <span>Bedienung:</span>
                    <span class="meta-value"><?= htmlspecialchars($waiterName) ?></span>
                </div>
                <?php endif; ?>
                <div class="meta-row">
                    <span>Zahlungsart:</span>
                    <span class="badge"><?= htmlspecialchars($paymentMethod) ?></span>
                </div>

                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Menge & Artikel</th>
                            <th style="text-align: right;">Betrag</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($items as $item): 
                            $qty = (int)($item['quantity'] ?? 1);
                            $name = $item['productName'] ?? ($item['name'] ?? 'Artikel');
                            $price = isset($item['unitPrice']) ? (float)$item['unitPrice'] : (isset($item['unitPriceCents']) ? $item['unitPriceCents'] / 100 : 0.0);
                            $lineTotal = $price * $qty;
                            $deposit = isset($item['deposit']) ? (float)$item['deposit'] : (isset($item['depositCents']) ? $item['depositCents'] / 100 : 0.0);
                        ?>
                        <tr>
                            <td>
                                <strong><?= $qty ?>x</strong> <?= htmlspecialchars($name) ?>
                                <?php if ($deposit > 0): ?>
                                    <span style="font-size: 10px; color: #64748b; display: block;">inkl. <?= number_format($deposit, 2, ',', '.') ?> € Pfand</span>
                                <?php endif; ?>
                            </td>
                            <td class="item-price"><?= number_format($lineTotal, 2, ',', '.') ?> €</td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>

                <div class="total-section">
                    <?php if ($tipAmount > 0): ?>
                    <div class="meta-row">
                        <span>Zwischensumme:</span>
                        <span class="item-price"><?= number_format($totalGross, 2, ',', '.') ?> €</span>
                    </div>
                    <div class="meta-row">
                        <span>Freiwilliges Trinkgeld:</span>
                        <span class="item-price">+<?= number_format($tipAmount, 2, ',', '.') ?> €</span>
                    </div>
                    <?php endif; ?>

                    <div class="total-row">
                        <span style="font-weight: 800; font-size: 15px;">GESAMTBETRAG:</span>
                        <span class="final-total"><?= number_format($finalTotal, 2, ',', '.') ?> €</span>
                    </div>

                    <?php if ($givenAmount > 0): ?>
                    <div class="meta-row" style="margin-top: 6px;">
                        <span>Gegeben (Bar):</span>
                        <span class="item-price"><?= number_format($givenAmount, 2, ',', '.') ?> €</span>
                    </div>
                    <div class="meta-row">
                        <span>Rückgeld:</span>
                        <span class="item-price"><?= number_format($changeAmount, 2, ',', '.') ?> €</span>
                    </div>
                    <?php endif; ?>
                </div>

                <?php if (!empty($tse) && !empty($tse['signature'])): ?>
                <div class="tse-box">
                    <div style="font-weight: bold; color: #38bdf8; margin-bottom: 4px;">Fiskal-Signatur (TSE):</div>
                    <div>TSE-Serial: <?= htmlspecialchars($tse['serialNumber'] ?? 'SWISSBIT-001') ?></div>
                    <div>Signatur-Zähler: <?= htmlspecialchars((string)($tse['signatureCounter'] ?? '')) ?></div>
                    <div style="margin-top: 4px; color: #64748b;">Sig: <?= htmlspecialchars(substr($tse['signature'], 0, 48)) ?>...</div>
                </div>
                <?php endif; ?>

                <button class="btn no-print" onclick="window.print()">
                    Beleg drucken / Als PDF sichern
                </button>

                <div class="footer-info">
                    <div>Verifikationscode: <code style="color: #cbd5e1; font-weight: bold;"><?= htmlspecialchars($code) ?></code></div>
                    <div style="margin-top: 4px;">Vielen Dank für Ihren Besuch!</div>
                    <div style="margin-top: 6px; font-size: 10px; color: #475569;">Dieser Beleg steht nach der Erstellung 24 Stunden zum Abruf bereit.</div>
                </div>
            </div>
        </div>
    </body>
    </html>
    <?php
}

function renderMenuPage($eventName, $pdfExists, $imgJpgExists, $imgPngExists, $productsJsonExists) {
    if ($pdfExists) {
        $pdfPath = __DIR__ . '/menu.pdf';
        if (file_exists($pdfPath)) {
            // Direktes, randloses Ausliefern des PDFs auf die volle Bildschirmbreite mit nativem Finger-Zoom
            header('Content-Type: application/pdf');
            header('Content-Disposition: inline; filename="Speisekarte.pdf"');
            header('Content-Length: ' . filesize($pdfPath));
            header('Cache-Control: public, max-age=3600');
            @readfile($pdfPath);
            exit;
        }
    }

    if ($imgJpgExists || $imgPngExists) {
        $imgSrc = $imgJpgExists ? 'menu.jpg' : 'menu.png';
        ?>
        <!DOCTYPE html>
        <html lang="de">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
            <title><?= htmlspecialchars($eventName) ?> | Speisekarte</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                html, body { background: #030712; width: 100%; min-height: 100%; display: flex; justify-content: center; }
                img { width: 100%; max-width: 1000px; height: auto; display: block; }
            </style>
        </head>
        <body>
            <img src="<?= $imgSrc ?>" alt="Speisekarte" />
        </body>
        </html>
        <?php
        exit;
    }
    ?>
    <!DOCTYPE html>
    <html lang="de" class="dark">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Speisekarte | <?= htmlspecialchars($eventName) ?></title>
        <style>
            :root { color-scheme: dark; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #030712; color: #f9fafb; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 16px; margin: 0; }
            .box { background: #0f172a; border: 1px solid #1e293b; border-radius: 20px; padding: 32px 24px; max-width: 420px; text-align: center; }
            h2 { color: #38bdf8; font-size: 20px; margin-bottom: 10px; }
            p { font-size: 14px; color: #94a3b8; line-height: 1.5; }
        </style>
    </head>
    <body>
        <div class="box">
            <h2><?= htmlspecialchars($eventName) ?></h2>
            <p>Die Speisekarte zu dieser Veranstaltung ist abgelaufen oder steht derzeit nicht zur Verfügung.</p>
        </div>
    </body>
    </html>
    <?php
}

function renderErrorPage($title, $message) {
    ?>
    <!DOCTYPE html>
    <html lang="de" class="dark">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title><?= htmlspecialchars($title) ?></title>
        <style>
            :root { color-scheme: dark; }
            body { font-family: sans-serif; background: #030712; color: #f9fafb; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 16px; margin: 0; }
            .box { background: #0f172a; border: 1px solid #1e293b; border-radius: 20px; padding: 24px; max-width: 420px; text-align: center; }
            h2 { color: #f43f5e; font-size: 18px; margin-bottom: 10px; }
            p { font-size: 13px; color: #94a3b8; line-height: 1.5; }
        </style>
    </head>
    <body>
        <div class="box">
            <h2><?= htmlspecialchars($title) ?></h2>
            <p><?= htmlspecialchars($message) ?></p>
        </div>
    </body>
    </html>
    <?php
}
`;
}

export function generateApiPhp(config: { syncToken: string }): string {
  return `<?php
/**
 * OpenBon Webhosting-Brücke v1.0 - Empfangs-Schnittstelle
 * Empfängt Belege und Speisekarten per gesicherter POST-Anfrage aus dem Festzelt.
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$expectedToken = '${config.syncToken.replace(/'/g, "\\'")}';
$clientToken = $_SERVER['HTTP_X_BRIDGE_TOKEN'] ?? ($_GET['token'] ?? '');

// 1. Sicherheitsschlüssel prüfen
if (empty($clientToken) || !hash_equals($expectedToken, $clientToken)) {
    http_response_code(403);
    echo json_encode(['error' => 'Ungültiger Sicherheitsschlüssel (X-Bridge-Token fehlerhaft).']);
    exit;
}

$action = $_GET['action'] ?? '';
$receiptsDir = __DIR__ . '/receipts';
if (!is_dir($receiptsDir)) {
    @mkdir($receiptsDir, 0755, true);
}

// 2. Beleg speichern
if ($action === 'push_receipt') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);

    if (!$data || empty($data['code']) || !preg_match('/^[A-Za-z0-9\\-]+$/', $data['code'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Ungültiger Belegcode oder fehlerhaftes JSON.']);
        exit;
    }

    $code = $data['code'];
    $target = $receiptsDir . '/' . $code . '.json';
    file_put_contents($target, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

    // Festnamen bei jedem Belegabgleich mitsichern
    if (!empty($data['eventName'])) {
        @file_put_contents(__DIR__ . '/event.json', json_encode(['name' => $data['eventName'], 'updatedAt' => date('c')]));
    }

    echo json_encode(['success' => true, 'code' => $code, 'savedAt' => date('c')]);
    exit;
}

// 3. Speisekarte hochladen (PDF oder Bild)
if ($action === 'upload_menu') {
    if (!empty($_POST['eventName'])) {
        @file_put_contents(__DIR__ . '/event.json', json_encode(['name' => $_POST['eventName'], 'updatedAt' => date('c')]));
    }

    $expiresAt = !empty($_POST['expiresAt']) ? (int)$_POST['expiresAt'] : null;
    if ($expiresAt !== null && $expiresAt > 0) {
        @file_put_contents(__DIR__ . '/menu-meta.json', json_encode(['expiresAt' => $expiresAt, 'updatedAt' => date('c')]));
    } else {
        @unlink(__DIR__ . '/menu-meta.json');
    }

    if (!empty($_FILES['menu_file'])) {
        $file = $_FILES['menu_file'];
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

        if ($ext === 'pdf') {
            move_uploaded_file($file['tmp_name'], __DIR__ . '/menu.pdf');
            echo json_encode(['success' => true, 'type' => 'pdf']);
            exit;
        } elseif (in_array($ext, ['jpg', 'jpeg'])) {
            move_uploaded_file($file['tmp_name'], __DIR__ . '/menu.jpg');
            echo json_encode(['success' => true, 'type' => 'jpg']);
            exit;
        } elseif ($ext === 'png') {
            move_uploaded_file($file['tmp_name'], __DIR__ . '/menu.png');
            echo json_encode(['success' => true, 'type' => 'png']);
            exit;
        } else {
            http_response_code(400);
            echo json_encode(['error' => 'Nur PDF, JPG oder PNG erlaubt.']);
            exit;
        }
    }

    // JSON-Speisekarte
    $raw = file_get_contents('php://input');
    if (!empty($raw)) {
        file_put_contents(__DIR__ . '/products.json', $raw);
        $jsonParsed = json_decode($raw, true);
        if (is_array($jsonParsed) && !empty($jsonParsed['eventName'])) {
            @file_put_contents(__DIR__ . '/event.json', json_encode(['name' => $jsonParsed['eventName'], 'updatedAt' => date('c')]));
        }
        echo json_encode(['success' => true, 'type' => 'json']);
        exit;
    }

    http_response_code(400);
    echo json_encode(['error' => 'Keine Datei oder Daten übermittelt.']);
    exit;
}

// 4. Festname dynamisch aktualisieren
if ($action === 'update_event') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true) ?: [];
    $name = $data['name'] ?? ($data['eventName'] ?? ($_GET['name'] ?? ''));
    if (!empty($name)) {
        file_put_contents(__DIR__ . '/event.json', json_encode(['name' => $name, 'updatedAt' => date('c')]));
        echo json_encode(['success' => true, 'name' => $name]);
        exit;
    }
    http_response_code(400);
    echo json_encode(['error' => 'Kein Festname übermittelt.']);
    exit;
}

// 5. Status-Check
if ($action === 'status') {
    $receiptCount = count(glob($receiptsDir . '/*.json') ?: []);
    $eventData = file_exists(__DIR__ . '/event.json') ? json_decode(@file_get_contents(__DIR__ . '/event.json'), true) : null;
    echo json_encode([
        'status' => 'online',
        'version' => 'openbon-bridge-1.1',
        'phpVersion' => PHP_VERSION,
        'activeReceipts' => $receiptCount,
        'eventName' => $eventData['name'] ?? null,
        'hasMenuPdf' => file_exists(__DIR__ . '/menu.pdf'),
        'hasMenuImg' => file_exists(__DIR__ . '/menu.jpg') || file_exists(__DIR__ . '/menu.png'),
    ]);
    exit;
}

http_response_code(404);
echo json_encode(['error' => 'Unbekannte Aktion.']);
exit;
`;
}

export function generateHtaccess(): string {
  return `# OpenBon Webhosting-Brücke
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /
Options -Indexes

# 1. Schutz: Direkter Download des receipts-Ordners wird gesperrt
RedirectMatch 403 ^/receipts/.*$

# 2. Beleg-Kurzlinks: /receipt/EBON-XXXX -> index.php?code=EBON-XXXX
RewriteRule ^receipt/([A-Za-z0-9\\-_]+)/?$ index.php?code=$1 [L,QSA,NC]

# 3. Speisekarten-Links: /menu oder /karte -> index.php?view=menu
RewriteRule ^(menu|karte)/?$ index.php?view=menu [L,QSA,NC]

# 4. API-Zugriff: /api/(.*)$ api.php?$1 [L,QSA,NC]
RewriteRule ^api/(.*)$ api.php?$1 [L,QSA,NC]
</IfModule>
`;
}

export function generateReadmeHtml(config: { syncToken: string; defaultBaseUrl: string; eventName?: string }): string {
  const name = config.eventName || 'Vereinsfest';
  return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>Anleitung: OpenBon Webhosting-Brücke (${name})</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; line-height: 1.6; padding: 24px; max-width: 800px; margin: 0 auto; }
        h1 { color: #38bdf8; font-size: 24px; border-bottom: 2px solid #334155; padding-bottom: 12px; }
        h2 { color: #10b981; font-size: 18px; margin-top: 24px; }
        .box { background: #1e293b; border-left: 4px solid #38bdf8; padding: 16px; border-radius: 8px; margin: 16px 0; }
        .step { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 16px; margin-bottom: 14px; }
        .step-num { display: inline-block; background: #2563eb; color: #fff; width: 28px; height: 28px; border-radius: 50%; text-align: center; line-height: 28px; font-weight: bold; margin-right: 8px; }
        code { background: #020617; padding: 3px 6px; border-radius: 6px; font-family: monospace; color: #38bdf8; font-size: 13px; }
    </style>
</head>
<body>
    <h1>OpenBon Webhosting-Brücke: ${name} (Netcup / Plesk / Apache)</h1>
    <div class="box">
        <strong>Genial einfach:</strong> Für diese Brücke wird <strong>weder DynDNS noch eine Portfreigabe am Router</strong> benötigt!
        Die Kasse im Festzelt sendet neue Bons einfach ausgehend über das Internet an dein Webhosting.
    </div>

    <h2>In 3 einfachen Schritten einrichten:</h2>

    <div class="step">
        <div><span class="step-num">1</span> <strong>Subdomain anlegen & SSL aktivieren</strong></div>
        <p>Logge dich bei deinem Provider (z. B. Netcup CCP / Plesk) ein und erstelle eine Subdomain, z. B. <code>bon.mein-verein.de</code>.<br>
        Aktiviere dort mit 1 Klick das kostenlose <strong>Let's Encrypt SSL-Zertifikat</strong> (https://).</p>
    </div>

    <div class="step">
        <div><span class="step-num">2</span> <strong>Dateien hochladen & entpacken</strong></div>
        <p>Öffne den Dateimanager in Plesk und navigiere in das Verzeichnis der Subdomain (meistens <code>/httpdocs/</code>).<br>
        Lade die Datei <code>openbon-webhosting-bruecke.zip</code> hoch und klicke auf <strong>„Dateien extrahieren“</strong>.<br>
        <em>Fertig! Alle Dateien (index.php, api.php, .htaccess) liegen nun an Ort und Stelle.</em></p>
    </div>

    <div class="step">
        <div><span class="step-num">3</span> <strong>Adresse in OpenBon eintragen</strong></div>
        <p>Trage in OpenBon unter <strong>Admin &gt; Einstellungen &gt; Kassenbeleg &gt; Digitaler E-Bon</strong> deine Adresse ein:<br>
        <code>${config.defaultBaseUrl || 'https://bon.mein-verein.de'}</code><br>
        Dein bereits integrierter Sicherheitsschlüssel lautet:<br>
        <code>${config.syncToken}</code></p>
    </div>

    <h2>Automatische Selbstreinigung (24 Stunden):</h2>
    <p>Das Skript prüft bei jedem Aufruf das Alter der gespeicherten Belege. Jeder Bon wird nach genau 24 Stunden automatisch vom Server gelöscht. So bleibt dein Speicherplatz sauber und der Datenschutz ist gesichert.</p>
</body>
</html>
`;
}
