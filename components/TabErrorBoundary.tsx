import React from 'react';

type Props = {
  tabName: string;
  title: string;
  message: string;
  retryLabel: string;
  accentClassName: string;
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

class TabErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error(`[TabErrorBoundary:${this.props.tabName}]`, error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="px-6 pb-32">
        <div className="rounded-[2rem] app-surface-card p-6 text-center shadow-sm">
          <div className="mb-2 text-base font-bold">{this.props.title}</div>
          <div className="mb-4 text-sm app-text-muted">{this.props.message}</div>
          <button
            type="button"
            onClick={this.handleRetry}
            className={`rounded-full px-4 py-2 text-sm font-semibold text-white ${this.props.accentClassName}`}
          >
            {this.props.retryLabel}
          </button>
        </div>
      </div>
    );
  }
}

export default TabErrorBoundary;
