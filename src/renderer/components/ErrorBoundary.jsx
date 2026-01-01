import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
    console.log('ErrorBoundary constructor');
  }

  static getDerivedStateFromError(error) {
    console.log('ErrorBoundary getDerivedStateFromError:', error);
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  componentDidMount() {
    console.log('ErrorBoundary mounted');
  }

  componentDidUpdate() {
    console.log('ErrorBoundary updated, hasError:', this.state.hasError);
  }

  render() {
    console.log('ErrorBoundary render, hasError:', this.state.hasError);
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '24px', 
          background: '#1a1a2e', 
          color: '#e8e8e8',
          height: '100%',
          overflow: 'auto'
        }}>
          <h2 style={{ color: '#ef4444', marginBottom: '16px' }}>Something went wrong</h2>
          <pre style={{ 
            background: '#16213e', 
            padding: '16px', 
            borderRadius: '8px',
            overflow: 'auto',
            fontSize: '12px',
            whiteSpace: 'pre-wrap'
          }}>
            {this.state.error && this.state.error.toString()}
            {'\n\n'}
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              background: '#e94560',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
