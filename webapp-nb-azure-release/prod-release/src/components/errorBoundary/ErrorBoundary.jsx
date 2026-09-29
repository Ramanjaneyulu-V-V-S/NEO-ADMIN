import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  isChunkLoadError(error) {
    if (!error) return false;
    const message = error?.message || "";
    return error.name === "ChunkLoadError" || message.includes("Loading chunk") || message.includes("dynamically imported module");
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isChunkError = this.isChunkLoadError(this.state.error);

      return (
        <div className="d-flex flex-column align-items-center justify-content-center vh-100 text-center p-3">
          <h2 className="mb-3 text-dark">{isChunkError ? "A new version is available" : "Something went wrong"}</h2>
          <p className="mb-4 text-muted error-boundary-message">
            {isChunkError ? "The application has been updated. Please refresh to load the latest version." : "An unexpected error occurred. Please try again."}
          </p>
          <div className="d-flex gap-3">
            <button onClick={this.handleRetry} className="btn btn-primary">
              Try Again
            </button>
            <button onClick={this.handleRefresh} className="btn btn-secondary">
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
