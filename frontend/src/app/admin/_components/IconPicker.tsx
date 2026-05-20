'use client';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { icons, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

// Curated categories for faster browsing
const CURATED: Record<string, string[]> = {
  'Popular': ['BookOpen', 'Award', 'Users', 'Globe', 'Heart', 'Star', 'Shield', 'Zap', 'Target', 'Lightbulb', 'Rocket', 'Flag', 'Trophy', 'Crown', 'Gem', 'Flame'],
  'Animals & Nature': ['ShieldCheck', 'Bug', 'Fish', 'Leaf', 'TreePine', 'Flower2', 'Sprout', 'Bird', 'Egg', 'Beef', 'Wheat', 'Apple', 'Cherry', 'Grape', 'Vegan', 'Milk'],
  'Science & Health': ['Microscope', 'FlaskConical', 'Atom', 'Dna', 'Pill', 'Syringe', 'Stethoscope', 'HeartPulse', 'Thermometer', 'TestTube2', 'Biohazard', 'Scan'],
  'Education': ['GraduationCap', 'BookOpen', 'Library', 'PenTool', 'Pencil', 'NotebookPen', 'School', 'Brain', 'Presentation', 'FileText', 'ClipboardList', 'Lightbulb'],
  'Business': ['TrendingUp', 'BarChart3', 'PieChart', 'Briefcase', 'Building2', 'Handshake', 'DollarSign', 'CreditCard', 'Boxes', 'Package', 'Truck', 'Store'],
  'Technology': ['Monitor', 'Smartphone', 'Wifi', 'Cloud', 'Database', 'Server', 'Code', 'Terminal', 'Cpu', 'HardDrive', 'Globe', 'Satellite'],
  'Communication': ['Mail', 'MessageCircle', 'Phone', 'Video', 'Radio', 'Megaphone', 'Bell', 'Send', 'Share2', 'Rss', 'Podcast', 'AtSign'],
};

const ALL_ICON_NAMES = Object.keys(icons);

interface IconPickerProps {
  value: string;
  onChange: (name: string) => void;
  color?: string;
}

export default function IconPicker({ value, onChange, color = '#1A5632' }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<string>('Popular');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSearch('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const filtered = useMemo(() => {
    if (search.trim()) {
      const q = search.toLowerCase();
      return ALL_ICON_NAMES.filter(n => n.toLowerCase().includes(q)).slice(0, 120);
    }
    return CURATED[tab] || [];
  }, [search, tab]);

  const handleSelect = useCallback((name: string) => {
    onChange(name);
    setOpen(false);
  }, [onChange]);

  const SelectedIcon = icons[value as keyof typeof icons];

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-800/50 border border-[var(--border)] hover:border-[var(--text-secondary)] transition-colors"
      >
        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '15' }}>
          {SelectedIcon ? <SelectedIcon className="w-4.5 h-4.5" style={{ color }} /> : null}
        </span>
        <span className="text-[var(--text-primary)] font-medium">{value}</span>
        <span className="text-[10px] text-[var(--text-secondary)] ml-auto">Changer</span>
      </button>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-white dark:bg-surface-dark-card rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Choisir une icône</h3>
                <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                  <X className="w-4 h-4 text-[var(--text-secondary)]" />
                </button>
              </div>

              {/* Search */}
              <div className="px-5 pb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                  <input
                    ref={inputRef}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher une icône..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-gray-800/50 border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                  />
                </div>
              </div>

              {/* Category tabs (hidden when searching) */}
              {!search.trim() && (
                <div className="px-5 pb-2 flex gap-1.5 overflow-x-auto scrollbar-hide">
                  {Object.keys(CURATED).map(cat => (
                    <button
                      key={cat}
                      onClick={() => setTab(cat)}
                      className={clsx(
                        'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                        tab === cat
                          ? 'bg-brand-navy text-white dark:bg-brand-gold dark:text-gray-900'
                          : 'bg-gray-100 dark:bg-gray-800 text-[var(--text-secondary)] hover:bg-gray-200 dark:hover:bg-gray-700'
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              {/* Icons grid */}
              <div className="px-5 py-3 h-[280px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-[var(--text-secondary)]">
                    Aucune icône trouvée
                  </div>
                ) : (
                  <div className="grid grid-cols-8 gap-1.5">
                    {filtered.map(name => {
                      const Icon = icons[name as keyof typeof icons];
                      if (!Icon) return null;
                      const isSelected = name === value;
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => handleSelect(name)}
                          title={name}
                          className={clsx(
                            'flex items-center justify-center w-full aspect-square rounded-xl transition-all',
                            isSelected
                              ? 'bg-brand-navy text-white dark:bg-brand-gold dark:text-gray-900 ring-2 ring-brand-navy/30 dark:ring-brand-gold/30'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          )}
                        >
                          <Icon className="w-5 h-5" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer: selected icon */}
              <div className="px-5 py-3 border-t border-[var(--border)] bg-gray-50/50 dark:bg-gray-900/30 flex items-center gap-3">
                <span className="text-xs text-[var(--text-secondary)]">Sélection :</span>
                <span className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 border border-[var(--border)]">
                  {SelectedIcon && <SelectedIcon className="w-4 h-4" style={{ color }} />}
                  <span className="text-xs font-medium text-[var(--text-primary)]">{value}</span>
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
