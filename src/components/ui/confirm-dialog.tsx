'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Bestätigen',
  cancelText = 'Abbrechen',
  isDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`p-3 rounded-2xl ${
              isDestructive ? 'bg-rose-500/20 text-rose-400' : 'bg-blue-500/20 text-blue-400'
            }`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-black">{title}</h3>
        </div>

        <p className="text-slate-300 mb-6 leading-relaxed text-sm whitespace-pre-line">{message}</p>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-2xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold transition"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-2xl font-black transition shadow-lg ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = React.createContext<ConfirmContextType>({
  confirm: () => Promise.resolve(false),
});

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = React.useState<(ConfirmOptions & { resolve: (val: boolean) => void }) | null>(null);

  const confirm = React.useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setDialog({ ...options, resolve });
    });
  }, []);

  const handleConfirm = () => {
    dialog?.resolve(true);
    setDialog(null);
  };

  const handleCancel = () => {
    dialog?.resolve(false);
    setDialog(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {dialog && (
        <ConfirmDialog
          isOpen={true}
          title={dialog.title}
          message={dialog.message}
          confirmText={dialog.confirmText}
          cancelText={dialog.cancelText}
          isDestructive={dialog.isDestructive}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return React.useContext(ConfirmContext);
}
