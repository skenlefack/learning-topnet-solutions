'use client';

import { Component, type ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  children: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
}

export default class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[Topnet Solutions Academy] Section "${this.props.name || 'unknown'}" crashed:`, error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className={clsx(
            'rounded-xl border border-red-200 dark:border-red-800/40 bg-red-50/50 dark:bg-red-900/10',
            'flex flex-col items-center justify-center p-8 text-center min-h-[200px]',
          )}
        >
          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-3">
            <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" />
          </div>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            Impossible de charger cette section
          </p>
          {this.props.name && (
            <p className="text-xs text-[var(--text-secondary)] mt-1">{this.props.name}</p>
          )}
          <button
            onClick={this.handleRetry}
            className={clsx(
              'mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold',
              'text-brand-navy dark:text-brand-gold bg-white dark:bg-surface-dark-card',
              'border border-[var(--border)] hover:bg-gray-50 dark:hover:bg-gray-800/50',
              'transition-colors',
            )}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            R&eacute;essayer
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
