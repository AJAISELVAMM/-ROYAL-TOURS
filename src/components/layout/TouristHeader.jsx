import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../common/Icon.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { onSocketEvent } from '../../services/socket.js';
import { stopSOSAlert, triggerIncomingSOSAlert } from '../../utils/sosSound.js';
import * as tripService from '../../services/tripService.js';
import { api } from '../../services/api.js';
import { setState } from '../../store.js';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
function isFresh(n) {
  if (!n.createdAt) return true;
  const t = new Date(n.createdAt).getTime();
  return !isNaN(t) ? (Date.now() - t) < TWENTY_FOUR_HOURS_MS : true;
}

export default function TouristHeader({ onMenu, title }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { push } = useToast();
  const [notifications, setNotifications] = useState(() => [
    {
      id: 'init-1',
      title: 'Welcome to ROYAL TOURS',
      message: 'Explore destinations, track live safety, and manage your travel group.',
      type: 'info',
      time: 'Just now',
      createdAt: new Date().toISOString(),
      read: false
    }
  ]);
  const [notifOpen, setNotifOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Load persistent notifications from PostgreSQL on mount (filtered to past 24h)
  useEffect(() => {
    if (user?.id) {
      api.get('/auth/notifications').then((list) => {
        if (Array.isArray(list) && list.length > 0) {
          const mapped = list
            .filter((item) => isFresh(item))
            .map((item) => {
              let payloadObj = {};
              try {
                payloadObj = typeof item.payload === 'string' ? JSON.parse(item.payload) : (item.payload || {});
              } catch {
                // ignore
              }
              return {
                id: item.id,
                tripId: item.tripId || payloadObj.tripId,
                destination: item.destination || payloadObj.destination,
                creatorName: item.creatorName || payloadObj.creatorName,
                dates: item.dates || payloadObj.dates,
                sosId: payloadObj.sosId,
                userId: payloadObj.userId,
                latitude: payloadObj.latitude,
                longitude: payloadObj.longitude,
                title: item.type === 'TRIP_INVITE' ? 'Trip Invitation' : item.type === 'SOS' || item.type === 'GROUP_SOS' ? '🚨 EMERGENCY SOS' : 'Group Notification',
                message: item.content || 'You have a new update.',
                type: item.type === 'TRIP_INVITE' ? 'invite' : item.type === 'SOS' || item.type === 'GROUP_SOS' ? 'sos' : 'info',
                time: new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                createdAt: item.createdAt,
                read: item.status === 'SENT',
                ...payloadObj
              };
            });
          setNotifications((prev) => {
            const existingIds = new Set(mapped.map((m) => m.id));
            const filteredPrev = prev.filter((p) => !existingIds.has(p.id) && p.id !== 'init-1' && isFresh(p));
            return [...mapped, ...filteredPrev];
          });
        }
      }).catch(() => {});
    }
  }, [user?.id]);

  useEffect(() => {
    const unsubs = [
      onSocketEvent('trip:invitation', (data) => {
        if (!data) return;
        push(`✈️ New Trip Invitation: ${data.creatorName} invited you to join ${data.destination}!`, 'info', { duration: 8000 });
        setNotifications((prev) => [
          {
            id: data.id || `invite-${Date.now()}`,
            tripId: data.tripId,
            destination: data.destination,
            creatorName: data.creatorName,
            dates: data.dates,
            title: 'Trip Invitation',
            message: data.message || `${data.creatorName} invited you to join ${data.destination}!`,
            type: 'invite',
            time: 'Just now',
            createdAt: new Date().toISOString(),
            read: false
          },
          ...prev.filter(isFresh)
        ]);
      }),
      onSocketEvent('group:notification', (data) => {
        if (!data) return;
        if (data.type === 'TRIP_INVITE' || data.type === 'invite') return;
        setNotifications((prev) => [
          {
            id: data.id || `notif-${Date.now()}`,
            tripId: data.tripId,
            userId: data.userId,
            latitude: data.latitude,
            longitude: data.longitude,
            userName: data.userName || data.name,
            title: data.title || 'Group Notification',
            message: data.message || '',
            type: data.type === 'TRIP_INVITE' || data.type === 'invite' ? 'invite' : data.type || 'info',
            time: 'Just now',
            read: false
          },
          ...prev
        ]);
      }),
      onSocketEvent('group:member:joined', (data) => {
        if (!data) return;
        setNotifications((prev) => [
          {
            id: `join-${Date.now()}`,
            tripId: data.tripId,
            userId: data.userId,
            title: 'New Member Joined',
            message: `${data.name || 'A new member'} joined your travel group.`,
            type: 'member',
            time: 'Just now',
            read: false
          },
          ...prev
        ]);
      }),
      onSocketEvent('group:sos:alert', (data) => {
        if (!data) return;
        triggerIncomingSOSAlert(data);
        setNotifications((prev) => [
          {
            id: `sos-${Date.now()}`,
            tripId: data.tripId,
            userId: data.userId || data.touristId,
            latitude: data.latitude,
            longitude: data.longitude,
            touristName: data.touristName || data.userName,
            sosId: data.sosId || data.id,
            emergencyType: data.emergencyType,
            title: '🚨 EMERGENCY SOS ALERT',
            message: `Emergency (${data.emergencyType || 'SOS'}) triggered by ${data.touristName || data.userName || 'group member'}.`,
            type: 'sos',
            time: 'Just now',
            read: false
          },
          ...prev
        ]);
      }),
      onSocketEvent('group:member:left', (data) => {
        if (!data?.tripId) return;
        const leftUserId = data.userId;
        const leftMemberId = data.memberId;
        setState((s) => ({
          ...s,
          trips: (s.trips || []).map((t) => {
            if (t.id === data.tripId) {
              const remaining = (t.members || []).filter((m) => {
                if (leftUserId && (m.userId === leftUserId || m.id === leftUserId)) return false;
                if (leftMemberId && m.id === leftMemberId) return false;
                return true;
              });
              return {
                ...t,
                members: remaining,
                groupData: { members: remaining },
                memberCount: Math.max(0, remaining.length)
              };
            }
            return t;
          })
        }));
      }),
      onSocketEvent('group:refresh', () => {
        if (user?.id) {
          tripService.getTrips(user.id).catch(() => {});
        }
      })
    ];

    return () => unsubs.forEach((u) => u && u());
  }, [push, user?.id]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notifOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function clearAll() {
    setNotifications([]);
  }

  async function handleAcceptInvite(n) {
    if (!n.tripId) return;
    setNotifications((prev) => prev.filter((item) => item.id !== n.id && item.tripId !== n.tripId));
    try {
      await tripService.acceptInvitation(n.tripId);
      push(`Joined travel group for ${n.destination || 'trip'}!`, 'success');
    } catch (err) {
      push(err?.message || 'Could not accept invitation.', 'error');
    }
  }

  async function handleRejectInvite(n) {
    if (!n.tripId) return;
    setNotifications((prev) => prev.filter((item) => item.id !== n.id && item.tripId !== n.tripId));
    try {
      await tripService.rejectInvitation(n.tripId);
      push('Trip invitation declined.', 'info');
    } catch (err) {
      push(err?.message || 'Could not decline invitation.', 'error');
    }
  }

  function handleViewSOS(n) {
    stopSOSAlert(n.sosId || n.id);
    setNotifOpen(false);
    const params = new URLSearchParams();
    if (n.latitude != null) params.set('focusLat', n.latitude);
    if (n.longitude != null) params.set('focusLon', n.longitude);
    if (n.touristName || n.userName) params.set('focusName', n.touristName || n.userName);
    if (n.userId) params.set('focusUser', n.userId);
    if (n.tripId) params.set('tripId', n.tripId);
    params.set('focusType', 'SOS');
    navigate(`/safety/map?${params.toString()}`);
  }

  function handleViewLocation(n) {
    setNotifOpen(false);
    const params = new URLSearchParams();
    if (n.latitude != null) params.set('focusLat', n.latitude);
    if (n.longitude != null) params.set('focusLon', n.longitude);
    if (n.userName || n.name) params.set('focusName', n.userName || n.name);
    if (n.userId) params.set('focusUser', n.userId);
    if (n.tripId) params.set('tripId', n.tripId);
    navigate(`/safety/map?${params.toString()}`);
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-btn menu-toggle" onClick={onMenu} aria-label="Open menu">
          <Icon name="menu" size={22} />
        </button>
        <span className="topbar-title">{title || 'ROYAL TOURS'}</span>
      </div>
      <div className="topbar-right">
        {/* Notification Bell with Socket.IO Real-Time Updates */}
        <div className="topbar-notif-wrap" ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            className="icon-btn notif-btn"
            onClick={() => {
              setNotifOpen((v) => !v);
              if (!notifOpen) markAllRead();
            }}
            aria-label="Notifications"
            style={{ position: 'relative' }}
          >
            <Icon name="bell" size={20} />
            {unreadCount > 0 && (
              <span
                className="notif-badge"
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--red, #ef4444)',
                  boxShadow: '0 0 0 2px #ffffff'
                }}
              />
            )}
          </button>

          {notifOpen && (
            <div className="notif-dropdown">
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border, #e2e8f0)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#f8fafc'
                }}
              >
                <strong style={{ fontSize: '13.5px', color: 'var(--text)' }}>
                  Notifications {unreadCount > 0 && `(${unreadCount})`}
                </strong>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAll}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '11.5px',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No new notifications
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        padding: '12px 14px',
                        borderBottom: '1px solid #f1f5f9',
                        background: n.read ? '#ffffff' : 'var(--purple-50, #f5f3ff)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span
                          style={{
                            fontSize: '12.5px',
                            fontWeight: 650,
                            color: n.type === 'sos' ? '#dc2626' : n.type === 'invite' ? 'var(--purple-deep)' : 'var(--text)'
                          }}
                        >
                          {n.title}
                        </span>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{n.time}</span>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                        {n.message}
                      </span>

                      {/* Invitation Actions: Accept / Reject */}
                      {n.type === 'invite' && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleAcceptInvite(n)}
                            style={{
                              padding: '4px 10px',
                              background: '#059669',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectInvite(n)}
                            style={{
                              padding: '4px 10px',
                              background: 'transparent',
                              color: 'var(--text-muted)',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              cursor: 'pointer'
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      )}

                      {/* SOS Action: View (Stops siren + opens map) */}
                      {n.type === 'sos' && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleViewSOS(n)}
                            style={{
                              padding: '4px 12px',
                              background: '#dc2626',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Icon name="map-pin" size={13} /> View Live Location
                          </button>
                        </div>
                      )}

                      {/* Location Share Action: View */}
                      {(n.type === 'location' || (n.latitude != null && n.type !== 'sos' && n.type !== 'invite')) && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleViewLocation(n)}
                            style={{
                              padding: '3px 9px',
                              background: 'var(--purple-50)',
                              color: 'var(--purple-deep)',
                              border: '1px solid var(--purple)',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Icon name="map-pin" size={12} /> View Location
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button
          className="topbar-sos"
          onClick={() => document.dispatchEvent(new Event('tourguard:opensos'))}
        >
          <Icon name="siren" size={17} />
          <span className="topbar-sos-label">SOS</span>
        </button>
        <div className="topbar-user" onClick={() => navigate('/account')} style={{ cursor: 'pointer' }}>
          <span className="avatar">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user?.name || 'Avatar'}
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              user?.name?.[0]?.toUpperCase() || 'T'
            )}
          </span>
          <span className="topbar-username">{user?.name?.split(' ')[0]}</span>
        </div>
        <button className="icon-btn" onClick={() => navigate('/account')} aria-label="Account">
          <Icon name="settings" size={20} />
        </button>
      </div>
    </header>
  );
}
