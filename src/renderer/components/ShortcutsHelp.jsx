import React, { useState } from 'react';

const shortcuts = [
  { key: 'Space', action: 'Play / Pause' },
  { key: 'Tab', action: 'Next flag' },
  { key: 'Shift+Tab', action: 'Previous flag' },
  { key: 'Ctrl+S', action: 'Save' },
  { key: 'Delete', action: 'Delete selected' },
  { key: 'Escape', action: 'Clear selection' },
  { key: 'Click', action: 'Select word' },
  { key: 'Ctrl+Click', action: 'Multi-select' },
  { key: 'Shift+Click', action: 'Range select' },
  { key: 'Double-click', action: 'Edit word' },
  { key: 'Right-click', action: 'Context menu' },
];

function ShortcutsHelp() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  if (isCollapsed) {
    return (
      <div 
        className="shortcuts-help" 
        style={{ padding: '8px 12px', cursor: 'pointer' }}
        onClick={() => setIsCollapsed(false)}
      >
        ⌨️ Shortcuts
      </div>
    );
  }
  
  return (
    <div className="shortcuts-help">
      <h4 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Keyboard Shortcuts
        <span 
          style={{ cursor: 'pointer', opacity: 0.6 }}
          onClick={() => setIsCollapsed(true)}
        >
          ▼
        </span>
      </h4>
      {shortcuts.map(({ key, action }) => (
        <div key={key} className="shortcut-row">
          <span className="shortcut-key">{key}</span>
          <span>{action}</span>
        </div>
      ))}
    </div>
  );
}

export default ShortcutsHelp;
