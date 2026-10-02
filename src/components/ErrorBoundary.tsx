/** React error boundary: a failed section shows a recoverable message
 *  instead of a blank application. */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Optional label of the area, shown in diagnostics. */
  area?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep diagnostics local: message + component stack, nothing user-entered.
    console.error("[wih] section error", this.props.area ?? "unknown", error.message, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="content" role="alert" style={{ padding: "var(--space-6) var(--space-4)", maxWidth: 640 }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>We couldn't load this section.</h2>
          <p style={{ color: "var(--c-ink-soft)" }}>
            Something went wrong while displaying this part of the app. Your records are safe — this is a display problem,
            not a data problem.
          </p>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-primary btn-sm" onClick={() => this.setState({ error: null })}>Retry</button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const diag = `Wildlife Incident Handoff section error\narea: ${this.props.area ?? "unknown"}\nmessage: ${this.state.error?.message ?? ""}`;
                void navigator.clipboard?.writeText(diag);
              }}
            >
              Copy diagnostics
            </button>
          </div>
        </div>
      </div>
    );
  }
}
