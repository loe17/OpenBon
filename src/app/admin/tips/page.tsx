'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AdminTipsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/settle?tab=staff');
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
      <p className="text-sm">Weiterleitung zu Personal &amp; Abrechnung …</p>
    </div>
  );
}
