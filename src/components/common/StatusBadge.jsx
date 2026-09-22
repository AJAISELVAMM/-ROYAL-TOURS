import React from 'react';

// Maps a status string to a semantic color token.
function toneFor(status) {
  const s = (status || '').toLowerCase();
  if (['active', 'verified', 'resolved', 'fair fare', 'within budget', 'online', 'done', 'success', 'acknowledged', 'connected'].includes(s))
    return 'success';
  if (['pending', 'under review', 'slightly high', 'away', 'warn', 'warning', 'escalated', 'medium'].includes(s))
    return 'warning';
  if (['blocked', 'possible overcharge', 'over budget', 'cancelled', 'rejected', 'high', 'failed'].includes(s))
    return 'danger';
  if (['moderate', 'info', 'new'].includes(s)) return 'info';
  return 'neutral';
}

export default function StatusBadge({ status, children, dot }) {
  const tone = toneFor(status);
  return (
    <span className={`badge badge-${tone}`}>
      {dot && <span className="badge-dot" />}
      {children || status}
    </span>
  );
}
