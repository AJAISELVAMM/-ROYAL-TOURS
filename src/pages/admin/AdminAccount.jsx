import React, { useState, useEffect } from 'react';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Icon from '../../components/common/Icon.jsx';
import Tabs from '../../components/common/Tabs.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import * as adminService from '../../services/adminService.js';

export default function AdminAccount() {
  const { user, logout } = useAuth();
  const { push } = useToast();
  const [tab, setTab] = useState('profile');
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    adminService.getActivityLog().then(setActivity).catch(() => {});
  }, []);

  return (
    <div className="page-inner">
      <h1 className="page-title">Account</h1>
      <p className="page-sub">Manage your admin profile and system preferences.</p>

      <Tabs
        tabs={[
          { key: 'profile', label: 'Profile' },
          { key: 'security', label: 'Security' },
          { key: 'notifications', label: 'Notifications' },
          { key: 'system', label: 'System Settings' },
          { key: 'logs', label: 'Activity Logs' }
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'profile' && (
        <Card className="account-card">
          <div className="profile-head">
            <span className="avatar avatar-lg avatar-admin">A</span>
            <div>
              <h2>{user?.name || 'ROYAL TOURS Admin'}</h2>
              <span className="profile-role"><Icon name="shield-check" size={14} /> Administrator</span>
            </div>
          </div>
          <div className="detail-facts">
            <li><Icon name="mail" size={16} /> {user?.email || 'admin@royaltours.ai'}</li>
            <li><Icon name="phone" size={16} /> {user?.phone || '—'}</li>
            <li><Icon name="user" size={16} /> Role: Admin</li>
          </div>
        </Card>
      )}

      {tab === 'security' && (
        <Card>
          <div className="card-head"><h2>Security</h2></div>
          <div className="modal-form">
            <label className="field">
              <span className="field-label">Current Password</span>
              <input type="password" placeholder="••••••••" />
            </label>
            <label className="field">
              <span className="field-label">New Password</span>
              <input type="password" placeholder="••••••••" />
            </label>
            <Button icon="lock" onClick={() => push('Password updated', 'success')}>Change Password</Button>
          </div>
          <div className="session-info">
            <h3>Session Information</h3>
            <div className="detail-facts">
              <li><Icon name="cpu" size={15} /> Last login: just now</li>
              <li><Icon name="globe" size={15} /> This session is secured with JWT authentication</li>
            </div>
          </div>
        </Card>
      )}

      {tab === 'notifications' && (
        <Card>
          <div className="card-head"><h2>Notification Preferences</h2></div>
          {[
            { label: 'SOS Alerts', desc: 'Notify me about new SOS requests', on: true },
            { label: 'Report Alerts', desc: 'Notify me about new user reports', on: true },
            { label: 'System Alerts', desc: 'Notify me about system events', on: false }
          ].map((n) => (
            <label className="switch-row" key={n.label}>
              <div><strong>{n.label}</strong><span>{n.desc}</span></div>
              <input type="checkbox" defaultChecked={n.on} />
              <span className="switch" />
            </label>
          ))}
        </Card>
      )}

      {tab === 'system' && (
        <Card>
          <div className="card-head"><h2>System Settings</h2></div>
          <div className="modal-form">
            <label className="field">
              <span className="field-label">Language</span>
              <select defaultValue="en"><option value="en">English</option><option value="hi">Hindi</option><option value="ta">Tamil</option></select>
            </label>
            <label className="field">
              <span className="field-label">Theme</span>
              <select defaultValue="purple"><option value="purple">Purple (default)</option><option value="light">Light</option></select>
            </label>
            <Button icon="check" onClick={() => push('Settings saved', 'success')}>Save Settings</Button>
          </div>
        </Card>
      )}

      {tab === 'logs' && (
        <Card padded={false}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Admin Action</th><th>Date</th><th>Time</th><th>Status</th></tr>
              </thead>
              <tbody>
                {activity.map((l, i) => (
                  <tr key={i}>
                    <td><strong>{l.action}</strong></td>
                    <td>{l.date}</td>
                    <td>{l.time}</td>
                    <td><StatusBadge status={l.status}>{l.status === 'alert' ? 'Attention' : 'Done'}</StatusBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="account-actions admin-logout">
        <Button variant="danger" icon="logout" onClick={() => logout()}>Logout</Button>
      </div>
    </div>
  );
}
