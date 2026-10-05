/** Error boundary: never a blank white surface. */
import { Component, type ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) { return { error }; }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="error-surface">
        <div className="error-box">
          <img src="./emblem.png" alt="" style={{ width: 44, height: 44, borderRadius: 12 }} />
          <h2>Wildlife Incident Handoff Launcher</h2>
          <p style={{ margin: 0, color: "var(--ink-soft)" }}>Something went wrong</p>
          <pre>{this.state.error.message}</pre>
          <div className="btn-row">
            <button className="btn" onClick={() => { this.setState({ error: null }); location.reload(); }}>Retry</button>
            <button
              className="btn ghost"
              onClick={() => { try { void navigator.clipboard.writeText(this.state.error?.stack ?? this.state.error?.message ?? ""); } catch { /* denied */ } }}
            >
              Copy diagnostics
            </button>
          </div>
        </div>
      </div>
    );
  }
}
