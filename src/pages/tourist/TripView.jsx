import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../components/common/Icon.jsx';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import * as tripService from '../../services/tripService.js';
import useStore from '../../useStore.js';
import { setState } from '../../store.js';
import useLoad from '../../hooks/useLoad.js';
import TripPlanner from '../../components/tourist/TripPlanner.jsx';

const TYPE_ICONS = {
  Attraction: 'map-pin',
  Restaurant: 'utensils',
  Hotel: 'bed',
  Theatre: 'film',
  Shopping: 'bag',
  Transport: 'bus',
  Meal: 'utensils',
  'Free Time': 'clock'
};

const DURATION_OPTIONS = [
  { label: '1 Day', days: 1 },
  { label: '2 Days', days: 2 },
  { label: '3 Days', days: 3 },
  { label: '5 Days', days: 5 }
];

export default function TripView() {
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const store = useStore();
  useLoad(() => tripService.getTrips(user?.id), [user?.id]);

  const userTrips = (store.trips || []).filter(
    (t) => !user?.id || t.touristId === user?.id || t.members?.some((m) => m.userId === user?.id)
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const [isCreatingTrip, setIsCreatingTrip] = useState(false);

  const isCreating = searchParams.get('create') === 'true' || isCreatingTrip;

  const [selectedTrip, setSelectedTrip] = useState(null);
  const [replanOpen, setReplanOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ day: 1, time: '10:00', title: '', type: 'Attraction', note: '' });

  const [replan, setReplan] = useState(() => ({
    budget: '',
    duration: '2 Days',
    durationDays: 2,
    selectedPlaceIds: []
  }));

  const [destinationPlaces, setDestinationPlaces] = useState([]);

  useEffect(() => {
    let active = true;
    const dest = selectedTrip?.destination;
    if (!dest) {
      return;
    }
    tripService
      .getPlacesForDestination(dest)
      .then((places) => {
        if (active) setDestinationPlaces(places);
      })
      .catch(() => {
        if (active) setDestinationPlaces([]);
      });
    return () => {
      active = false;
    };
  }, [selectedTrip?.destination]);

  if (isCreating) {
    return (
      <div className="journey-view">
        <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {userTrips.length > 0 && (
            <Button
              variant="ghost"
              icon="arrow-left"
              size="sm"
              onClick={() => {
                setIsCreatingTrip(false);
                setSearchParams({});
              }}
            >
              Back to My Trips
            </Button>
          )}
        </div>
        <TripPlanner
          onSuccess={() => {
            setIsCreatingTrip(false);
            setSearchParams({});
            tripService.getTrips(user?.id);
          }}
          onCancel={() => {
            setIsCreatingTrip(false);
            setSearchParams({});
          }}
        />
      </div>
    );
  }

  if (userTrips.length === 0) {
    return (
      <EmptyState
        icon="map"
        title="No trip yet"
        message="Create your first trip to get started."
        action={<Button onClick={() => setIsCreatingTrip(true)} icon="sparkles">Create My Trip</Button>}
      />
    );
  }

  function handleViewDetails(t) {
    setSelectedTrip(t);
    setState((s) => ({ ...s, selectedTripId: t.id }));
    tripService.getTrip(t.id).then((fresh) => {
      if (fresh && fresh.id === t.id) {
        setSelectedTrip(fresh);
      }
    }).catch(() => {});
    if (t?.destination) {
      tripService
        .getPlacesForDestination(t.destination)
        .then((places) => setDestinationPlaces(places))
        .catch(() => setDestinationPlaces([]));
    }
  }

  function openReplan() {
    if (!selectedTrip) return;
    setReplan({
      budget: String(selectedTrip.budget || ''),
      duration: selectedTrip.duration || '2 Days',
      durationDays: selectedTrip.durationDays || 2,
      selectedPlaceIds: [...(selectedTrip.selectedPlaceIds || [])]
    });
    setReplanOpen(true);
  }

  function toggleReplanPlace(id) {
    setReplan((r) => ({
      ...r,
      selectedPlaceIds: r.selectedPlaceIds.includes(id)
        ? r.selectedPlaceIds.filter((x) => x !== id)
        : [...r.selectedPlaceIds, id]
    }));
  }

  async function submitReplan() {
    if (!selectedTrip) return;
    if (replan.selectedPlaceIds.length === 0) {
      push('Select at least one place', 'error');
      return;
    }
    try {
      await tripService.replanTrip(selectedTrip.id, {
        budget: replan.budget,
        duration: replan.duration,
        durationDays: replan.durationDays,
        selectedPlaceIds: replan.selectedPlaceIds
      });
      setReplanOpen(false);
      push('Itinerary and packing re-planned with AI', 'success');
    } catch (e) {
      push(e?.message || 'Could not re-plan. Please try again.', 'error');
    }
  }

  async function submitActivity() {
    if (!selectedTrip) return;
    if (!addForm.title.trim()) {
      push('Please enter an activity title', 'error');
      return;
    }
    try {
      await tripService.addActivity(selectedTrip.id, addForm.day, {
        time: addForm.time,
        title: addForm.title.trim(),
        type: addForm.type,
        note: addForm.note || 'Added by you'
      });
      setAddOpen(false);
      setAddForm({ day: 1, time: '10:00', title: '', type: 'Attraction', note: '' });
      push('Activity added', 'success');
    } catch (e) {
      push(e?.message || 'Could not add activity.', 'error');
    }
  }

  function renderDay(dayItems, dayNum) {
    if (!dayItems || dayItems.length === 0) return null;
    return (
      <div className="day-block" key={dayNum} style={{ marginTop: '14px' }}>
        <h3 className="day-title">DAY {dayNum}</h3>
        <div className="itinerary-list">
          {dayItems.map((item, i) => (
            <div className="itinerary-item" key={i}>
              <span className="itin-time">{item.time}</span>
              <span className="itin-icon"><Icon name={TYPE_ICONS[item.type] || 'map-pin'} size={16} /></span>
              <div className="itin-body">
                <strong>{item.title}</strong>
                <span className="itin-note">{item.note}</span>
              </div>
              <span className="itin-type">{item.type}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const selectedTripTitle = selectedTrip?.destination
    ? (selectedTrip.destination.toLowerCase().includes('trip')
      ? selectedTrip.destination
      : `${selectedTrip.destination} Trip`)
    : 'Trip Details';

  const isSelectedTripActive = selectedTrip
    ? selectedTrip.status === 'active' && !tripService.isTripExpired(selectedTrip)
    : false;

  const selectedTripDays = selectedTrip?.durationDays || 2;
  const selectedDayNumbers = [];
  for (let d = 1; d <= selectedTripDays; d++) selectedDayNumbers.push(d);

  const placesList = selectedTrip
    ? (Array.isArray(selectedTrip.places) && selectedTrip.places.length > 0
      ? selectedTrip.places.map((p) => p.place?.name || p.name).filter(Boolean)
      : destinationPlaces.map((p) => p.name).filter(Boolean))
    : [];

  const teamMembers = selectedTrip
    ? (selectedTrip.members || selectedTrip.groupData?.members || []).filter((m) => {
      if (isSelectedTripActive) {
        return m.memberStatus !== 'LEFT' && m.status !== 'LEFT';
      }
      return true;
    })
    : [];

  return (
    <div className="journey-view">
      <Card>
        <div className="card-head">
          <div>
            <h2>My Trips</h2>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Select any trip to view its complete destination, places, itinerary, and team details.
            </span>
          </div>
          <Button onClick={() => setIsCreatingTrip(true)} icon="sparkles" size="sm">
            Create Trip
          </Button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
          {userTrips.map((t) => {
            const tripName = t.destination?.toLowerCase().includes('trip')
              ? t.destination
              : `${t.destination} Trip`;
            const isActive = t.status === 'active' && !tripService.isTripExpired(t);

            return (
              <div
                key={t.id}
                className="account-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 18px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color, #e5e7eb)',
                  background: 'var(--bg-card, #ffffff)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span className={`marker-icon ${isActive ? 'purple' : 'teal'}`}>
                    <Icon name="map" size={18} />
                  </span>
                  <div>
                    <strong style={{ fontSize: '15px', color: 'var(--text)' }}>{tripName}</strong>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      <span>{t.dates || (isActive ? 'Active Journey' : 'Completed')}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <StatusBadge status={isActive ? 'active' : 'completed'}>
                    {isActive ? 'Active' : 'Completed'}
                  </StatusBadge>
                  <Button
                    size="sm"
                    variant="outline"
                    icon="eye"
                    onClick={() => handleViewDetails(t)}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Complete Trip Details Modal — Shown ONLY on clicking View Details */}
      <Modal
        open={!!selectedTrip}
        onClose={() => setSelectedTrip(null)}
        title={selectedTripTitle}
        size="lg"
        footer={<Button onClick={() => setSelectedTrip(null)}>Close</Button>}
      >
        {selectedTrip && (
          <div className="report-detail">
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <Icon name="map-pin" size={17} /> Trip Information
                </h3>
                <StatusBadge status={isSelectedTripActive ? 'active' : 'completed'}>
                  {isSelectedTripActive ? 'Active Trip' : 'Completed'}
                </StatusBadge>
              </div>

              <div className="detail-facts">
                <li>
                  <Icon name="map" size={15} /> <strong>Trip Name:</strong> {selectedTripTitle}
                </li>
                <li>
                  <Icon name="navigation" size={15} /> <strong>Destination:</strong> {selectedTrip.destination} {selectedTrip.destinationAddress ? `(${selectedTrip.destinationAddress})` : ''}
                </li>
                <li>
                  <Icon name="calendar" size={15} /> <strong>Trip Date:</strong> {selectedTrip.dates || (selectedTrip.startDate && selectedTrip.endDate ? `${selectedTrip.startDate.slice(0, 10)} to ${selectedTrip.endDate.slice(0, 10)}` : 'Scheduled')}
                </li>
                {selectedTrip.startDate && (
                  <li>
                    <Icon name="clock" size={15} /> <strong>Start Date:</strong> {new Date(selectedTrip.startDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                  </li>
                )}
                {selectedTrip.endDate && (
                  <li>
                    <Icon name="clock" size={15} /> <strong>End Date:</strong> {new Date(selectedTrip.endDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                  </li>
                )}
                <li>
                  <Icon name="clock" size={15} /> <strong>Duration:</strong> {selectedTrip.duration || `${selectedTrip.durationDays || 2} Days`}
                </li>
                <li>
                  <Icon name="wallet" size={15} /> <strong>Budget:</strong> ₹{(selectedTrip.budget || 0).toLocaleString('en-IN')}
                </li>
                <li>
                  <Icon name="users" size={15} /> <strong>Group Type:</strong> {selectedTrip.group || 'Friends'} ({teamMembers.length || selectedTrip.memberCount || 1} travelers)
                </li>
                <li>
                  <Icon name="users" size={15} /> <strong>Travel Group Join Code:</strong> {selectedTrip.joinCode || selectedTrip.groupCode || '—'}
                </li>
              </div>
            </div>

            {/* Places */}
            {placesList.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon name="map-pin" size={16} /> Places ({placesList.length})
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {placesList.map((pName, idx) => (
                    <span key={idx} className="chip chip-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Icon name="map-pin" size={12} /> {pName}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Team Members */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="users" size={16} /> Team Members ({teamMembers.length})
              </h3>
              <div className="group-list">
                {teamMembers.length === 0 ? (
                  <p className="section-sub">No team members recorded for this trip.</p>
                ) : (
                  teamMembers.map((m) => (
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
                          {m.phone || '—'} · {isSelectedTripActive ? 'Travel Member' : <><Icon name="check-circle" size={13} /> Completed Journey</>}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Daily Itinerary & Actions if Active */}
            {selectedTrip.itinerary && (
              <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color, #e5e7eb)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                    <Icon name="calendar" size={16} /> Itinerary Activities
                  </h3>
                  {isSelectedTripActive && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Button size="xs" variant="outline" icon="plus" onClick={() => setAddOpen(true)}>
                        Add Activity
                      </Button>
                      <Button size="xs" variant="outline" icon="sparkles" onClick={openReplan}>
                        AI Re-plan
                      </Button>
                    </div>
                  )}
                </div>
                {selectedDayNumbers.map((d) => renderDay(selectedTrip.itinerary[`day${d}`], d))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* AI Re-plan modal */}
      <Modal
        open={replanOpen}
        onClose={() => setReplanOpen(false)}
        title="AI Re-plan"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReplanOpen(false)}>Cancel</Button>
            <Button onClick={submitReplan} icon="sparkles">Update Itinerary</Button>
          </>
        }
      >
        <div className="modal-form">
          <div className="grid-2">
            <label className="field">
              <span className="field-label">Budget (₹)</span>
              <input type="number" value={replan.budget} onChange={(e) => setReplan((r) => ({ ...r, budget: e.target.value }))} />
            </label>
            <label className="field">
              <span className="field-label">Duration</span>
              <select
                value={replan.duration}
                onChange={(e) => {
                  const opt = DURATION_OPTIONS.find((o) => o.label === e.target.value);
                  setReplan((r) => ({ ...r, duration: opt.label, durationDays: opt.days }));
                }}
              >
                {DURATION_OPTIONS.map((o) => <option key={o.label}>{o.label}</option>)}
              </select>
            </label>
          </div>

          <div className="field">
            <span className="field-label">Places ({replan.selectedPlaceIds.length} selected)</span>
            <div className="replan-places">
              {destinationPlaces.map((p) => {
                const selected = replan.selectedPlaceIds.includes(p.id);
                return (
                  <label key={p.id} className={`replan-place ${selected ? 'selected' : ''}`}>
                    <input type="checkbox" checked={selected} onChange={() => toggleReplanPlace(p.id)} />
                    <span className="replan-place-name">{p.name}</span>
                    <span className="chip chip-muted">{p.category}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <p className="replan-note">
            <Icon name="info" size={14} /> Re-planning regenerates your itinerary, budget and packing list from the selected places.
          </p>
        </div>
      </Modal>

      {/* Add Activity modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Activity"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={submitActivity} icon="plus">Add</Button>
          </>
        }
      >
        <div className="modal-form">
          <div className="grid-2">
            <label className="field">
              <span className="field-label">Day</span>
              <select value={addForm.day} onChange={(e) => setAddForm((f) => ({ ...f, day: Number(e.target.value) }))}>
                {selectedDayNumbers.map((d) => <option key={d} value={d}>Day {d}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Time</span>
              <input type="time" value={addForm.time} onChange={(e) => setAddForm((f) => ({ ...f, time: e.target.value }))} />
            </label>
          </div>
          <label className="field">
            <span className="field-label">Title</span>
            <input type="text" value={addForm.title} onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))} placeholder="Activity name" />
          </label>
          <label className="field">
            <span className="field-label">Type</span>
            <select value={addForm.type} onChange={(e) => setAddForm((f) => ({ ...f, type: e.target.value }))}>
              <option>Attraction</option><option>Meal</option><option>Restaurant</option><option>Hotel</option><option>Theatre</option><option>Shopping</option><option>Transport</option><option>Free Time</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Note</span>
            <input type="text" value={addForm.note} onChange={(e) => setAddForm((f) => ({ ...f, note: e.target.value }))} placeholder="Optional note" />
          </label>
        </div>
      </Modal>
    </div>
  );
}
