import React, { useState, useEffect } from 'react';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Icon from '../../components/common/Icon.jsx';
import Tabs from '../../components/common/Tabs.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import RealMap from '../../components/maps/RealMap.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import * as sosService from '../../services/sosService.js';
import * as safetyService from '../../services/safetyService.js';
import { onSocketEvent } from '../../services/socket.js';

export default function AdminSafety() {
  const { push } = useToast();
  const [tab, setTab] = useState('alerts');
  const [sosRequests, setSosRequests] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [liveTourists, setLiveTourists] = useState(new Map());
  const [selectedFocus, setSelectedFocus] = useState(null);

  const load = () => {
    sosService.getActiveSOS().then(setSosRequests).catch(() => {});
    safetyService.getSafetyAlerts().then(setAlerts).catch(() => {});
  };

  useEffect(load, []);

  // Live Socket.IO event listeners for Admin Safety Room
  useEffect(() => {
    const offs = [
      onSocketEvent('admin:sos:new', (data) => {
        push(`🚨 New SOS: ${data?.emergencyType || 'Emergency'} from ${data?.touristName || 'Tourist'}`, 'error');
        load();
      }),
      onSocketEvent('admin:sos:update', () => load()),
      onSocketEvent('admin:sos:location:update', (data) => {
        if (data?.userId && data.latitude && data.longitude) {
          setLiveTourists((prev) => {
            const next = new Map(prev);
            next.set(data.userId, { ...data, isSos: true });
            return next;
          });
        }
      }),
      onSocketEvent('admin:tourist:location', (data) => {
        if (data?.userId && data.latitude && data.longitude) {
          setLiveTourists((prev) => {
            const next = new Map(prev);
            next.set(data.userId, data);
            return next;
          });
        }
      }),
      onSocketEvent('admin:report:new', () => load())
    ];
    return () => offs.forEach((off) => off());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeSOS = sosRequests.filter((s) => s.status === 'active' || s.status === 'acknowledged' || s.status === 'escalated');
  const resolvedSOS = sosRequests.filter((s) => s.status === 'resolved' || s.status === 'cancelled');

  const high = alerts.filter((a) => a.severity === 'high' && a.status === 'active').length;
  const medium = alerts.filter((a) => a.severity === 'medium' && a.status === 'active').length;
  const resolved = alerts.filter((a) => a.status === 'resolved').length;

  async function sosAction(id, status) {
    try {
      await sosService.updateSOSStatus(id, status);
      push(`SOS ${status}`, 'success');
      load();
    } catch (e) {
      push(e?.message || 'Could not update SOS.', 'error');
    }
  }

  function alertAction(id, status) {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    push(`Alert ${status}`, 'success');
  }

  function escalate(id) {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, severity: 'high' } : a)));
    push('Alert escalated', 'success');
  }

  // Compile real live markers for RealMap
  const mapMarkers = [
    // 1. Live SOS markers
    ...activeSOS.map((s) => ({
      id: `sos-${s.id}`,
      latitude: s.latitude,
      longitude: s.longitude,
      name: `🚨 SOS: ${s.touristName} (${s.emergencyType})`,
      category: `Phone: ${s.phone}`,
      address: s.locationText,
      type: 'SOS',
      color: '#dc2626'
    })),
    // 2. Other tracked live tourists
    ...Array.from(liveTourists.values())
      .filter((t) => !activeSOS.some((s) => s.touristId === t.userId))
      .map((t) => ({
        id: `tourist-${t.userId}`,
        latitude: t.latitude,
        longitude: t.longitude,
        name: `Tourist: ${t.userName || 'Active Tourist'}`,
        category: 'Live GPS',
        type: 'YOU',
        color: '#7c3aed'
      }))
  ];

  return (
    <div className="page-inner">
      <h1 className="page-title">Safety Command & Control Center</h1>
      <p className="page-sub">Monitor live tourist GPS locations, emergency SOS alerts, and incidents in real time.</p>

      {/* Active SOS — top priority */}
      <h2 className="section-title section-title-danger"><Icon name="siren" size={20} /> Active SOS Dispatches</h2>
      {activeSOS.length === 0 ? (
        <Card>
          <EmptyState icon="shield-check" title="No active SOS" message="All clear. Active emergency dispatches will appear here instantly." />
        </Card>
      ) : (
        <div className="sos-admin-list">
          {activeSOS.map((s) => (
            <Card key={s.id} className="sos-admin-card" padded={false}>
              <div className="sos-admin-head">
                <span className="sos-live-dot" />
                <strong>ACTIVE EMERGENCY SOS</strong>
                <StatusBadge status={s.status}>{s.status.toUpperCase()}</StatusBadge>
              </div>
              <div className="sos-admin-grid">
                <div className="sos-admin-field">
                  <span className="sos-detail-label">Tourist</span>
                  <span className="sos-detail-value">{s.touristName}</span>
                </div>
                <div className="sos-admin-field">
                  <span className="sos-detail-label">Phone</span>
                  <span className="sos-detail-value">{s.phone}</span>
                </div>
                <div className="sos-admin-field">
                  <span className="sos-detail-label">Emergency Type</span>
                  <span className="sos-detail-value sos-emergency">{s.emergencyType}</span>
                </div>
                <div className="sos-admin-field">
                  <span className="sos-detail-label">Location</span>
                  <span className="sos-detail-value">{s.locationText}</span>
                </div>
                <div className="sos-admin-field">
                  <span className="sos-detail-label">GPS Coordinates</span>
                  <span className="sos-detail-value" style={{ fontFamily: 'monospace' }}>
                    {s.latitude.toFixed(5)}, {s.longitude.toFixed(5)}
                  </span>
                </div>
                <div className="sos-admin-field">
                  <span className="sos-detail-label">Timestamp</span>
                  <span className="sos-detail-value">{new Date(s.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
              <div className="sos-admin-actions">
                <Button
                  size="sm"
                  variant="outline"
                  icon="map-pin"
                  onClick={() => {
                    setSelectedFocus({ latitude: s.latitude, longitude: s.longitude, name: s.touristName });
                    setTab('map');
                    push(`Centered map on ${s.touristName}`, 'info');
                  }}
                >
                  View on Live Map
                </Button>
                {s.status === 'active' && (
                  <Button size="sm" variant="outline" icon="check" onClick={() => sosAction(s.id, 'acknowledged')}>Acknowledge</Button>
                )}
                {s.phone && s.phone !== '—' && (
                  <Button size="sm" variant="outline" icon="phone" onClick={() => window.open(`tel:${s.phone}`)}>
                    Call Tourist
                  </Button>
                )}
                <Button size="sm" variant="outline" icon="trending-up" onClick={() => sosAction(s.id, 'escalated')}>Escalate</Button>
                <Button size="sm" icon="check-circle" onClick={() => sosAction(s.id, 'resolved')}>Mark Resolved</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Priority summary */}
      <div className="overview-grid overview-grid-admin safety-summary">
        <Card className="stat-card">
          <span className="stat-icon" style={{ background: '#ef44441a', color: '#ef4444' }}><Icon name="alert-triangle" size={22} /></span>
          <div className="stat-info"><span className="stat-label">High Priority</span><span className="stat-value">{high}</span></div>
        </Card>
        <Card className="stat-card">
          <span className="stat-icon" style={{ background: '#f59e0b1a', color: '#f59e0b' }}><Icon name="alert-circle" size={22} /></span>
          <div className="stat-info"><span className="stat-label">Medium Priority</span><span className="stat-value">{medium}</span></div>
        </Card>
        <Card className="stat-card">
          <span className="stat-icon" style={{ background: '#10b9811a', color: '#10b981' }}><Icon name="check-circle" size={22} /></span>
          <div className="stat-info"><span className="stat-label">Resolved</span><span className="stat-value">{resolved}</span></div>
        </Card>
      </div>

      <Tabs
        tabs={[
          { key: 'alerts', label: 'Safety Alerts' },
          { key: 'map', label: 'Live Tourist & SOS Map' },
          { key: 'reports', label: 'Safety Reports' }
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'alerts' && (
        <Card padded={false}>
          {alerts.length === 0 ? (
            <EmptyState icon="shield" title="No safety alerts" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Type</th><th>Location</th><th>Severity</th><th>Status</th><th>Date</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {alerts.map((a) => (
                    <tr key={a.id}>
                      <td><strong>{a.type}</strong></td>
                      <td>{a.location}</td>
                      <td><StatusBadge status={a.severity}>{a.severity}</StatusBadge></td>
                      <td><StatusBadge status={a.status}>{a.status}</StatusBadge></td>
                      <td>{a.date}</td>
                      <td>
                        <div className="table-actions">
                          {a.status === 'active' && (
                            <>
                              <button className="icon-btn" title="Resolve" onClick={() => alertAction(a.id, 'resolved')}><Icon name="check-circle" size={16} /></button>
                              <button className="icon-btn" title="Escalate" onClick={() => escalate(a.id)}><Icon name="trending-up" size={16} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'map' && (
        <Card padded={false} style={{ overflow: 'hidden' }}>
          <RealMap
            selectedLocation={selectedFocus}
            markers={mapMarkers}
            height="480px"
          />
          <div style={{ padding: '12px 18px', background: '#fafbfc', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px', color: 'var(--text-muted)' }}>
            <span>🔴 Red Pins: Active Emergency SOS • 🟣 Purple Pins: Live Tourist GPS</span>
            <span>Real-time Socket.IO Stream Active</span>
          </div>
        </Card>
      )}

      {tab === 'reports' && (
        <Card padded={false}>
          {alerts.filter((a) => a.reporter).length === 0 && resolvedSOS.length === 0 ? (
            <EmptyState icon="alert-triangle" title="No safety reports" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Issue</th><th>Location</th><th>Date</th><th>Severity</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {alerts.filter((a) => a.reporter).map((a) => (
                    <tr key={a.id}>
                      <td><strong>{a.type}</strong><span className="table-sub">by {a.reporter}</span></td>
                      <td>{a.location}</td>
                      <td>{a.date}</td>
                      <td><StatusBadge status={a.severity}>{a.severity}</StatusBadge></td>
                      <td><StatusBadge status={a.status}>{a.status}</StatusBadge></td>
                      <td>
                        <div className="table-actions">
                          {a.status === 'active' && (
                            <>
                              <button className="icon-btn" onClick={() => alertAction(a.id, 'resolved')}><Icon name="check-circle" size={16} /></button>
                              <button className="icon-btn" onClick={() => escalate(a.id)}><Icon name="trending-up" size={16} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {resolvedSOS.length > 0 && (
        <div className="resolved-sos" style={{ marginTop: '24px' }}>
          <h3 className="section-title">Resolved / Cancelled SOS</h3>
          {resolvedSOS.map((s) => (
            <div className="account-row" key={s.id}>
              <span className="marker-icon green"><Icon name="shield-check" size={18} /></span>
              <div>
                <strong>{s.touristName} — {s.emergencyType}</strong>
                <span>{s.locationText} • {new Date(s.timestamp).toLocaleString()}</span>
              </div>
              <StatusBadge status={s.status}>{s.status}</StatusBadge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
