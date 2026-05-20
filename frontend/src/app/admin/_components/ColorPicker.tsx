'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Pipette, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

const PRESET_COLORS = [
  // Greens
  '#1A5632', '#0e591a', '#154528', '#2E7D32', '#4CAF50', '#81C784',
  // Reds / Burgundy
  '#930e2d', '#7B1639', '#C62828', '#E53935', '#EF5350',
  // Golds / Oranges
  '#B8952E', '#C8A951', '#F9A825', '#FF8F00', '#EF6C00',
  // Blues
  '#1565C0', '#1976D2', '#42A5F5', '#0D47A1', '#283593',
  // Purples
  '#6A1B9A', '#8E24AA', '#a855f7', '#7C3AED', '#5B21B6',
  // Teals / Cyans
  '#00695C', '#00897B', '#26A69A', '#0097A7', '#00838F',
  // Neutrals
  '#37474F', '#546E7A', '#78909C', '#455A64', '#263238',
];

const HUE_STOPS = [
  '#ff0000', '#ff8000', '#ffff00', '#80ff00', '#00ff00', '#00ff80',
  '#00ffff', '#0080ff', '#0000ff', '#8000ff', '#ff00ff', '#ff0080', '#ff0000',
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState(value);
  const [hsl, setHsl] = useState<[number, number, number]>(() => hexToHsl(value));
  const satLightRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<'sl' | 'hue' | null>(null);

  useEffect(() => {
    setHexInput(value);
    setHsl(hexToHsl(value));
  }, [value]);

  const commitColor = useCallback((hex: string) => {
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      onChange(hex);
    }
  }, [onChange]);

  const handleSatLightMove = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!satLightRef.current) return;
    const rect = satLightRef.current.getBoundingClientRect();
    const s = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const l = Math.max(0, Math.min(100, 100 - ((e.clientY - rect.top) / rect.height) * 100));
    const newHsl: [number, number, number] = [hsl[0], Math.round(s), Math.round(l)];
    setHsl(newHsl);
    const hex = hslToHex(newHsl[0], newHsl[1], newHsl[2]);
    setHexInput(hex);
    commitColor(hex);
  }, [hsl, commitColor]);

  const handleHueMove = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    const h = Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360));
    const newHsl: [number, number, number] = [Math.round(h), hsl[1], hsl[2]];
    setHsl(newHsl);
    const hex = hslToHex(newHsl[0], newHsl[1], newHsl[2]);
    setHexInput(hex);
    commitColor(hex);
  }, [hsl, commitColor]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragging.current === 'sl') handleSatLightMove(e);
      else if (dragging.current === 'hue') handleHueMove(e);
    };
    const handleMouseUp = () => { dragging.current = null; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleSatLightMove, handleHueMove]);

  const handleHexChange = (val: string) => {
    setHexInput(val);
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      setHsl(hexToHsl(val));
      commitColor(val);
    }
  };

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-800/50 border border-[var(--border)] hover:border-[var(--text-secondary)] transition-colors"
      >
        <span className="w-8 h-8 rounded-lg border border-black/10 shrink-0" style={{ backgroundColor: value }} />
        <span className="text-[var(--text-primary)] font-medium font-mono text-xs">{value}</span>
        <Pipette className="w-3.5 h-3.5 text-[var(--text-secondary)] ml-auto" />
      </button>

      {/* Popover */}
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
              className="relative w-full max-w-sm bg-white dark:bg-surface-dark-card rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Choisir une couleur</h3>
                <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                  <X className="w-4 h-4 text-[var(--text-secondary)]" />
                </button>
              </div>

              <div className="px-5 pb-5 space-y-4">
                {/* Saturation / Lightness area */}
                <div
                  ref={satLightRef}
                  onMouseDown={e => { dragging.current = 'sl'; handleSatLightMove(e); }}
                  className="relative w-full h-40 rounded-xl cursor-crosshair select-none overflow-hidden"
                  style={{
                    background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsl[0]}, 100%, 50%))`,
                  }}
                >
                  {/* Cursor */}
                  <div
                    className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={{
                      left: `${hsl[1]}%`,
                      top: `${100 - hsl[2]}%`,
                      backgroundColor: value,
                    }}
                  />
                </div>

                {/* Hue slider */}
                <div
                  ref={hueRef}
                  onMouseDown={e => { dragging.current = 'hue'; handleHueMove(e); }}
                  className="relative w-full h-4 rounded-full cursor-pointer select-none"
                  style={{
                    background: `linear-gradient(to right, ${HUE_STOPS.join(', ')})`,
                  }}
                >
                  <div
                    className="absolute w-5 h-5 rounded-full border-2 border-white shadow-md -translate-x-1/2 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{
                      left: `${(hsl[0] / 360) * 100}%`,
                      backgroundColor: `hsl(${hsl[0]}, 100%, 50%)`,
                    }}
                  />
                </div>

                {/* Hex input + preview */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl border border-black/10 shrink-0" style={{ backgroundColor: value }} />
                  <div className="flex-1">
                    <label className="text-[10px] text-[var(--text-secondary)] mb-1 block uppercase tracking-wide">Hex</label>
                    <input
                      value={hexInput}
                      onChange={e => handleHexChange(e.target.value)}
                      maxLength={7}
                      className="w-full px-3 py-1.5 rounded-lg text-sm font-mono bg-gray-50 dark:bg-gray-800/50 border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                    />
                  </div>
                </div>

                {/* Preset swatches */}
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] mb-2 block uppercase tracking-wide">Palette</label>
                  <div className="grid grid-cols-11 gap-1.5">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => { onChange(c); setHexInput(c); setHsl(hexToHsl(c)); }}
                        className={clsx(
                          'w-full aspect-square rounded-lg border transition-transform hover:scale-110',
                          value === c ? 'border-[var(--text-primary)] ring-2 ring-offset-1 ring-brand-navy/30' : 'border-black/10'
                        )}
                        style={{ backgroundColor: c }}
                      >
                        {value === c && <Check className="w-3 h-3 text-white mx-auto drop-shadow" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
