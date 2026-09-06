import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full text-center space-y-5 p-8 rounded-xl border border-border bg-card shadow-card">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold font-display text-foreground">Something went wrong</h2>
              <p className="text-sm text-muted-foreground">
                An unexpected error occurred. Try refreshing the page or returning home.
              </p>
            </div>
            {this.state.error?.message && (
              <pre className="text-[11px] text-left bg-muted/50 p-3 rounded-md overflow-auto max-h-32 text-muted-foreground">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => window.location.assign("/")}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors"
              >
                Go Home
              </button>
              <button
                onClick={this.handleReset}
                className="px-4 py-2 text-sm font-medium rounded-lg gradient-primary text-primary-foreground hover:opacity-90 transition-opacity inline-flex items-center gap-1.5"
              >
                <RefreshCcw className="w-3.5 h-3.5" /> Try again
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
