'use client';
// ============================================================================
// Topnet Solutions Academy — Modern Confirm Dialog
// Replaces native confirm() with an animated modal
// Usage: const confirm = useConfirm();
//        const ok = await confirm({ title, message, confirmLabel, variant });
// ============================================================================
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, Info, CheckCircle, X, Loader2 } from 'lucide-react';
import clsx from 'clsx';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Variant = 'danger' | 'warning' | 'info' | 'success';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false));

export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext);
}

// ---------------------------------------------------------------------------
// Variant config
// ---------------------------------------------------------------------------

const VARIANTS: Record<Variant, {
  icon: typeof AlertTriangle;
  iconBg: string;
  iconColor: string;
  btnClass: string;
}> = {
  danger: {
    icon: Trash2,
    iconBg: 'bg-red-50 dark:bg-red-900/20',
    iconColor: 'text-red-500',
    btnClass: 'bg-red-600 hover:bg-red-700 text-white',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-50 dark:bg-amber-900/20',
    iconColor: 'text-amber-500',
    btnClass: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  info: {
    icon: Info,
    iconBg: 'bg-blue-50 dark:bg-blue-900/20',
    iconColor: 'text-blue-500',
    btnClass: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  success: {
    icon: CheckCircle,
    iconBg: 'bg-green-50 dark:bg-green-900/20',
    iconColor: 'text-green-500',
    btnClass: 'bg-green-600 hover:bg-green-700 text-white',
  },
};

// ---------------------------------------------------------------------------
// Provider + Dialog
// ---------------------------------------------------------------------------

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm: ConfirmFn = useCallback((opts) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setOptions(opts);
    });
  }, []);

  const handleClose = (result: boolean) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setOptions(null);
  };

  const v = options ? VARIANTS[options.variant || 'danger'] : VARIANTS.danger;
  const Icon = v.icon;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      <AnimatePresence>
        {options && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => handleClose(false)}
            />

            {/* Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ type: 'spring', duration: 0.3, bounce: 0.15 }}
              className="relative w-full max-w-sm bg-white dark:bg-surface-dark-card rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Top accent */}
              <div className={clsx('h-1', {
                'bg-red-500': options.variant === 'danger' || !options.variant,
                'bg-amber-500': options.variant === 'warning',
                'bg-blue-500': options.variant === 'info',
                'bg-green-500': options.variant === 'success',
              })} />

              <div className="p-6">
                {/* Icon + Title */}
                <div className="flex items-start gap-4">
                  <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', v.iconBg)}>
                    <Icon className={clsx('w-5.5 h-5.5', v.iconColor)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-[var(--text-primary)] leading-tight">
                      {options.title}
                    </h3>
                    {options.message && (
                      <p className="mt-1.5 text-sm text-[var(--text-secondary)] leading-relaxed">
                        {options.message}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleClose(false)}
                    className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--text-secondary)] shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2.5 mt-6">
                  <button
                    onClick={() => handleClose(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {options.cancelLabel || 'Annuler'}
                  </button>
                  <button
                    onClick={() => handleClose(true)}
                    className={clsx(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      v.btnClass,
                    )}
                  >
                    {options.confirmLabel || 'Confirmer'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}
