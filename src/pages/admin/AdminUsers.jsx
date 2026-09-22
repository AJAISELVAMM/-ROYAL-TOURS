import React, { useState, useEffect } from 'react';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Icon from '../../components/common/Icon.jsx';
import SearchBar from '../../components/common/SearchBar.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Modal from '../../components/common/Modal.jsx';
import Tabs from '../../components/common/Tabs.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import * as adminService from '../../services/adminService.js';

export default function AdminUsers() {
  const { push } = useToast();
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailTab, setDetailTab] = useState('profile');
  const [allUsers, setAllUsers] = useState([]);
  const [detailUser, setDetailUser] = useState(null);

  useEffect(() => {
    adminService.getUsers().then(setAllUsers).catch(() => {});
  }, []);

  useEffect(() => {
    if (!detail) {
      setDetailUser(null);
      return;
    }
    adminService.getUserById(detail).then(setDetailUser).catch(() => {});
  }, [detail]);

  const users = allUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(query.toLowerCase()) ||
      u.email.toLowerCase().includes(query.toLowerCase()) ||
      u.phone.includes(query)
  );

  async function setStatus(id, status) {
    try {
      await adminService.updateUserStatus(id, status);
      setAllUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status } : u)));
      if (detail === id) setDetailUser((u) => (u ? { ...u, status } : u));
      push(`User ${status}`, 'success');
    } catch (e) {
      push(e?.message || 'Could not update user.', 'error');
    }
  }

  return (
    <div className="page-inner">
      <h1 className="page-title">Users</h1>
      <p className="page-sub">Manage tourist accounts and their status.</p>

      <SearchBar value={query} onChange={setQuery} placeholder="Search users by name, email or phone…" />

      <Card padded={false}>
        {users.length === 0 ? (
          <EmptyState title="No users found" message="Try a different search term." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th><th>Email</th><th>Phone</th><th>Trips</th><th>Reports</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="table-user">
                        <span className="avatar avatar-sm">{u.name[0]?.toUpperCase()}</span>
                        <strong>{u.name}</strong>
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td>+91 {u.phone}</td>
                    <td>{u.tripCount}</td>
                    <td>{u.reportCount}</td>
                    <td><StatusBadge status={u.status}>{u.status}</StatusBadge></td>
                    <td>
                      <div className="table-actions">
                        <button className="icon-btn" title="View" onClick={() => { setDetail(u.id); setDetailTab('profile'); }}><Icon name="eye" size={16} /></button>
                        <button className="icon-btn" title="Edit" onClick={() => push('Edit user is coming soon.', 'success')}><Icon name="edit" size={16} /></button>
                        {u.status !== 'active' ? (
                          <button className="icon-btn" title="Activate" onClick={() => setStatus(u.id, 'active')}><Icon name="check-circle" size={16} /></button>
                        ) : (
                          <button className="icon-btn" title="Suspend" onClick={() => setStatus(u.id, 'blocked')}><Icon name="user-x" size={16} /></button>
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

      <Modal open={!!detailUser} onClose={() => setDetail(null)} title={detailUser ? `${detailUser.name} — Details` : 'User Details'} size="lg">
        {detailUser && (
          <div>
            <div className="profile-head">
              <span className="avatar avatar-lg">{detailUser.name[0]?.toUpperCase()}</span>
              <div>
                <h2>{detailUser.name}</h2>
                <div className="profile-meta">
                  <span>{detailUser.email}</span>
                  <span>+91 {detailUser.phone}</span>
                  <StatusBadge status={detailUser.status}>{detailUser.status}</StatusBadge>
                </div>
              </div>
            </div>

            <Tabs
              tabs={[
                { key: 'profile', label: 'Profile' },
                { key: 'trips', label: 'Trips' },
                { key: 'reports', label: 'Reports' },
                { key: 'sos', label: 'SOS History' },
                { key: 'status', label: 'Account Status' }
              ]}
              active={detailTab}
              onChange={setDetailTab}
            />

            {detailTab === 'profile' && (
              <div className="detail-facts">
                <li><Icon name="calendar" size={15} /> Joined {detailUser.joinedAt}</li>
                <li><Icon name="user" size={15} /> Role: Tourist</li>
                <li><Icon name="map" size={15} /> {detailUser.tripCount} trips</li>
                <li><Icon name="alert-triangle" size={15} /> {detailUser.reportCount} reports</li>
              </div>
            )}
            {detailTab === 'trips' && (
              <div>
                {(detailUser.trips || []).length === 0 ? (
                  <EmptyState icon="map" title="No trips" />
                ) : (
                  detailUser.trips.map((t) => (
                    <div className="account-row" key={t.id}>
                      <span className="marker-icon purple"><Icon name="map" size={18} /></span>
                      <div><strong>{t.destination}</strong><span>{t.dates}</span></div>
                    </div>
                  ))
                )}
              </div>
            )}
            {detailTab === 'reports' && (
              <div>
                {(detailUser.reports || []).length === 0 ? (
                  <EmptyState icon="alert-triangle" title="No reports" />
                ) : (
                  detailUser.reports.map((r) => (
                    <div className="account-row" key={r.id}>
                      <span className="marker-icon amber"><Icon name="alert-triangle" size={18} /></span>
                      <div><strong>{r.category} — {r.location}</strong><span>{r.date}</span></div>
                      <StatusBadge status={r.status}>{r.status}</StatusBadge>
                    </div>
                  ))
                )}
              </div>
            )}
            {detailTab === 'sos' && (
              <div>
                {(detailUser.sosHistory || []).length === 0 ? (
                  <EmptyState icon="siren" title="No SOS history" />
                ) : (
                  (detailUser.sosHistory || []).map((s) => (
                    <div className="account-row" key={s.id}>
                      <span className="marker-icon red"><Icon name="siren" size={18} /></span>
                      <div><strong>{s.type} — {s.location}</strong><span>{s.date}</span></div>
                      <StatusBadge status={s.status}>{s.status}</StatusBadge>
                    </div>
                  ))
                )}
              </div>
            )}
            {detailTab === 'status' && (
              <div className="status-actions">
                <p>Current status: <StatusBadge status={detailUser.status}>{detailUser.status}</StatusBadge></p>
                <div>
                  <Button variant="outline" size="sm" onClick={() => { setStatus(detailUser.id, 'active'); setDetail(null); }}>Activate</Button>
                  <Button variant="danger" size="sm" onClick={() => { setStatus(detailUser.id, 'blocked'); setDetail(null); }}>Suspend</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
