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
  
  // Remove StrictMode temporarily to reduce double-rendering
  root.render(<App />);
  
  console.log('Index.jsx: Render called');
} catch (e) {
  console.error('Index.jsx: Error during initial render:', e);
}
