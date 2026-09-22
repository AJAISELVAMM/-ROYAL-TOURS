import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Icon from '../../components/common/Icon.jsx';
import Modal from '../../components/common/Modal.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useLocation } from '../../context/LocationContext.jsx';
import * as tripService from '../../services/tripService.js';
import * as sosService from '../../services/sosService.js';
import { joinGroup, leaveGroup, shareGroupLocation, startGroupLocation, stopGroupLocation, onSocketEvent } from '../../services/socket.js';
import { triggerIncomingSOSAlert } from '../../utils/sosSound.js';
import { isTripExpiredIST, formatDateInIST } from '../../utils/timeZone.js';
import useStore from '../../useStore.js';
import { setState } from '../../store.js';
import useLoad from '../../hooks/useLoad.js';

export default function GroupView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { groupId } = useParams();
  const [searchParams] = useSearchParams();
  const { push } = useToast();
  const { currentLocation } = useLocation();
  const store = useStore();
  const watchIdRef = useRef(null);

  // Load all user's trips from database
  const { loading: tripsLoading } = useLoad(() => tripService.getTrips(user?.id), [user?.id]);

  // Determine active trips according to real dates in Asia/Kolkata
  const userCleanPhone = user?.phone ? user.phone.replace(/\D/g, '').slice(-10) : '';
  const activeTrips = (store.trips || []).filter((t) => {
    if (t.hasLeft) return false;
    if (t.status !== 'active' || isTripExpiredIST(t)) return false;
    const isOwner = t.touristId === user?.id || t.userId === user?.id;
    const myMember = t.members?.find((m) =>
      (m.userId && m.userId === user?.id) ||
      (m.id && m.id === user?.id) ||
      (userCleanPhone && m.phone && m.phone.replace(/\D/g, '').slice(-10) === userCleanPhone)
    );
    if (!isOwner && !myMember) return false;
    if (myMember && (myMember.memberStatus === 'LEFT' || myMember.status === 'LEFT')) return false;
    return true;
  });

  const currentSelectedId = groupId || searchParams.get('id') || null;

  // Resolve the selected trip by ID (never by array index)
  const trip = currentSelectedId
    ? activeTrips.find((t) => t.id === currentSelectedId) || (store.trips || []).find((t) => t.id === currentSelectedId) || null
    : null;

  const [groupSOSOpen, setGroupSOSOpen] = useState(false);
  const [sosConfirming, setSosConfirming] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [members, setMembers] = useState(() => {
    const raw = trip?.members || trip?.groupData?.members || [];
    return raw.filter((m) => m.memberStatus !== 'LEFT' && m.status !== 'LEFT');
  });

  // Join Group Modal State
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joining, setJoining] = useState(false);

  // Create Group Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [createForm, setCreateForm] = useState(() => {
    const today = new Date();
    const future = new Date(today.getTime() + 2 * 86400000);
    return {
      name: '',
      destination: '',
      startDate: formatDateInIST(today),
      endDate: formatDateInIST(future)
    };
  });

  const groupCode = trip?.joinCode || trip?.groupCode || (trip?.id ? `TG-${trip.id.slice(-6).toUpperCase()}` : '');
  const tripIdRef = useRef(trip?.id);
  tripIdRef.current = trip?.id;

  // Clear geolocation watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  // Fetch individual trip if accessed directly via URL but not loaded yet
  useEffect(() => {
    if (currentSelectedId && !trip) {
      tripService.getTrip(currentSelectedId).catch(() => {});
    }
  }, [currentSelectedId, trip]);

  // Sync members when selected trip changes
  useEffect(() => {
    if (trip?.id) {
      const initialMembers = (trip.members || trip.groupData?.members || []).filter(
        (m) => m.memberStatus !== 'LEFT' && m.status !== 'LEFT'
      );
      if (initialMembers.length > 0) {
        setMembers(initialMembers);
      }
      tripService.getGroupMembers(trip.id).then((freshMembers) => {
        if (Array.isArray(freshMembers)) {
          setMembers(freshMembers);
        }
      }).catch(() => {});
      joinGroup(trip.id);
      return () => leaveGroup(trip.id);
    } else {
      setMembers([]);
    }
  }, [trip?.id]);

  // Real-time socket events for group members, live locations, and SOS
  useEffect(() => {
    const unsubs = [
      onSocketEvent('group:location:update', (data) => {
        if (!data) return;
        setMembers((prev) =>
          prev.map((m) =>
            m.userId === data.userId || m.id === data.userId
              ? {
                  ...m,
                  isLive: true,
                  latitude: data.latitude,
                  longitude: data.longitude,
                  location: data.latitude ? `${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}` : m.location,
                  lastSeen: 'Live'
                }
              : m
          )
        );
      }),
      onSocketEvent('group:location:stopped', (data) => {
        if (!data) return;
        setMembers((prev) =>
          prev.map((m) =>
            m.userId === data.userId || m.id === data.userId
              ? { ...m, isLive: false, lastSeen: 'Sharing stopped' }
              : m
          )
        );
      }),
      onSocketEvent('group:member:joined', (data) => {
        if (!data) return;
        push(`${data.name || 'A new member'} joined your travel group!`, 'success');
        if (data.member) {
          setMembers((prev) => {
            const identity = data.member.userId || data.member.id;
            return [...prev.filter((m) => (m.userId || m.id) !== identity), data.member];
          });
        }
        tripService.getTrips(user?.id).catch(() => {});
      }),
      onSocketEvent('group:member:left', (data) => {
        const currentTripId = tripIdRef.current;
        if (!data || (currentTripId && data.tripId !== currentTripId)) return;
        push(`${data.name || 'A member'} left the travel group.`, 'info');
        setMembers((prev) =>
          prev.filter((m) => {
            if (data.userId && (m.userId === data.userId || m.id === data.userId)) return false;
            if (data.memberId && m.id === data.memberId) return false;
            return true;
          })
        );
        setState((s) => ({
          ...s,
          trips: (s.trips || []).map((t) => {
            if (t.id === data.tripId) {
              const remainingMembers = (t.members || []).filter((m) => {
                if (data.userId && (m.userId === data.userId || m.id === data.userId)) return false;
                if (data.memberId && m.id === data.memberId) return false;
                return true;
              });
              return {
                ...t,
                members: remainingMembers,
                memberCount: Math.max(0, remainingMembers.length)
              };
            }
            return t;
          })
        }));
        const targetTripId = data.tripId || currentTripId;
        if (targetTripId) {
          tripService.getGroupMembers(targetTripId).then((fresh) => {
            if (Array.isArray(fresh)) {
              setMembers(fresh.filter((m) => m.memberStatus !== 'LEFT' && m.status !== 'LEFT'));
            }
          }).catch(() => {});
        }
      }),
      onSocketEvent('group:refresh', (data) => {
        const currentTripId = tripIdRef.current;
        if (!data || (currentTripId && data.tripId !== currentTripId)) return;
        const targetTripId = data.tripId || currentTripId;
        if (targetTripId) {
          tripService.getGroupMembers(targetTripId).then((fresh) => {
            if (Array.isArray(fresh)) {
              setMembers(fresh.filter((m) => m.memberStatus !== 'LEFT' && m.status !== 'LEFT'));
            }
          }).catch(() => {});
        }
      }),
      onSocketEvent('user:group:left', (data) => {
        if (!data?.tripId) return;
        setState((s) => ({
          ...s,
          trips: (s.trips || []).map((t) =>
            t.id === data.tripId
              ? {
                  ...t,
                  hasLeft: true,
                  members: (t.members || []).filter(
                    (m) => m.userId !== user?.id && m.id !== user?.id
                  )
                }
              : t
          )
        }));
      }),
      onSocketEvent('group:sos:alert', (data) => {
        if (!data) return;
        triggerIncomingSOSAlert(data);
        push(`🚨 EMERGENCY SOS from ${data.touristName || data.userName || 'group member'}!`, 'error', { duration: 10000 });
      })
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [push, user?.id]);

  function handleCall(member) {
    if (!member.phone || member.phone === '—') {
      push('No phone number available for this member.', 'error');
      return;
    }
    const cleanPhone = String(member.phone).replace(/[^0-9+]/g, '');
    window.location.href = `tel:${cleanPhone}`;
  }

  function handleWhatsAppInvite() {
    if (!trip) return;
    const tripName = trip.destination || 'ROYAL TOURS Trip';
    const msg = `Hey! Join my travel group for "${tripName}" on ROYAL TOURS.\n\nGroup Code: ${groupCode}\nDuration: ${trip.duration || '2 Days'}\n\nJoin us on ROYAL TOURS to share live GPS safety updates, itinerary, and stay connected!`;
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  async function handleJoinSubmit(e) {
    if (e) e.preventDefault();
    const code = joinCodeInput.trim();
    if (!code) {
      push('Please enter a valid travel group code.', 'error');
      return;
    }
    setJoining(true);
    try {
      const joinedTrip = await tripService.joinGroup(code);
      setJoinModalOpen(false);
      setJoinCodeInput('');
      if (joinedTrip.alreadyMember) {
        push(`Loaded travel group for ${joinedTrip.destination}!`, 'info');
      } else {
        push(`Successfully joined group for ${joinedTrip.destination}!`, 'success');
      }
      await tripService.getTrips(user?.id);
      navigate(`/my-journey/group/${joinedTrip.id}`);
    } catch (err) {
      push(err?.message || 'Could not join group. Please check the code.', 'error');
    } finally {
      setJoining(false);
    }
  }

  async function handleCreateGroupSubmit(e) {
    if (e) e.preventDefault();
    const name = createForm.name.trim();
    if (!name) {
      push('Please enter a group name.', 'error');
      return;
    }
    setCreatingGroup(true);
    try {
      const destination = createForm.destination.trim() || name;
      const created = await tripService.createGroup({
        name,
        destination,
        startDate: createForm.startDate,
        endDate: createForm.endDate,
        groupType: 'Friends'
      });
      setCreateModalOpen(false);
      push(`Travel group "${created.destination}" created successfully!`, 'success');
      await tripService.getTrips(user?.id);
      navigate(`/my-journey/group/${created.id}`);
    } catch (err) {
      push(err?.message || 'Could not create group. Please try again.', 'error');
    } finally {
      setCreatingGroup(false);
    }
  }

  async function handleConfirmLeave() {
    if (!trip?.id || leaving) return;
    const leavingTripId = trip.id;
    setLeaving(true);
    try {
      if (sharing) {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        stopGroupLocation(leavingTripId);
        setSharing(false);
      }
      leaveGroup(leavingTripId);

      setState((s) => ({
        ...s,
        trips: (s.trips || []).map((t) =>
          t.id === leavingTripId
            ? {
                ...t,
                hasLeft: true,
                members: (t.members || []).filter(
                  (m) => m.userId !== user?.id && m.id !== user?.id
                )
              }
            : t
        )
      }));

      setMembers([]);
      setLeaveModalOpen(false);
      await tripService.leaveGroup(leavingTripId);
      push('You have left the travel group.', 'success');
      navigate('/my-journey/group');
    } catch (err) {
      push(err?.message || 'Unable to leave the group. Please try again.', 'error');
    } finally {
      setLeaving(false);
    }
  }

  function toggleShareLocation() {
    if (!trip?.id) {
      push('No active trip found to share location with.', 'error');
      return;
    }

    if (sharing) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      stopGroupLocation(trip.id);
      setSharing(false);
      setMembers((prev) =>
        prev.map((m) =>
          m.id === user?.id || m.userId === user?.id || m.name === user?.name
            ? { ...m, isLive: false, lastSeen: 'Sharing stopped' }
            : m
        )
      );
      push('Stopped sharing your live location', 'info');
      return;
    }

    if (!('geolocation' in navigator)) {
      push('Geolocation is not supported by your browser.', 'error');
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
        shareGroupLocation(trip.id, coords);
        setMembers((prev) =>
          prev.map((m) =>
            m.userId === user?.id || m.id === user?.id
              ? {
                  ...m,
                  isLive: true,
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                  location: `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`,
                  lastSeen: 'Live'
                }
              : m
          )
        );
      },
      (err) => {
        console.warn('Geolocation watch error:', err);
        push(`GPS Error: ${err.message || 'Failed to acquire location'}`, 'error');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 15000
      }
    );

    watchIdRef.current = watchId;
    startGroupLocation(trip.id, {
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude
    });
    setSharing(true);
    push('Live GPS location shared with group members', 'success');
  }

  async function confirmGroupSOS() {
    if (currentLocation.latitude == null || currentLocation.longitude == null) {
      push('Live GPS location is required for emergency group SOS.', 'error');
      return;
    }
    setSosConfirming(true);
    try {
      await sosService.createGroupSOS({
        tripId: trip.id,
        emergencyType: 'Medical',
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        accuracy: currentLocation.accuracy,
        locationText: `GPS (${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)})`
      });
      setGroupSOSOpen(false);
      push('Group SOS emergency alert broadcasted to command center & group members', 'success');
    } catch (e) {
      push(e?.message || 'Could not send group SOS.', 'error');
    } finally {
      setSosConfirming(false);
    }
  }

  const locationText = currentLocation.latitude != null
    ? `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`
    : 'Acquiring GPS…';

  // ---------------------------------------------------------------------------
  // VIEW 1: All Active Travel Groups List (When on /my-journey/group or no group selected)
  // ---------------------------------------------------------------------------
  if (!trip) {
    if (tripsLoading && (!store.trips || store.trips.length === 0)) {
      return (
        <div className="journey-view" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
          <div className="spinner spinner-lg" />
        </div>
      );
    }

    if (activeTrips.length === 0) {
      return (
        <div className="journey-view">
          <EmptyState
            icon="users"
            title="No active group"
            message="Create a trip or join an existing travel group using a group code."
            action={
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button onClick={() => setCreateModalOpen(true)} icon="plus">
                  Create Group
                </Button>
                <Button variant="outline" onClick={() => setJoinModalOpen(true)} icon="users">
                  Join with Code
                </Button>
                <Button variant="ghost" onClick={() => navigate('/my-journey/trip')}>
                  Plan a Trip
                </Button>
              </div>
            }
          />

          {/* Join Group Modal */}
          <Modal
            open={joinModalOpen}
            onClose={() => setJoinModalOpen(false)}
            title="Join Travel Group"
            size="sm"
            footer={
              <>
                <Button variant="ghost" onClick={() => setJoinModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleJoinSubmit} loading={joining} icon="users">
                  Join Group
                </Button>
              </>
            }
          >
            <form onSubmit={handleJoinSubmit} className="modal-form">
              <label className="field">
                <span className="field-label">Group Code</span>
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. TG-8F4K92 or ROYAL123"
                  style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}
                  autoFocus
                />
              </label>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Enter the unique code shared by your group organizer or trip companions.
              </p>
            </form>
          </Modal>

          {/* Create Group Modal */}
          <Modal
            open={createModalOpen}
            onClose={() => setCreateModalOpen(false)}
            title="Create Travel Group"
            size="sm"
            footer={
              <>
                <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateGroupSubmit} loading={creatingGroup} icon="plus">
                  Create Group
                </Button>
              </>
            }
          >
            <form onSubmit={handleCreateGroupSubmit} className="modal-form">
              <label className="field">
                <span className="field-label">Group / Trip Name *</span>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Ooty Getaway or Chennai Trip"
                  required
                  autoFocus
                />
              </label>
              <label className="field">
                <span className="field-label">Destination</span>
                <input
                  type="text"
                  value={createForm.destination}
                  onChange={(e) => setCreateForm((f) => ({ ...f, destination: e.target.value }))}
                  placeholder="e.g. Ooty (leave blank to use Group Name)"
                />
              </label>
              <div className="grid-2">
                <label className="field">
                  <span className="field-label">Start Date</span>
                  <div className="field-control">
                    <Icon name="calendar" size={16} />
                    <input
                      type="date"
                      value={createForm.startDate}
                      onChange={(e) => setCreateForm((f) => ({ ...f, startDate: e.target.value }))}
                    />
                  </div>
                </label>
                <label className="field">
                  <span className="field-label">End Date</span>
                  <div className="field-control">
                    <Icon name="calendar" size={16} />
                    <input
                      type="date"
                      value={createForm.endDate}
                      onChange={(e) => setCreateForm((f) => ({ ...f, endDate: e.target.value }))}
                    />
                  </div>
                </label>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                A unique join code will be generated automatically. You will be added as the group organizer.
              </p>
            </form>
          </Modal>
        </div>
      );
    }

    // List of active travel groups
    return (
      <div className="journey-view">
        <Card>
          <div className="card-head">
            <div>
              <h2>Travel Groups</h2>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Active travel groups for your journeys. Select any group to view members and live GPS status.
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Button onClick={() => setCreateModalOpen(true)} icon="plus" size="sm">
                Create Group
              </Button>
              <Button variant="outline" onClick={() => setJoinModalOpen(true)} icon="users" size="sm">
                Join with Code
              </Button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
            {activeTrips.map((t) => {
              const tripName = t.destination || 'Travel Group';
              const code = t.joinCode || t.groupCode || (t.id ? `TG-${t.id.slice(-6).toUpperCase()}` : '');
              const activeMembersList = (t.members || []).filter((m) => m.memberStatus !== 'LEFT' && m.status !== 'LEFT');
              const memberCount = activeMembersList.length || t.memberCount || 1;

              return (
                <div
                  key={t.id}
                  className="account-row card-clickable card-hover"
                  onClick={() => navigate(`/my-journey/group/${t.id}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 18px',
                    borderRadius: '11px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <span className="marker-icon purple">
                      <Icon name="users" size={18} />
                    </span>
                    <div>
                      <strong style={{ fontSize: '15px', color: 'var(--text)' }}>{tripName}</strong>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                        <span><Icon name="map-pin" size={13} /> {t.destination}</span>
                        {t.dates && <span><Icon name="calendar" size={13} /> {t.dates}</span>}
                        {code && <span>Code: <strong style={{ color: 'var(--purple-deep)', letterSpacing: '0.4px' }}>{code}</strong></span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="badge badge-purple" style={{ background: 'var(--purple-50)', color: 'var(--purple-deep)', border: '1px solid var(--lavender-soft)' }}>
                      {memberCount} {memberCount === 1 ? 'Member' : 'Members'}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      icon="arrow-right"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/my-journey/group/${t.id}`);
                      }}
                    >
                      Open Group
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Join Group Modal */}
        <Modal
          open={joinModalOpen}
          onClose={() => setJoinModalOpen(false)}
          title="Join Travel Group"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setJoinModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleJoinSubmit} loading={joining} icon="users">
                Join Group
              </Button>
            </>
          }
        >
          <form onSubmit={handleJoinSubmit} className="modal-form">
            <label className="field">
              <span className="field-label">Group Code</span>
              <input
                type="text"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="e.g. TG-8F4K92 or ROYAL123"
                style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}
                autoFocus
              />
            </label>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Enter the unique code shared by your group organizer.
            </p>
          </form>
        </Modal>

        {/* Create Group Modal */}
        <Modal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title="Create Travel Group"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateGroupSubmit} loading={creatingGroup} icon="plus">
                Create Group
              </Button>
            </>
          }
        >
          <form onSubmit={handleCreateGroupSubmit} className="modal-form">
            <label className="field">
              <span className="field-label">Group / Trip Name *</span>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Ooty Getaway or Chennai Trip"
                required
                autoFocus
              />
            </label>
            <label className="field">
              <span className="field-label">Destination</span>
              <input
                type="text"
                value={createForm.destination}
                onChange={(e) => setCreateForm((f) => ({ ...f, destination: e.target.value }))}
                placeholder="e.g. Ooty (leave blank to use Group Name)"
              />
            </label>
            <div className="grid-2">
              <label className="field">
                <span className="field-label">Start Date</span>
                <div className="field-control">
                  <Icon name="calendar" size={16} />
                  <input
                    type="date"
                    value={createForm.startDate}
                    onChange={(e) => setCreateForm((f) => ({ ...f, startDate: e.target.value }))}
                  />
                </div>
              </label>
              <label className="field">
                <span className="field-label">End Date</span>
                <div className="field-control">
                  <Icon name="calendar" size={16} />
                  <input
                    type="date"
                    value={createForm.endDate}
                    onChange={(e) => setCreateForm((f) => ({ ...f, endDate: e.target.value }))}
                  />
                </div>
              </label>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              A unique join code will be generated automatically. You will be added as the group organizer.
            </p>
          </form>
        </Modal>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW 2: Selected Travel Group Detail View
  // ---------------------------------------------------------------------------
  const groupTitle = trip.destination || 'Travel Group';

  return (
    <div className="journey-view">
      {/* Back button to all groups */}
      <div style={{ marginBottom: '14px' }}>
        <button
          type="button"
          className="link-btn"
          onClick={() => navigate('/my-journey/group')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13.5px' }}
        >
          <Icon name="arrow-left" size={15} />
          <span>All Travel Groups</span>
        </button>
      </div>

      <Card>
        <div className="card-head">
          <div>
            <h2>{groupTitle}</h2>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginTop: '4px' }}>
              <span>
                Group Code: <strong style={{ color: 'var(--purple-deep)', letterSpacing: '0.5px' }}>{groupCode}</strong>
              </span>
              {trip.destination && (
                <span><Icon name="map-pin" size={13} /> {trip.destination}</span>
              )}
              {trip.dates && (
                <span><Icon name="calendar" size={13} /> {trip.dates}</span>
              )}
            </div>
          </div>
          <div className="group-actions">
            <Button variant="outline" icon="users" onClick={() => setJoinModalOpen(true)}>
              Join Group
            </Button>
            <Button variant="outline" icon="share-2" onClick={handleWhatsAppInvite}>
              Invite
            </Button>
            <Button variant={sharing ? 'ghost' : 'outline'} icon="map-pin" onClick={toggleShareLocation}>
              {sharing ? 'Stop Sharing' : 'Share Location'}
            </Button>
            <Button variant="danger" icon="siren" onClick={() => setGroupSOSOpen(true)}>
              Group SOS
            </Button>
            <Button variant="outline" icon="logout" onClick={() => setLeaveModalOpen(true)}>
              Leave Group
            </Button>
          </div>
        </div>

        <div className="group-list">
          {members.filter((m) => m.memberStatus !== 'LEFT' && m.status !== 'LEFT').length === 0 ? (
            <p className="section-sub">No members in this travel group yet.</p>
          ) : (
            members
              .filter((m) => m.memberStatus !== 'LEFT' && m.status !== 'LEFT')
              .map((m) => {
                const isMemberLive = m.isLive || ((m.id === user?.id || m.userId === user?.id) && sharing);
                const isOwner = m.userId === trip.userId || m.role === 'Owner';
                return (
                  <div className="group-member" key={m.userId || m.id}>
                    <span className="member-avatar">
                      {m.avatarUrl ? <img src={m.avatarUrl} alt="" /> : (m.name ? m.name.charAt(0).toUpperCase() : 'M')}
                    </span>
                    <div className="member-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong>
                          {m.name} {isOwner && <span className="chip chip-muted">Lead</span>}
                        </strong>
                        {isMemberLive && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '11px', fontWeight: 600, background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
                            Live
                          </span>
                        )}
                      </div>
                      <span className="member-meta">
                        {m.phone} · <Icon name="map-pin" size={13} /> {m.location || 'Location not shared'}
                      </span>
                      {m.lastSeen && <span className="member-seen">Seen: {m.lastSeen}</span>}
                      {(m.latitude && m.longitude) && (
                        <div style={{ marginTop: '4px' }}>
                          <Button
                            size="xs"
                            variant="ghost"
                            icon="map-pin"
                            onClick={() => navigate(`/safety/map?focusLat=${m.latitude}&focusLon=${m.longitude}&focusName=${encodeURIComponent(m.name)}&focusUser=${m.userId || m.id}&focusType=MEMBER`)}
                          >
                            View on Map
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="member-actions">
                      <Button size="sm" variant="outline" icon="phone" onClick={() => handleCall(m)}>
                        Call
                      </Button>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </Card>

      {/* Join Group Modal */}
      <Modal
        open={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        title="Join Travel Group"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setJoinModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleJoinSubmit} loading={joining} icon="users">
              Join Group
            </Button>
          </>
        }
      >
        <form onSubmit={handleJoinSubmit} className="modal-form">
          <label className="field">
            <span className="field-label">Group Code</span>
            <input
              type="text"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
              placeholder="e.g. TG-8F4K92 or ROYAL123"
              style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}
              autoFocus
            />
          </label>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Enter the unique code shared by your group organizer.
          </p>
        </form>
      </Modal>

      {/* Group SOS Modal */}
      <Modal
        open={groupSOSOpen}
        onClose={() => setGroupSOSOpen(false)}
        title="Trigger Group SOS"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setGroupSOSOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" icon="siren" loading={sosConfirming} onClick={confirmGroupSOS}>
              Send Group SOS
            </Button>
          </>
        }
      >
        <p className="sos-intro">
          Are you sure you want to send a Group SOS? This will broadcast an emergency alert to all group members
          and the command safety response team with your current live GPS location.
        </p>
        <div className="sos-detail-grid" style={{ marginTop: 14 }}>
          <div className="sos-detail">
            <span className="sos-detail-label">Tourist</span>
            <span className="sos-detail-value">{user?.name}</span>
          </div>
          <div className="sos-detail">
            <span className="sos-detail-label">Group Size</span>
            <span className="sos-detail-value">{members.length} members</span>
          </div>
          <div className="sos-detail">
            <span className="sos-detail-label">Live GPS Location</span>
            <span className="sos-detail-value">{locationText}</span>
          </div>
        </div>
        <div className="group-sos-members">
          {members.map((m) => (
            <span className="chip chip-muted" key={m.id || m.userId}>{m.name} · {m.phone}</span>
          ))}
        </div>
      </Modal>

      {/* Leave Group Confirmation Modal */}
      <Modal
        open={leaveModalOpen}
        onClose={() => !leaving && setLeaveModalOpen(false)}
        title="Leave Travel Group"
        size="sm"
        footer={
          <>
            <Button variant="ghost" disabled={leaving} onClick={() => setLeaveModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" icon="logout" loading={leaving} onClick={handleConfirmLeave}>
              {leaving ? 'Leaving…' : 'Leave Group'}
            </Button>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, color: 'var(--text)' }}>
          Leave this travel group? You will no longer share live location or receive emergency group alerts for <strong>{trip?.destination}</strong>.
        </p>
      </Modal>
    </div>
  );
}
