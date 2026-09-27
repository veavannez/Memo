import React from 'react';

type State = { hasError: boolean };

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('MEMO recovered from a page error', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-paper flex items-center justify-center px-5">
          <div className="card-editorial max-w-lg p-8 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sticky-pink">Something went wrong</p>
            <h1 className="text-2xl font-bold mt-2">MEMO could not render this page.</h1>
            <p className="text-sm text-ink-muted mt-3">Your saved project data is safe. Reload the page, or return to your projects and try again.</p>
            <div className="flex justify-center gap-3 mt-6">
              <button className="btn-primary" onClick={() => window.location.reload()}>Reload</button>
              <a className="btn-secondary" href="/projects">All Projects</a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}