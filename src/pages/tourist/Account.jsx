import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Icon from '../../components/common/Icon.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Tabs from '../../components/common/Tabs.jsx';
import Modal from '../../components/common/Modal.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import * as authService from '../../services/authService.js';
import * as sosService from '../../services/sosService.js';
import * as safetyService from '../../services/safetyService.js';
import * as tripService from '../../services/tripService.js';

export default function Account() {
  const { user, logout, setAuthenticatedSession } = useAuth();
  const { push } = useToast();
  const [tab, setTab] = useState('profile');
  const [cancelSOS, setCancelSOS] = useState(null);
  const [sosHistory, setSosHistory] = useState([]);
  const [myReports, setMyReports] = useState([]);
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const cameraInputRef = useRef(null);
  const albumInputRef = useRef(null);

  function openPasswordModal() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setPasswordError('');
    setPasswordModalOpen(true);
  }

  function closePasswordModal() {
    setPasswordModalOpen(false);
    setPasswordError('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordError('');

    if (!currentPassword) {
      setPasswordError('Current password is required.');
      return;
    }
    if (!newPassword) {
      setPasswordError('New password is required.');
      return;
    }
    if (newPassword.trim().length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (!confirmPassword) {
      setPasswordError('Please confirm your new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setPasswordLoading(true);
    const res = await authService.changePassword(currentPassword, newPassword);
    setPasswordLoading(false);

    if (!res.success) {
      setPasswordError(res.error || 'The current password you entered is incorrect.');
      return;
    }

    closePasswordModal();
    push('Password Changed Successfully! Your password has been updated successfully. You can now log in with your new password.', 'success');
  }

  useEffect(() => {
    let active = true;
    sosService.getSOSHistory(user?.id).then((h) => active && setSosHistory(h)).catch(() => {});
    safetyService.getMyReports().then((r) => active && setMyReports(r)).catch(() => {});
    tripService.getTrips(user?.id).then((t) => active && setTrips(t)).catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.id]);

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      push('Please select a valid image file (JPEG, PNG, WEBP).', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      push('Image size must be less than 5MB.', 'error');
      return;
    }

    setUploadingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataUrl = reader.result;
          const updatedUser = await authService.updateProfileAvatar(dataUrl);
          if (setAuthenticatedSession) {
            setAuthenticatedSession({ user: updatedUser });
          }
          push('Profile photo updated successfully!', 'success');
          setPhotoModalOpen(false);
        } catch (err) {
          push(err?.message || 'Failed to update profile photo.', 'error');
        } finally {
          setUploadingPhoto(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setUploadingPhoto(false);
      push('Could not process image file.', 'error');
    }
  }

  async function handleRemovePhoto() {
    setUploadingPhoto(true);
    try {
      const updatedUser = await authService.removeProfileAvatar();
      if (setAuthenticatedSession) {
        setAuthenticatedSession({ user: updatedUser });
      }
      push('Profile photo removed.', 'info');
      setPhotoModalOpen(false);
    } catch (err) {
      push(err?.message || 'Failed to remove profile photo.', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function doCancelSOS() {
    try {
      await sosService.cancelSOS(cancelSOS.id);
      push('SOS request cancelled', 'success');
      setCancelSOS(null);
      sosService.getSOSHistory(user?.id).then(setSosHistory).catch(() => {});
    } catch (e) {
      push(e?.message || 'Could not cancel SOS.', 'error');
    }
  }

  return (
    <div className="page-inner">
      <h1 className="page-title">Account</h1>
      <p className="page-sub">Manage your profile, trips and safety history.</p>

      <Tabs
        tabs={[
          { key: 'profile', label: 'Profile' },
          { key: 'trips', label: 'My Trips' },
          { key: 'reports', label: 'My Reports' },
          { key: 'sos', label: 'SOS History' }
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'profile' && (
        <Card className="account-card">
          <div className="profile-head">
            <div
              style={{ position: 'relative', cursor: 'pointer', display: 'inline-block' }}
              onClick={() => setPhotoModalOpen(true)}
              title="Click to change photo"
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="avatar avatar-lg"
                  style={{ objectFit: 'cover', width: '56px', height: '56px', borderRadius: '50%' }}
                />
              ) : (
                <span className="avatar avatar-lg">{user?.name?.[0]?.toUpperCase()}</span>
              )}
              <span
                style={{
                  position: 'absolute',
                  bottom: '0',
                  right: '0',
                  background: 'var(--purple)',
                  color: '#ffffff',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                }}
              >
                <Icon name="camera" size={12} />
              </span>
            </div>
            <div>
              <h2>{user?.name}</h2>
              <span className="profile-role"><Icon name="user" size={14} /> Tourist</span>
            </div>
          </div>
          <div className="detail-facts">
            <li><Icon name="mail" size={16} /> {user?.email}</li>
            <li><Icon name="phone" size={16} /> +91 {user?.phone || '—'}</li>
            <li><Icon name="shield-check" size={16} /> Account verified via OTP</li>
          </div>
          <div className="account-actions">
            <Button variant="outline" icon="camera" onClick={() => setPhotoModalOpen(true)}>Change Photo</Button>
            <Button variant="outline" icon="lock" onClick={openPasswordModal}>Change Password</Button>
            <Button variant="danger" icon="logout" onClick={() => logout()}>Logout</Button>
          </div>
        </Card>
      )}

      {tab === 'trips' && (
        <Card>
          {trips.length === 0 ? (
            <EmptyState icon="map" title="No trips yet" message="Your trips will appear here." />
          ) : (
            trips.map((t) => (
              <div
                className="account-row"
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 0',
                  borderBottom: '1px solid var(--border-color, #e5e7eb)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="marker-icon purple"><Icon name="map" size={18} /></span>
                  <div>
                    <strong style={{ fontSize: '15px' }}>{t.destination}</strong>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      <span>{t.dates || 'Active'} • {t.duration}</span>
                      {t.members?.length > 0 && <span> • {t.members.length} {t.members.length === 1 ? 'member' : 'members'}</span>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <StatusBadge status={t.status}>{t.status === 'completed' ? 'Completed' : 'Active'}</StatusBadge>
                  <Button size="sm" variant="outline" icon="eye" onClick={() => setSelectedTrip(t)}>
                    View Details
                  </Button>
                </div>
              </div>
            ))
          )}
        </Card>
      )}

      {tab === 'reports' && (
        <Card>
          {myReports.length === 0 ? (
            <EmptyState icon="alert-triangle" title="No reports" message="Reports you submit will appear here." />
          ) : (
            myReports.map((r) => (
              <div className="account-row" key={r.id}>
                <span className="marker-icon amber"><Icon name="alert-triangle" size={18} /></span>
                <div>
                  <strong>{r.category} — {r.location}</strong>
                  <span>{r.id} • {r.date}</span>
                </div>
                <StatusBadge status={r.status}>{r.status}</StatusBadge>
              </div>
            ))
          )}
        </Card>
      )}

      {tab === 'sos' && (
        <Card>
          {sosHistory.length === 0 ? (
            <EmptyState icon="siren" title="No SOS history" message="Your emergency SOS requests will appear here." />
          ) : (
            sosHistory.map((s) => (
              <div className="account-row" key={s.id}>
                <span className="marker-icon red"><Icon name="siren" size={18} /></span>
                <div>
                  <strong>{s.type} — {s.location}</strong>
                  <span>{s.date}</span>
                </div>
                <div className="row-actions">
                  <StatusBadge status={s.status}>{s.status}</StatusBadge>
                  {s.status === 'Active' && (
                    <Button size="sm" variant="danger" onClick={() => setCancelSOS({ id: s.id })}>Cancel SOS</Button>
                  )}
                </div>
              </div>
            ))
          )}
        </Card>
      )}

      <Modal
        open={!!cancelSOS}
        onClose={() => setCancelSOS(null)}
        title="Cancel SOS"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelSOS(null)}>Keep SOS</Button>
            <Button variant="danger" onClick={doCancelSOS}>Cancel SOS Request</Button>
          </>
        }
      >
        <p>Are you sure you want to cancel this SOS request? This will mark it as cancelled for responders.</p>
      </Modal>

      {/* Profile Photo Modal */}
      <Modal
        open={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        title="Profile Photo"
        size="sm"
        footer={
          <Button variant="ghost" onClick={() => setPhotoModalOpen(false)}>
            Cancel
          </Button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px 0' }}>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={cameraInputRef}
            style={{ display: 'none' }}
            onChange={handleFileSelected}
          />
          <input
            type="file"
            accept="image/*"
            ref={albumInputRef}
            style={{ display: 'none' }}
            onChange={handleFileSelected}
          />

          <Button
            variant="outline"
            icon="camera"
            loading={uploadingPhoto}
            onClick={() => cameraInputRef.current?.click()}
            style={{ justifyContent: 'flex-start' }}
          >
            Take Photo (Camera)
          </Button>

          <Button
            variant="outline"
            icon="image"
            loading={uploadingPhoto}
            onClick={() => albumInputRef.current?.click()}
            style={{ justifyContent: 'flex-start' }}
          >
            Choose from Album
          </Button>

          {user?.avatarUrl && (
            <Button
              variant="danger"
              icon="trash-2"
              loading={uploadingPhoto}
              onClick={handleRemovePhoto}
              style={{ justifyContent: 'flex-start' }}
            >
              Remove Photo
            </Button>
          )}
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        open={passwordModalOpen}
        onClose={closePasswordModal}
        title="Change Password"
        size="sm"
      >
        <form onSubmit={handleChangePassword} className="modal-form">
          <label className="field">
            <span className="field-label">Current Password</span>
            <div className="field-control">
              <Icon name="lock" size={16} />
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="field-eye"
                onClick={() => setShowCurrentPassword((v) => !v)}
                aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
              >
                <Icon name={showCurrentPassword ? 'eye-off' : 'eye'} size={16} />
              </button>
            </div>
          </label>

          <label className="field">
            <span className="field-label">New Password</span>
            <div className="field-control">
              <Icon name="lock" size={16} />
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="field-eye"
                onClick={() => setShowNewPassword((v) => !v)}
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              >
                <Icon name={showNewPassword ? 'eye-off' : 'eye'} size={16} />
              </button>
            </div>
          </label>

          <label className="field">
            <span className="field-label">Confirm New Password</span>
            <div className="field-control">
              <Icon name="lock" size={16} />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="field-eye"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                <Icon name={showConfirmPassword ? 'eye-off' : 'eye'} size={16} />
              </button>
            </div>
          </label>

          <div style={{ margin: '-4px 0 16px', display: 'flex', justifyContent: 'flex-start' }}>
            <Link
              to="/forgot-password"
              className="link-btn"
              onClick={closePasswordModal}
            >
              Forgot Password?
            </Link>
          </div>

          {passwordError && (
            <div className="form-error">
              <Icon name="alert-circle" size={15} /> {passwordError}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <Button type="button" variant="outline" onClick={closePasswordModal} disabled={passwordLoading}>
              Cancel
            </Button>
            <Button type="submit" loading={passwordLoading}>
              Change Password
            </Button>
          </div>
        </form>
      </Modal>

      {/* Trip Details Modal */}
      <Modal
        open={!!selectedTrip}
        onClose={() => setSelectedTrip(null)}
        title={selectedTrip ? `Trip Details — ${selectedTrip.destination}` : 'Trip Details'}
        size="lg"
        footer={<Button onClick={() => setSelectedTrip(null)}>Close</Button>}
      >
        {selectedTrip && (
          <div className="report-detail">
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="map-pin" size={16} /> Trip Information
              </h3>
              <div className="detail-facts">
                <li><Icon name="map" size={15} /> <strong>Destination:</strong> {selectedTrip.destination} {selectedTrip.destinationAddress ? `(${selectedTrip.destinationAddress})` : ''}</li>
                <li><Icon name="calendar" size={15} /> <strong>Trip Dates:</strong> {selectedTrip.dates || (selectedTrip.startDate && selectedTrip.endDate ? `${selectedTrip.startDate.slice(0, 10)} to ${selectedTrip.endDate.slice(0, 10)}` : 'Active')}</li>
                {selectedTrip.startDate && <li><Icon name="clock" size={15} /> <strong>Start Date:</strong> {new Date(selectedTrip.startDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</li>}
                {selectedTrip.endDate && <li><Icon name="clock" size={15} /> <strong>End Date:</strong> {new Date(selectedTrip.endDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</li>}
                <li><Icon name="info" size={15} /> <strong>Status:</strong> <StatusBadge status={selectedTrip.status}>{selectedTrip.status === 'completed' ? 'Completed' : 'Active'}</StatusBadge></li>
                <li><Icon name="clock" size={15} /> <strong>Duration:</strong> {selectedTrip.duration || `${selectedTrip.durationDays || 2} Days`}</li>
                <li><Icon name="wallet" size={15} /> <strong>Budget:</strong> ₹{(selectedTrip.budget || 0).toLocaleString('en-IN')}</li>
                <li><Icon name="users" size={15} /> <strong>Group Type:</strong> {selectedTrip.group || 'Friends'} ({selectedTrip.memberCount || selectedTrip.members?.length || 1} travelers)</li>
                <li><Icon name="users" size={15} /> <strong>Travel Group Join Code:</strong> {selectedTrip.joinCode || selectedTrip.groupCode || '—'}</li>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="users" size={16} /> Team Information ({selectedTrip.members?.length || 0})
              </h3>
              <div className="group-list">
                {(!selectedTrip.members || selectedTrip.members.length === 0) ? (
                  <p className="section-sub">No team members recorded for this trip.</p>
                ) : (
                  selectedTrip.members.map((m) => (
                    <div className="group-member" key={m.userId || m.id || m.phone}>
                      <span className="member-avatar">
                        {m.avatarUrl ? (
                          <img
                            src={m.avatarUrl}
                            alt={m.name || 'Member'}
                            style={{ objectFit: 'cover', width: '100%', height: '100%', borderRadius: '50%' }}
                          />
                        ) : (
                          (m.name ? m.name.charAt(0).toUpperCase() : 'M')
                        )}
                      </span>
                      <div className="member-info">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <strong>{m.name}</strong>
                          {(m.role === 'Owner' || m.userId === selectedTrip.touristId) && (
                            <span className="chip chip-muted">Lead</span>
                          )}
                        </div>
                        <span className="member-meta">
                          {m.phone || '—'} · <Icon name="check-circle" size={13} /> {selectedTrip.status === 'completed' ? 'Completed Journey' : 'Active Member'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
