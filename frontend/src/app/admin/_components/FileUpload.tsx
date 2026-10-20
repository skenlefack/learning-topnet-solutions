'use client';
// ============================================================================
// Topnet Solutions Academy — File Upload Component
// Drag & drop + click, with preview for images and file info for docs
// ============================================================================
import { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, Image as ImageIcon, File, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface FileUploadProps {
  accept: string;
  label?: string;
  hint?: string;
  value?: string; // current file URL or name
  previewUrl?: string; // image preview URL
  onFile: (file: File) => void;
  onClear?: () => void;
  maxSizeMB?: number;
  compact?: boolean;
}

const FILE_ICONS: Record<string, typeof FileText> = {
  'application/pdf': FileText,
  'image/': ImageIcon,
  default: File,
};

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return ImageIcon;
  return FILE_ICONS[type] || File;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUpload({
  accept,
  label,
  hint,
  value,
  previewUrl,
  onFile,
  onClear,
  maxSizeMB = 50,
  compact = false,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(previewUrl || null);
  const [fileName, setFileName] = useState<string | null>(value || null);
  const [fileSize, setFileSize] = useState<number | null>(null);

  const handleFile = useCallback((file: File) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`Fichier trop volumineux (max ${maxSizeMB} MB)`);
      return;
    }

    setFileName(file.name);
    setFileSize(file.size);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }

    onFile(file);
  }, [maxSizeMB, onFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleClear = () => {
    setPreview(null);
    setFileName(null);
    setFileSize(null);
    if (inputRef.current) inputRef.current.value = '';
    onClear?.();
  };

  const hasFile = !!(preview || fileName);

  if (compact && hasFile) {
    return (
      <div className="flex items-center gap-3 p-2.5 rounded-lg border border-[var(--border)] bg-gray-50 dark:bg-gray-800/30">
        {preview ? (
          <img src={preview} alt="" className="w-10 h-10 rounded-lg object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-brand-navy/10 dark:bg-brand-gold/20 flex items-center justify-center">
            <FileText className="w-5 h-5 text-brand-navy dark:text-brand-gold" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[var(--text-primary)] truncate">{fileName}</p>
          {fileSize && <p className="text-[10px] text-[var(--text-secondary)]">{formatSize(fileSize)}</p>}
        </div>
        <button type="button" onClick={handleClear} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div>
      {label && <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{label}</label>}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          'relative rounded-xl border-2 border-dashed cursor-pointer transition-all',
          dragOver
            ? 'border-brand-navy bg-brand-navy/5 dark:border-brand-gold dark:bg-brand-gold/5'
            : 'border-[var(--border)] hover:border-brand-navy/40 dark:hover:border-brand-gold/40',
          hasFile ? 'p-3' : 'p-6',
        )}
      >
        {hasFile ? (
          <div className="flex items-center gap-4">
            {preview ? (
              <img src={preview} alt="" className="w-16 h-16 rounded-xl object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-brand-navy/10 dark:bg-brand-gold/20 flex items-center justify-center">
                <FileText className="w-8 h-8 text-brand-navy dark:text-brand-gold" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">{fileName}</p>
              {fileSize && <p className="text-xs text-[var(--text-secondary)]">{formatSize(fileSize)}</p>}
              <p className="text-[10px] text-brand-navy dark:text-brand-gold mt-1">Cliquer pour changer</p>
            </div>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); handleClear(); }}
              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="text-center">
            <Upload className="w-8 h-8 mx-auto text-[var(--text-secondary)] opacity-40 mb-2" />
            <p className="text-sm text-[var(--text-primary)] font-medium">
              Glisser-déposer ou <span className="text-brand-navy dark:text-brand-gold">parcourir</span>
            </p>
            {hint && <p className="text-[10px] text-[var(--text-secondary)] mt-1">{hint}</p>}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
    </div>
  );
}
