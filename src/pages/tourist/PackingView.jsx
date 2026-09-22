import React, { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Icon from '../../components/common/Icon.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import * as tripService from '../../services/tripService.js';
import useStore from '../../useStore.js';
import { setState } from '../../store.js';
import useLoad from '../../hooks/useLoad.js';
import { getDurationDays, getActiveMemberCount } from '../../utils/budgetTrip.js';

function formatTripDates(trip) {
  if (trip?.startDate && trip?.endDate) {
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      const opts = { day: '2-digit', month: 'short', year: 'numeric' };
      return `${start.toLocaleDateString('en-GB', opts)} – ${end.toLocaleDateString('en-GB', opts)}`;
    }
  }
  return trip?.dates || 'Dates not set';
}

export default function PackingView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const store = useStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const { loading } = useLoad(() => tripService.getTrips(user?.id), [user?.id]);

  // Filter only active trips belonging to this user
  const activeUserTrips = useMemo(() => {
    return (store.trips || []).filter((t) => {
      const isOwnerOrMember = !user?.id ||
        t.touristId === user.id ||
        t.userId === user.id ||
        t.members?.some((m) => m.userId === user.id);
      const isActive = t.status === 'active' && !tripService.isTripExpired(t);
      return isOwnerOrMember && isActive;
    });
  }, [store.trips, user?.id]);

  // Selected trip resolved from URL search param or shared store selectedTripId
  const selectedTripId = searchParams.get('tripId') || store.selectedTripId;
  const trip = useMemo(() => {
    if (!selectedTripId) return null;
    return activeUserTrips.find((t) => t.id === selectedTripId) || null;
  }, [selectedTripId, activeUserTrips]);

  function handleSelectTrip(tripId) {
    setSearchParams({ tripId });
    setState((s) => ({ ...s, selectedTripId: tripId }));
  }

  function handleBackToTrips() {
    setSearchParams({});
    setState((s) => ({ ...s, selectedTripId: null }));
  }

  // 1. Empty State: No active trips found
  if (!loading && activeUserTrips.length === 0) {
    return (
      <EmptyState
        icon="bag"
        title="No active trips yet"
        message="Create an active trip to get an AI-generated packing checklist."
        action={<Button onClick={() => navigate('/my-journey/trip?create=true')} icon="sparkles">Create My Trip</Button>}
      />
    );
  }

  // 2. Trip Selection List when no trip is selected
  if (!trip) {
    return (
      <div className="journey-view">
        <Card className="select-trip-card">
          <div className="card-head">
            <div>
              <h2>Select a Trip to View Packing List</h2>
              <span style={{ fontSize: '13.5px', color: 'var(--text-muted)' }}>
                Choose one of your active trips below to view its personalized, day-wise packing checklist.
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
            {activeUserTrips.map((t) => {
              const tripName = t.destination?.toLowerCase().includes('trip') ||
                t.destination?.toLowerCase().includes('tour') ||
                t.destination?.toLowerCase().includes('getaway') ||
                t.destination?.toLowerCase().includes('escape')
                ? t.destination
                : `${t.destination} Trip`;
              const duration = getDurationDays(t);
              const members = getActiveMemberCount(t);
              const dateString = formatTripDates(t);

              return (
                <div
                  key={t.id}
                  onClick={() => handleSelectTrip(t.id)}
                  className="account-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color, #e5e7eb)',
                    background: 'var(--bg-card, #ffffff)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span className="marker-icon purple" style={{ width: '42px', height: '42px', borderRadius: '12px' }}>
                      <Icon name="bag" size={20} />
                    </span>
                    <div>
                      <strong style={{ fontSize: '16px', color: 'var(--text)', fontWeight: 650 }}>
                        {tripName}
                      </strong>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '3px' }}>
                        {dateString}
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'var(--purple)', fontWeight: 600, marginTop: '2px' }}>
                        {duration} {duration === 1 ? 'day' : 'days'} · {members} {members === 1 ? 'member' : 'members'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Icon name="chevron-right" size={22} style={{ color: 'var(--text-muted)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    );
  }

  // 3. Trip-Specific Packing List View
  const packing = trip.packing || [];
  const totalItems = packing.reduce((s, d) => s + (d.items?.length || 0), 0);
  const doneItems = packing.reduce((s, d) => s + (d.items?.filter((i) => i.done).length || 0), 0);

  const selectedTripTitle = trip.destination?.toLowerCase().includes('trip') ||
    trip.destination?.toLowerCase().includes('tour') ||
    trip.destination?.toLowerCase().includes('getaway') ||
    trip.destination?.toLowerCase().includes('escape')
    ? trip.destination
    : `${trip.destination} Trip`;

  return (
    <div className="journey-view">
      {/* Top navigation row: ← Back to Trips */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <Button
          variant="ghost"
          size="sm"
          icon="arrow-left"
          onClick={handleBackToTrips}
        >
          ← Back to Trips
        </Button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', color: 'var(--text-muted)' }}>
          <Icon name="map-pin" size={15} />
          <strong style={{ color: 'var(--text)' }}>{selectedTripTitle}</strong>
        </div>
      </div>

      <Card className="packing-header-card">
        <div className="packing-head">
          <div>
            <h2>AI Packing List</h2>
            <p className="packing-sub">
              Smart packing suggestions based on your itinerary.
              {trip.destination ? ` ${trip.destination} • ${trip.duration || `${getDurationDays(trip)} Days`}` : ''}
            </p>
          </div>
          <div className="packing-progress">
            <span className="packing-count">{doneItems}/{totalItems} packed</span>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${totalItems ? (doneItems / totalItems) * 100 : 0}%` }} />
            </div>
          </div>
        </div>
        <p className="packing-ai-note">
          <Icon name="sparkles" size={14} /> AI-generated day-wise suggestions for {trip.destination}. You can only mark items as packed — items update automatically when your trip changes.
        </p>
      </Card>

      {packing.map((dayPack, di) => (
        <Card key={di} className="packing-day-card">
          <div className="packing-day-head">
            <h3>DAY {dayPack.day}</h3>
            {dayPack.places?.length > 0 && (
              <div className="packing-day-places">
                <span className="packing-day-label">Places:</span>
                <span className="chip chip-muted">{dayPack.places.join(' • ')}</span>
              </div>
            )}
          </div>

          <div className="packing-items">
            {(dayPack.items || []).map((item) => (
              <label key={item.id} className={`packing-item ${item.done ? 'done' : ''}`} title={item.reason}>
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => tripService.togglePackingItem(trip.id, di, item.id)}
                />
                <span className="check-box">
                  {item.done && <Icon name="check" size={13} />}
                </span>
                <span className="packing-label">{item.label}</span>
                <span className="packing-reason">{item.reason}</span>
              </label>
            ))}
          </div>

          <div className="packing-day-reason">
            <Icon name="info" size={14} />
            <span>{dayPack.reason}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}
