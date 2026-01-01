import React, { useState, useEffect, useCallback } from 'react';

// Simple event emitter for toasts
const toastEvents = {
  listeners: [],
  emit(toast) {
    this.listeners.forEach(fn => fn(toast));
  },
  subscribe(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }
};

// Export function to show toasts from anywhere
export const showToast = (message, type = 'info') => {
  toastEvents.emit({ message, type, id: Date.now() });
};

function Toast() {
  console.log('Toast rendering');
  const [toasts, setToasts] = useState([]);
  
  useEffect(() => {
    console.log('Toast: subscribing to events');
    return toastEvents.subscribe((toast) => {
      setToasts(prev => [...prev, toast]);
      
      // Auto-remove after 3 seconds
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, 3000);
    });
  }, []);
  
  if (toasts.length === 0) {
    return null;
  }
  
  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}

export default Toast;
