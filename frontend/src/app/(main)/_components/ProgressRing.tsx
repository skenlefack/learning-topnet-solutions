'use client';
// ============================================================================
// Topnet Solutions Academy — Animated Progress Ring (SVG)
// stroke-dashoffset animated via CSS transition
// ============================================================================

interface ProgressRingProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  trailColor?: string;
  strokeColor?: string;
  className?: string;
  children?: React.ReactNode;
}

export default function ProgressRing({
  percent,
  size = 80,
  strokeWidth = 6,
  trailColor = 'rgba(255,255,255,0.15)',
  strokeColor = '#00B341',
  className = '',
  children,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Trail */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trailColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      {/* Center label */}
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}
