'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import VirtualPrinterMonitor from '@/components/printer/virtual-printer-monitor';

function AdminVirtualPrinterContent() {
  const params = useSearchParams();
  const printerName = params.get('printerName') || undefined;

  return <VirtualPrinterMonitor showBackLink allowClear initialPrinter={printerName} />;
}

/**
 * Administrations-Ansicht des virtuellen Drucker-Monitors.
 * Zeigt dieselbe Oberfläche wie `/virtual-printer`, zusätzlich mit
 * Rücksprung in die Drucker-Verwaltung und der Möglichkeit,
 * den Druckverlauf zu leeren.
 */
export default function AdminVirtualPrinterPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Lade Drucker-Monitor …</div>}>
      <AdminVirtualPrinterContent />
    </Suspense>
  );
}
