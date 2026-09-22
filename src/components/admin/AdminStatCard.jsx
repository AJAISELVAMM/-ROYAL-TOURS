import React from 'react';
import Icon from '../common/Icon.jsx';
import Card from '../common/Card.jsx';

const TONES = {
  purple: '#7c3aed',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  blue: '#3b82f6'
};

export default function AdminStatCard({ icon, label, value, sub, tone = 'purple' }) {
  const color = TONES[tone] || TONES.purple;
  return (
    <Card className="stat-card">
      <span className="stat-icon" style={{ background: `${color}1a`, color }}>
        <Icon name={icon} size={22} />
      </span>
      <div className="stat-info">
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
        {sub && <span className="stat-sub">{sub}</span>}
      </div>
    </Card>
  );
}
