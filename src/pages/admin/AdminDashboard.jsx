import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Icon from '../../components/common/Icon.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import AdminStatCard from '../../components/admin/AdminStatCard.jsx';
import { BarChart } from '../../components/common/Chart.jsx';
import * as adminService from '../../services/adminService.js';
import * as safetyService from '../../services/safetyService.js';
import * as sosService from '../../services/sosService.js';
import { onSocketEvent } from '../../services/socket.js';

const EMPTY_OVERVIEW = { totalUsers: 0, activeTrips: 0, placesListed: 0, hotelsListed: 0, pendingReports: 0, fareReports: 0, safetyAlerts: 0, activeSOS: 0 };

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState(EMPTY_OVERVIEW);
  const [activity, setActivity] = useState([]);
  const [reports, setReports] = useState([]);
  const [sosRequests, setSosRequests] = useState([]);

  const load = () => {
    adminService.getOverview().then(setOverview).catch(() => {});
    adminService.getActivityLog().then(setActivity).catch(() => {});
    safetyService.getReports().then(setReports).catch(() => {});
    sosService.getActiveSOS().then(setSosRequests).catch(() => {});
  };

  useEffect(load, []);

  // Live dashboard refresh when SOS / reports / system events arrive.
  useEffect(() => {
    const offs = [
      onSocketEvent('admin:sos:new', () => load()),
      onSocketEvent('admin:report:new', () => load()),
      onSocketEvent('admin:dashboard:update', () => load())
    ];
    return () => offs.forEach((off) => off());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recentReports = reports.slice(0, 4);
  const activeSOS = sosRequests.filter((s) => s.status === 'active' || s.status === 'acknowledged');

  return (
    <div className="page-inner">
      <div className="dash-greeting">
        <div>
          <h1 className="page-title">Good Morning, Admin 👋</h1>
          <p className="page-sub">Here's what's happening across ROYAL TOURS today.</p>
        </div>
      </div>

      <h2 className="section-title">Platform Overview</h2>
      <div className="overview-grid overview-grid-admin">
        <AdminStatCard icon="users" label="Total Users" value={overview.totalUsers} tone="purple" />
        <AdminStatCard icon="map" label="Active Trips" value={overview.activeTrips} tone="green" />
        <AdminStatCard icon="map-pin" label="Places Listed" value={overview.placesListed} tone="blue" />
        <AdminStatCard icon="bed" label="Hotels Listed" value={overview.hotelsListed} tone="amber" />
        <AdminStatCard icon="alert-triangle" label="Pending Reports" value={overview.pendingReports} tone="amber" />
        <AdminStatCard icon="wallet" label="Fare Reports" value={overview.fareReports} tone="purple" />
        <AdminStatCard icon="shield" label="Safety Alerts" value={overview.safetyAlerts} tone="red" />
      </div>

      <div className="admin-dash-grid">
        <Card className="admin-chart-card">
          <div className="card-head">
            <h2>Activity Trend</h2>
          </div>
          <BarChart height={180} data={[30, 44, 52, 60, 72, 88]} labels={['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']} />
        </Card>

        <Card className="admin-activity-card">
          <div className="card-head"><h2>Recent Activity</h2></div>
          <div className="activity-list">
            {activity.map((a, i) => (
              <div className="activity-item" key={i}>
                <span className={`activity-dot ${a.status === 'alert' ? 'red' : 'green'}`} />
                <div>
                  <strong>{a.action}</strong>
                  <span>{a.date} • {a.time}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {activeSOS.length > 0 && (
        <Card className="admin-sos-banner">
          <span className="sos-live-dot" />
          <div>
            <strong>Active SOS requests</strong>
            <span>{activeSOS.length} request(s) need attention in the Safety Center.</span>
          </div>
          <Button size="sm" variant="danger" onClick={() => navigate('/control-center/safety')}>Review Now</Button>
        </Card>
      )}

      <h2 className="section-title">Quick Actions</h2>
      <div className="quick-actions">
        <Card className="quick-action" hover onClick={() => navigate('/control-center/travel-data')}>
          <span className="stat-icon purple"><Icon name="plus" size={20} /></span>
          <div><strong>Add Place</strong><span>Add a new attraction or landmark</span></div>
        </Card>
        <Card className="quick-action" hover onClick={() => navigate('/control-center/travel-data')}>
          <span className="stat-icon green"><Icon name="bed" size={20} /></span>
          <div><strong>Add Hotel</strong><span>Add a new accommodation</span></div>
        </Card>
        <Card className="quick-action" hover onClick={() => navigate('/control-center/reports')}>
          <span className="stat-icon amber"><Icon name="alert-triangle" size={20} /></span>
          <div><strong>Review Reports</strong><span>Resolve pending user reports</span></div>
        </Card>
        <Card className="quick-action" hover onClick={() => navigate('/control-center/safety')}>
          <span className="stat-icon red"><Icon name="siren" size={20} /></span>
          <div><strong>Safety Alerts</strong><span>Monitor safety incidents</span></div>
        </Card>
      </div>
    </div>
  );
}
