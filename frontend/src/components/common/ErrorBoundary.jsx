import React from 'react';
import { FiAlertCircle, FiRefreshCw } from 'react-icons/fi';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(_error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Detect WebSocket/network errors that should not break the UI
    const isNetworkError = 
      error.message?.includes('WebSocket') ||
      error.message?.includes('Network') ||
      error.message?.includes('fetch') ||
      error.message?.includes('Failed to fetch') ||
      error.message?.includes('ChunkLoadError') || // Vite chunk loading errors
      error.name === 'TypeError';

    if (isNetworkError) {
      if (import.meta.env.DEV) {
        console.warn('Network error caught by ErrorBoundary (not critical):', error);
      }
      // In production, do NOT show error screen for network errors
      if (import.meta.env.PROD) {
        // Auto-reset immediately
        this.setState({ hasError: false, error: null, errorInfo: null });
        return;
      }
      // In development, auto-reset after 2 seconds
      setTimeout(() => {
        this.setState({ hasError: false, error: null, errorInfo: null });
      }, 2000);
      return;
    }

    // For critical errors, maintain current behavior
    // Log error details for debugging - only in development mode
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
    
    this.setState({
      error,
      errorInfo
    });
    
    // You can also log to an error reporting service here
    if (import.meta.env.DEV) {
      console.error('Error details:', {
        error: error.toString(),
        componentStack: errorInfo.componentStack
      });
    }
  }

  handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: null,
      errorInfo: null 
    });
    
    // Optionally reload the page
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '300px',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <FiAlertCircle size={64} color="#ff7c15" style={{ marginBottom: '1rem' }} />
          <h2 style={{ 
            fontSize: '1.5rem', 
            fontWeight: '600', 
            marginBottom: '0.5rem',
            color: '#1e1e1e'
          }}>
            Algo salió mal
          </h2>
          <p style={{ 
            color: '#666', 
            marginBottom: '1.5rem',
            maxWidth: '500px'
          }}>
            {this.props.errorMessage || 'Ha ocurrido un error inesperado. Por favor, intenta recargar la página.'}
          </p>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={this.handleReset}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                background: '#ff7c15',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '1rem',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => e.target.style.background = '#e66d0c'}
              onMouseLeave={(e) => e.target.style.background = '#ff7c15'}
            >
              <FiRefreshCw />
              Intentar de nuevo
            </button>
            
            <button
              onClick={() => window.location.href = '/'}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'white',
                color: '#666',
                border: '1px solid #ddd',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '1rem',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.borderColor = '#ff7c15';
                e.target.style.color = '#ff7c15';
              }}
              onMouseLeave={(e) => {
                e.target.style.borderColor = '#ddd';
                e.target.style.color = '#666';
              }}
            >
              Volver al inicio
            </button>
          </div>
          
          {import.meta.env.DEV && this.state.error && (
            <details style={{ 
              marginTop: '2rem', 
              padding: '1rem',
              background: '#f5f5f5',
              borderRadius: '8px',
              textAlign: 'left',
              maxWidth: '600px',
              width: '100%'
            }}>
              <summary style={{ 
                cursor: 'pointer', 
                fontWeight: '600',
                marginBottom: '0.5rem'
              }}>
                Detalles del error (solo visible en desarrollo)
              </summary>
              <pre style={{ 
                fontSize: '0.875rem', 
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {this.state.error.toString()}
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
