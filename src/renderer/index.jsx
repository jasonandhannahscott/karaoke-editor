import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

console.log('Index.jsx: Starting React app');

// Add global error handler
window.onerror = (message, source, lineno, colno, error) => {
  console.error('Global error:', message, source, lineno, colno, error);
};

window.onunhandledrejection = (event) => {
  console.error('Unhandled promise rejection:', event.reason);
};

try {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  console.log('Index.jsx: Root created, rendering App');
  
  // App internally wraps itself in ErrorBoundary
  root.render(<App />);
  
  console.log('Index.jsx: Render called');
} catch (e) {
  console.error('Index.jsx: Error during initial render:', e);
  // Show something to the user if initial render completely fails
  document.getElementById('root').innerHTML = `
    <div style="padding: 40px; color: #e8e8e8; background: #1a1a2e; min-height: 100vh;">
      <h2 style="color: #ef4444;">Failed to start application</h2>
      <pre style="background: #16213e; padding: 16px; border-radius: 8px; overflow: auto;">${e.message}\n${e.stack}</pre>
      <button onclick="location.reload()" style="margin-top: 16px; padding: 8px 16px; background: #e94560; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Reload
      </button>
    </div>
  `;
}
