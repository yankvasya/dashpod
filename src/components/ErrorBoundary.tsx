import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/** Catches render errors in the wrapped subtree and renders nothing instead of crashing the whole
 * app. Used around UpdateBanner: a Rules-of-Hooks bug there once crashed the app on launch for
 * every device that already had an older build installed, since a fix shipped in a newer release
 * can never patch an already-installed binary — the same class of failure could recur from any
 * future bug in that inherently non-essential piece of UI. Silently dropping the banner beats
 * bricking the app just because "there's an update" couldn't be shown. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('ErrorBoundary caught an error:', error);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
