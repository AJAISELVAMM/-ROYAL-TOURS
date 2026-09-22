import React from 'react';

export default function Tabs({ tabs, active, onChange, icons = {} }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => {
        const key = typeof tab === 'string' ? tab : tab.key;
        const label = typeof tab === 'string' ? tab : tab.label;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active === key}
            className={`tab ${active === key ? 'tab-active' : ''}`}
            onClick={() => onChange(key)}
          >
            {icons[key]}
            {label}
          </button>
        );
      })}
    </div>
  );
}
