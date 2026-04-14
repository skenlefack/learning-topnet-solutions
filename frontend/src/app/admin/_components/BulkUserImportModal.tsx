'use client';
// ============================================================================
// Admin — Bulk User Import Modal (CSV/JSON)
// ============================================================================
import { useState, useRef } from 'react';
import { X, Upload, Check, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportRow {
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  tenant_id: string;
  preferred_language?: string;
  _error?: string;
}

const VALID_ROLES = ['learner', 'trainer', 'admin_country', 'admin_rec', 'admin_continental'];

export default function BulkUserImportModal({ open, onClose, onSuccess }: Props) {
  const { token } = useAuth();
  const t = useTranslations('admin.bulkImport');
  const t_common = useTranslations('common');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<ImportRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ imported: number; failed: number } | null>(null);

  const reset = () => {
    setRows([]);
    setErrors([]);
    setProgress(0);
    setResult(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    reset();

    const text = await file.text();
    const validationErrors: string[] = [];
    let parsed: ImportRow[] = [];

    try {
      if (file.name.endsWith('.json')) {
        const data = JSON.parse(text);
        parsed = Array.isArray(data) ? data : data.users || [];
      } else if (file.name.endsWith('.csv')) {
        const lines = text.trim().split('\n');
        if (lines.length < 2) {
          validationErrors.push(t('csvHeaderRequired'));
        } else {
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
          parsed = lines.slice(1).filter(l => l.trim()).map(line => {
            const cols = line.split(',').map(c => c.trim().replace(/"/g, ''));
            const obj: any = {};
            headers.forEach((h, i) => { obj[h] = cols[i] || ''; });
            return {
              email: obj.email || '',
              first_name: obj.first_name || obj.firstname || '',
              last_name: obj.last_name || obj.lastname || '',
              role: obj.role || 'learner',
              tenant_id: obj.tenant_id || obj.tenantid || '',
              preferred_language: obj.preferred_language || obj.language || 'en',
            };
          });
        }
      } else {
        validationErrors.push(t('unsupportedFormat'));
      }
    } catch {
      validationErrors.push(t('parseFailed'));
    }

    // Validate rows
    const emailSet = new Set<string>();
    parsed.forEach((row, i) => {
      if (!row.email) {
        row._error = t('missingEmail', { index: i + 1 });
        validationErrors.push(row._error);
      } else if (emailSet.has(row.email.toLowerCase())) {
        row._error = t('duplicateEmail', { index: i + 1, email: row.email });
        validationErrors.push(row._error);
      } else {
        emailSet.add(row.email.toLowerCase());
      }

      if (!row.first_name || !row.last_name) {
        row._error = t('missingName', { index: i + 1 });
        validationErrors.push(row._error);
      }

      if (row.role && !VALID_ROLES.includes(row.role)) {
        row._error = t('invalidRole', { index: i + 1, role: row.role });
        validationErrors.push(row._error);
      }

      if (!row.tenant_id) {
        row._error = t('missingTenant', { index: i + 1 });
        validationErrors.push(row._error);
      }
    });

    setRows(parsed);
    setErrors(validationErrors);
    e.target.value = '';
  };

  const validRows = rows.filter(r => !r._error);

  const handleImport = async () => {
    if (!token || validRows.length === 0) return;
    setImporting(true);
    setProgress(0);

    try {
      const res: any = await adminApi.bulkImportUsers(token, validRows);
      setResult({
        imported: res.data?.imported || validRows.length,
        failed: res.data?.failed || 0,
      });
      setProgress(100);
      toast.success(t('toastImported', { count: res.data?.imported || validRows.length }));
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || t('importFailed'));
    } finally {
      setImporting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className={clsx(
        'relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl p-6',
        'bg-white dark:bg-surface-dark-card border border-[var(--border)] shadow-xl',
      )}>
        <button onClick={() => { onClose(); reset(); }} className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">{t('title')}</h2>

        {/* Upload zone */}
        {rows.length === 0 && !result && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className={clsx(
              'flex flex-col items-center justify-center gap-3 p-8 rounded-xl cursor-pointer',
              'border-2 border-dashed border-[var(--border)] hover:border-brand-navy dark:hover:border-brand-gold transition-colors',
            )}
          >
            <Upload className="w-8 h-8 text-[var(--text-secondary)]" />
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--text-primary)]">{t('uploadLabel')}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {t('requiredColumns')}
              </p>
            </div>
            <input ref={fileInputRef} type="file" accept=".csv,.json" className="hidden" onChange={handleFileSelect} />
          </div>
        )}

        {/* Validation errors */}
        {errors.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800 dark:text-yellow-400">
                {t('validationErrors', { count: errors.length })}
              </span>
            </div>
            <ul className="text-xs text-yellow-700 dark:text-yellow-500 space-y-0.5 max-h-32 overflow-y-auto">
              {errors.slice(0, 20).map((err, i) => <li key={i}>{err}</li>)}
              {errors.length > 20 && <li>... and {errors.length - 20} more</li>}
            </ul>
          </div>
        )}

        {/* Preview table */}
        {rows.length > 0 && !result && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--text-primary)]">
                {t('validRows', { valid: validRows.length, total: rows.length })}
              </p>
              <button onClick={reset} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                {t('clear')}
              </button>
            </div>

            <div className="rounded-lg border border-[var(--border)] overflow-hidden">
              <div className="overflow-x-auto max-h-60">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-[var(--text-secondary)]">#</th>
                      <th className="px-3 py-2 text-left font-semibold text-[var(--text-secondary)]">Email</th>
                      <th className="px-3 py-2 text-left font-semibold text-[var(--text-secondary)]">Name</th>
                      <th className="px-3 py-2 text-left font-semibold text-[var(--text-secondary)]">Role</th>
                      <th className="px-3 py-2 text-left font-semibold text-[var(--text-secondary)]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {rows.slice(0, 50).map((row, i) => (
                      <tr key={i} className={row._error ? 'bg-red-50/50 dark:bg-red-900/10' : ''}>
                        <td className="px-3 py-1.5 text-[var(--text-secondary)]">{i + 1}</td>
                        <td className="px-3 py-1.5 text-[var(--text-primary)]">{row.email}</td>
                        <td className="px-3 py-1.5 text-[var(--text-primary)]">{row.first_name} {row.last_name}</td>
                        <td className="px-3 py-1.5 text-[var(--text-secondary)]">{row.role}</td>
                        <td className="px-3 py-1.5">
                          {row._error
                            ? <span className="text-red-500">{row._error}</span>
                            : <Check className="w-3.5 h-3.5 text-green-500" />
                          }
                        </td>
                      </tr>
                    ))}
                    {rows.length > 50 && (
                      <tr><td colSpan={5} className="px-3 py-2 text-center text-[var(--text-secondary)]">{t('moreRows', { count: rows.length - 50 })}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Progress bar */}
            {importing && (
              <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                <div className="h-full bg-brand-navy dark:bg-brand-gold transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button onClick={() => { onClose(); reset(); }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800">
                {t_common('cancel')}
              </button>
              <button onClick={handleImport} disabled={importing || validRows.length === 0}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                  'bg-brand-navy text-white hover:bg-brand-navy-deep transition-colors',
                  'dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark',
                  'disabled:opacity-40',
                )}>
                {importing ? t('importing') : t('importBtn', { count: validRows.length })}
              </button>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="mt-4 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-lg font-bold text-[var(--text-primary)]">{t('resultImported', { count: result.imported })}</p>
            {result.failed > 0 && (
              <p className="text-sm text-red-500">{t('resultFailed', { count: result.failed })}</p>
            )}
            <button onClick={() => { onClose(); reset(); }}
              className={clsx(
                'px-6 py-2 rounded-lg text-sm font-medium',
                'bg-brand-navy text-white hover:bg-brand-navy-deep transition-colors',
                'dark:bg-brand-gold dark:text-gray-900',
              )}>
              {t('done')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
