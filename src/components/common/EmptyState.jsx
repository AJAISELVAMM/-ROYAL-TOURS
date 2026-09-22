import React from 'react';
import Icon from './Icon.jsx';

export default function EmptyState({ icon = 'search', title = 'Nothing here yet', message, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon name={icon} size={28} />
      </div>
      <h4>{title}</h4>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}
