import React, { useState, useEffect } from 'react';
import Card from '../../components/common/Card.jsx';
import Icon from '../../components/common/Icon.jsx';
import AdminStatCard from '../../components/admin/AdminStatCard.jsx';
import { ProgressBar } from '../../components/common/Chart.jsx';
import * as adminService from '../../services/adminService.js';

const KIND_LABEL = { FARE: 'Fare Model', SAFETY: 'Safety Model' };

export default function AdminAI() {
  const [stats, setStats] = useState({ tripPlansGenerated: 0, recommendations: 0, fareChecks: 0, reviewSummaries: 0, userRating: 4.6, modules: [] });
  const [models, setModels] = useState([]);
  const [mlService, setMlService] = useState({ configured: false });

  useEffect(() => {
    adminService.getAIStats().then(setStats).catch(() => {});
    adminService.getModels().then((r) => { setModels(r.models); setMlService(r.mlService); }).catch(() => {});
  }, []);

  const pct = (v) => (v != null ? `${Math.round(v * 100)}%` : '—');

  return (
    <div className="page-inner">
      <h1 className="page-title">AI & Recommendations</h1>
      <p className="page-sub">Monitor AI-powered features and trained models across the platform.</p>

      <div className="overview-grid overview-grid-admin">
        <AdminStatCard icon="map" label="Trip Plans Generated" value={stats.tripPlansGenerated.toLocaleString('en-IN')} tone="purple" />
        <AdminStatCard icon="sparkles" label="Recommendations" value={stats.recommendations.toLocaleString('en-IN')} tone="blue" />
        <AdminStatCard icon="target" label="Fare Checks" value={stats.fareChecks.toLocaleString('en-IN')} tone="green" />
        <AdminStatCard icon="message-square" label="Review Summaries" value={stats.reviewSummaries.toLocaleString('en-IN')} tone="amber" />
        <AdminStatCard icon="star" label="User Rating" value={`${stats.userRating} / 5`} tone="purple" />
      </div>

      <div className="ai-grid">
        <Card className="ai-usage-card">
          <div className="card-head"><h2>Module Usage</h2></div>
          <div className="progress-list">
            {stats.modules.map((m) => (
              <ProgressBar key={m.name} label={m.name} value={m.usage} />
            ))}
          </div>
        </Card>

        <Card className="ai-modules-card">
          <div className="card-head"><h2>AI Modules</h2></div>
          <div className="module-grid">
            {stats.modules.map((m) => (
              <div className="module-chip" key={m.name}>
                <span className="stat-icon purple"><Icon name="sparkles" size={18} /></span>
                <div>
                  <strong>{m.name}</strong>
                  <span>{m.usage}% adoption</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Trained models — real metadata from the model registry */}
      <h2 className="section-title">Trained Models</h2>
      <div className="model-status-line">
        ML inference service:
        <span className={`chip ${mlService.configured && mlService.healthy ? 'chip-success' : 'chip-muted'}`}>
          {mlService.configured ? (mlService.healthy ? 'online' : 'unreachable — using fallback engines') : 'not configured — using fallback engines'}
        </span>
      </div>

      {models.length === 0 ? (
        <Card><p className="group-empty-note">No trained models registered yet. Run the training pipeline and `npm run models:register`.</p></Card>
      ) : (
        <div className="model-grid">
          {models.map((m) => (
            <Card key={m.key} className="model-card">
              <div className="card-head">
                <h3>{KIND_LABEL[m.kind] || m.kind}</h3>
                <span className="chip chip-muted">{m.key}</span>
              </div>
              <div className="model-facts">
                <div className="detail-facts">
                  <li><Icon name="layers" size={15} /> Version: <strong>{m.version}</strong></li>
                  <li><Icon name="calendar" size={15} /> Trained: <strong>{m.trainingDate ? new Date(m.trainingDate).toLocaleDateString() : '—'}</strong></li>
                  <li><Icon name="database" size={15} /> Dataset: <strong>{m.datasetVersion || '—'} ({m.datasetSource || 'synthetic'})</strong></li>
                  <li><Icon name="activity" size={15} /> Accuracy: <strong>{pct(m.metrics?.accuracy)}</strong></li>
                  <li><Icon name="target" size={15} /> F1 (weighted): <strong>{pct(m.metrics?.f1_weighted)}</strong></li>
                  <li><Icon name="shield" size={15} /> Status: <strong>{m.status || 'ACTIVE'}</strong></li>
                </div>
                {(m.metrics?.per_class) && (
                  <div className="model-metrics">
                    {Object.entries(m.metrics.per_class).map(([k, v]) => (
                      <div className="metric-row" key={k}>
                        <span className="metric-label">{k}</span>
                        <span className="metric-bar"><span className="metric-fill" style={{ width: `${Math.round((v.recall || 0) * 100)}%` }} /></span>
                        <span className="metric-value">recall {pct(v.recall)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
