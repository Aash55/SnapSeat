import { Component } from 'react';

// Last line of defense: if any page throws during render (a bad API response, a null we
// forgot to guard, anything), React would otherwise unmount the whole tree and leave a
// blank screen with no way back except a hard refresh. This catches that, logs it, and
// shows a real "something broke" screen with a button to recover without losing the tab.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled error in app:', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-dark-bg flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-dark-card border border-dark-border rounded-2xl p-8 flex flex-col gap-4 text-center items-center">
            <div className="w-12 h-12 rounded-full bg-danger/15 text-danger flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01" /><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg>
            </div>
            <h1 className="font-display text-2xl font-medium text-white">Something went wrong</h1>
            <p className="text-sm text-gray-text leading-relaxed">
              This screen hit an unexpected error and couldn&rsquo;t render. Your data is safe — try again.
            </p>
            <button
              type="button"
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              className="h-11 px-5 rounded-xl bg-gold text-dark-bg hover:bg-gold-hover transition-colors font-bold text-sm"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
