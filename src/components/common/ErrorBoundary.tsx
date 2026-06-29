/**
 * Top-level error boundary (Phase R12).
 *
 * Catches render-time errors anywhere in the app and shows a recoverable error
 * state instead of a blank screen.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface to the console for debugging; no external reporting.
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  handleReset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-panel px-6">
        <div className="card max-w-lg p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-negative/40 bg-negative/10 text-2xl text-negative">
            !
          </div>
          <h1 className="text-lg font-semibold text-ink">Something went wrong</h1>
          <p className="mt-2 text-sm text-ink-muted">
            An unexpected error occurred while rendering. Your loaded data is held
            in memory; you can try to recover the view, or reload the page.
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-md border border-panel-border bg-panel p-3 text-left text-xs text-negative">
            {error.message}
          </pre>
          <div className="mt-5 flex justify-center gap-3">
            <button type="button" onClick={this.handleReset} className="btn">
              Try to recover
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn btn-active"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
