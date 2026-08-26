'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import VirtualPrinterMonitor from '@/components/printer/virtual-printer-monitor';
import StationGate from '@/components/auth/station-gate';

function VirtualPrinterContent() {
  const params = useSearchParams();
  const printerName = params.get('printerName') || undefined;

  // Stationen dürfen mitlesen, aber den gemeinsamen Verlauf nicht leeren –
  // das bleibt der Administration vorbehalten (die API erzwingt es ebenfalls).
  return <VirtualPrinterMonitor initialPrinter={printerName} />;
}

/**
 * Stations-Ansicht des virtuellen Druckers: ersetzt an einem Ausgabeplatz
 * den Thermodrucker durch ein Tablet. Über `?printerName=Küche` lässt sich
 * das Gerät fest auf eine Druckstelle einstellen.
 */
export default function VirtualPrinterPage() {
  return (
    <StationGate station="KITCHEN" label="Virtueller Drucker" allow={['KITCHEN', 'POS_CASHIER', 'WAITER']}>
      <Suspense fallback={<div className="p-8 text-slate-400">Lade Drucker-Monitor …</div>}>
        <VirtualPrinterContent />
      </Suspense>
    </StationGate>
  );
}
