import React from 'react';

export default function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="loading-state">
      <span className="spinner spinner-lg" />
      <span>{label}</span>
    </div>
  );
}
