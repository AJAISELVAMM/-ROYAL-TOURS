import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../common/Card.jsx';
import Button from '../common/Button.jsx';
import Icon from '../common/Icon.jsx';
import LocationAutocomplete from '../common/LocationAutocomplete.jsx';
import ImageWithFallback from '../common/ImageWithFallback.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../services/api.js';
import * as tripService from '../../services/tripService.js';
import { haversineDistanceKm } from '../../utils/geoUtils.js';

const DURATIONS = [
  { label: '1 Day', days: 1 },
  { label: '2 Days', days: 2 },
  { label: '3 Days', days: 3 },
  { label: '5 Days', days: 5 }
];

const GROUPS = ['Solo', 'Couple', 'Family', 'Friends'];

const GROUP_LIMITS = {
  Solo: { min: 1, max: 1, default: 1 },
  Couple: { min: 2, max: 2, default: 2 },
  Family: { min: 2, max: 10, default: 4 },
  Friends: { min: 2, max: 10, default: 4 }
};

const STEPS = ['Trip Details', 'Travel Group', 'Choose Places', 'Review'];

function getTodayString() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

function calculateEndDate(startDateStr, days) {
  if (!startDateStr) return '';
  const d = new Date(startDateStr);
  d.setDate(d.getDate() + (Math.max(1, days) - 1));
  return d.toISOString().split('T')[0];
}

export default function TripPlanner({ initialDestination, initialCoords, onSuccess, onCancel }) {
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [loadingPlaces, setLoadingPlaces] = useState(false);

  const [form, setForm] = useState({
    destination: initialDestination || 'Coimbatore',
    destinationAddress: initialDestination ? `${initialDestination}, Tamil Nadu, India` : 'Coimbatore, Tamil Nadu, India',
    destinationCoords: initialCoords || { latitude: 11.0168, longitude: 76.9558 },
    startDate: getTodayString(),
    duration: '2 Days',
    durationDays: 2,
    budget: '5000',
    group: 'Solo'
  });

  const [memberCount, setMemberCount] = useState(1);
  const [members, setMembers] = useState([{ name: user?.name || '', phone: user?.phone || '' }]);
  const [selectedPlaceIds, setSelectedPlaceIds] = useState([]);
  const [destinationPlaces, setDestinationPlaces] = useState([]);
  const [error, setError] = useState('');

  const endDate = useMemo(() => {
    return calculateEndDate(form.startDate, form.durationDays);
  }, [form.startDate, form.durationDays]);

  useEffect(() => {
    let active = true;
    const dest = form.destination?.trim();
    if (!dest) {
      setDestinationPlaces([]);
      setSelectedPlaceIds([]);
      setLoadingPlaces(false);
      return;
    }

    // Immediately clear previous places and show loading state to avoid stale data
    setDestinationPlaces([]);
    setSelectedPlaceIds([]);
    setLoadingPlaces(true);

    const abortCtrl = new AbortController();

    async function fetchRealNearbyPlaces() {
      try {
        let coords = form.destinationCoords;

        // Step 1: Resolve destination to latitude + longitude if not already resolved
        if (!coords || coords.latitude == null || coords.longitude == null) {
          try {
            const geoData = await api.get(`/geocoding/search?q=${encodeURIComponent(dest)}&limit=1`, {
              signal: abortCtrl.signal
            });
            const geoItems = Array.isArray(geoData) ? geoData : (geoData?.items || []);
            if (geoItems.length > 0 && geoItems[0].latitude != null && geoItems[0].longitude != null) {
              coords = {
                latitude: geoItems[0].latitude,
                longitude: geoItems[0].longitude
              };
              if (active) {
                setForm((f) => ({
                  ...f,
                  destinationAddress: geoItems[0].address || geoItems[0].label || `${dest}, Tamil Nadu, India`,
                  destinationCoords: coords
                }));
              }
            }
          } catch (geoErr) {
            // Backend will resolve destination fallback if frontend geocoding had an issue
          }
        }

        // Step 2: Fetch real places around that destination (60 km radius)
        const url = coords?.latitude != null && coords?.longitude != null
          ? `/discover/places?latitude=${coords.latitude}&longitude=${coords.longitude}&radius=60000&limit=50`
          : `/discover/places?destination=${encodeURIComponent(dest)}&radius=60000&limit=50`;

        const data = await api.get(url, { signal: abortCtrl.signal });
        if (!active) return;

        const rawItems = Array.isArray(data) ? data : (data?.items || []);

        const destLat = coords?.latitude;
        const destLon = coords?.longitude;

        // Step 3: Strictly filter: only real locations within 0-60 km radius of selected destination
        const filteredPlaces = rawItems
          .map((p) => {
            let dist = p.distanceKm;
            if (destLat != null && destLon != null && p.latitude != null && p.longitude != null) {
              dist = haversineDistanceKm(destLat, destLon, p.latitude, p.longitude);
            }
            return {
              ...p,
              distanceKm: dist != null ? Math.round(dist * 10) / 10 : null
            };
          })
          .filter((p) => p.distanceKm != null && p.distanceKm <= 60)
          .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));

        setDestinationPlaces(filteredPlaces);
        // Pre-select first places for the new destination
        setSelectedPlaceIds(
          filteredPlaces.slice(0, Math.min(filteredPlaces.length, form.durationDays * 2)).map((p) => p.id)
        );
      } catch (err) {
        if (active && err.name !== 'AbortError') {
          setDestinationPlaces([]);
          setSelectedPlaceIds([]);
        }
      } finally {
        if (active) setLoadingPlaces(false);
      }
    }

    fetchRealNearbyPlaces();

    return () => {
      active = false;
      abortCtrl.abort();
    };
  }, [form.destination, form.destinationCoords?.latitude, form.destinationCoords?.longitude, form.durationDays]);

  function handleDestinationSelect(suggestion) {
    const coords = {
      latitude: suggestion.latitude,
      longitude: suggestion.longitude
    };
    setForm((f) => ({
      ...f,
      destination: suggestion.name,
      destinationAddress: suggestion.address || suggestion.label,
      destinationCoords: coords
    }));
    // Immediately clear stale places
    setDestinationPlaces([]);
    setSelectedPlaceIds([]);
  }

  function handleDestinationInputChange(val) {
    setForm((f) => ({
      ...f,
      destination: val,
      destinationAddress: '',
      destinationCoords: null
    }));
    // Immediately clear stale places
    setDestinationPlaces([]);
    setSelectedPlaceIds([]);
  }

  function setGroup(group) {
    const limits = GROUP_LIMITS[group];
    setForm((f) => ({ ...f, group }));
    setMemberCount(limits.default);
    setMembers(Array.from({ length: limits.default }, (_, idx) => ({
      name: idx === 0 && user?.name ? user.name : '',
      phone: idx === 0 && user?.phone ? user.phone : ''
    })));
  }

  function setDuration(label, days) {
    setForm((f) => ({ ...f, duration: label, durationDays: days }));
  }

  function adjustCount(delta) {
    const limits = GROUP_LIMITS[form.group];
    const next = Math.max(limits.min, Math.min(limits.max, memberCount + delta));
    if (next === memberCount) return;
    setMemberCount(next);
    setMembers((prev) => {
      const copy = prev.slice(0, next);
      while (copy.length < next) copy.push({ name: '', phone: '' });
      return copy;
    });
  }

  function updateMember(index, key, value) {
    setMembers((prev) => prev.map((m, i) => (i === index ? { ...m, [key]: value } : m)));
  }

  function togglePlace(id) {
    setSelectedPlaceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function validateStep() {
    setError('');
    if (step === 0) {
      if (!form.destination.trim()) return 'Please enter a destination.';
      if (!form.startDate) return 'Please select a starting date.';
      if (!form.budget || Number(form.budget) <= 0) return 'Please enter a valid budget.';
      if (!form.group) return 'Please select who you are travelling with.';
    }
    if (step === 1) {
      for (let i = 0; i < members.length; i++) {
        const m = members[i];
        if (!m.name.trim()) return `Please enter the name for Member ${i + 1}.`;
        if (!/^\d{10}$/.test(m.phone.trim())) return `Please enter a valid 10-digit phone number for Member ${i + 1}.`;
      }
    }
    if (step === 2) {
      if (selectedPlaceIds.length === 0) return 'Please select at least one tourist place.';
    }
    return null;
  }

  function next() {
    const err = validateStep();
    if (err) return setError(err);
    setStep((s) => s + 1);
  }

  function back() {
    setError('');
    setStep((s) => Math.max(0, s - 1));
  }

  async function createTrip() {
    const err = validateStep();
    if (err) return setError(err);
    setCreating(true);
    try {
      const result = await tripService.createPlannedTrip({
        touristId: user?.id,
        touristName: user?.name,
        destination: form.destination,
        destinationAddress: form.destinationAddress,
        latitude: form.destinationCoords?.latitude,
        longitude: form.destinationCoords?.longitude,
        startDate: form.startDate,
        endDate,
        duration: form.duration,
        durationDays: form.durationDays,
        budget: form.budget,
        group: form.group,
        memberCount,
        members,
        selectedPlaceIds
      });
      if (result.success) {
        push('Your personalized trip is ready!', 'success', { id: 'trip-created' });
        if (onSuccess) {
          onSuccess(result.trip);
        } else {
          navigate('/my-journey/trip');
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
    } catch (e) {
      const msg = e?.message || 'Something went wrong. Please try again.';
      setError(msg);
      push(msg, 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card className="trip-planner-card">
      <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2><Icon name="sparkles" size={20} /> AI Trip Planner</h2>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel} icon="x">
            Cancel
          </Button>
        )}
      </div>

      {/* Progress steps */}
      <div className="planner-steps">
        {STEPS.map((s, i) => (
          <div key={s} className={`planner-step ${i < step ? 'done' : ''} ${i === step ? 'active' : ''}`}>
            <span className="planner-step-dot">{i < step ? <Icon name="check" size={12} /> : i + 1}</span>
            <span className="planner-step-label">{s}</span>
          </div>
        ))}
      </div>

      {error && <div className="form-error"><Icon name="alert-circle" size={15} /> {error}</div>}

      {/* STEP 0 — Trip details */}
      {step === 0 && (
        <div className="planner-form">
          <div className="field">
            <span className="field-label">Destination</span>
            <LocationAutocomplete
              value={form.destination}
              onChange={handleDestinationInputChange}
              onSelect={handleDestinationSelect}
              placeholder="Where are you going? e.g. Coimbatore, Ooty, Chennai"
            />
            {form.destinationAddress && (
              <span style={{ fontSize: '12px', color: 'var(--purple)', marginTop: '4px', display: 'block' }}>
                📍 {form.destinationAddress}
              </span>
            )}
          </div>

          <div className="grid-2">
            <div className="field">
              <span className="field-label">Duration</span>
              <div className="option-row">
                {DURATIONS.map((d) => (
                  <button
                    key={d.label}
                    type="button"
                    className={`option-pill ${form.duration === d.label ? 'active' : ''}`}
                    onClick={() => setDuration(d.label, d.days)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="field">
              <span className="field-label">Starting Date</span>
              <div className="field-control">
                <Icon name="calendar" size={16} />
                <input
                  type="date"
                  value={form.startDate}
                  min={getTodayString()}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
            </label>
          </div>

          <div style={{ padding: '8px 12px', background: 'var(--purple-50)', borderRadius: '10px', fontSize: '13px', color: 'var(--purple-deep)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Icon name="clock" size={15} />
            <span>Trip Dates: {form.startDate} to {endDate} ({form.durationDays} {form.durationDays === 1 ? 'Day' : 'Days'})</span>
          </div>

          <label className="field">
            <span className="field-label">Budget (₹)</span>
            <div className="field-control">
              <Icon name="wallet" size={16} />
              <input
                type="number"
                value={form.budget}
                onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                placeholder="Total budget for the trip"
              />
            </div>
          </label>

          <div className="field">
            <span className="field-label">Travelling With</span>
            <div className="option-row">
              {GROUPS.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`option-pill ${form.group === g ? 'active' : ''}`}
                  onClick={() => setGroup(g)}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="planner-nav">
            <span />
            <Button onClick={next} iconRight="arrow-right">Continue</Button>
          </div>
        </div>
      )}

      {/* STEP 1 — Members */}
      {step === 1 && (
        <div className="planner-form">
          <div className="member-count-row">
            <div>
              <span className="field-label">How many people are travelling?</span>
              <p className="field-hint">Members in your travel group.</p>
            </div>
            <div className="stepper">
              <button type="button" className="stepper-btn" onClick={() => adjustCount(-1)} aria-label="Decrease">−</button>
              <span className="stepper-value">{memberCount}</span>
              <button type="button" className="stepper-btn" onClick={() => adjustCount(1)} aria-label="Increase">+</button>
            </div>
          </div>

          <h3 className="member-form-title">Travel Group Details</h3>
          <div className="member-forms">
            {members.map((m, i) => (
              <div className="member-form" key={i}>
                <span className="member-form-head">Member {i + 1}</span>
                <div className="grid-2">
                  <label className="field">
                    <span className="field-label">Full Name</span>
                    <input
                      type="text"
                      value={m.name}
                      onChange={(e) => updateMember(i, 'name', e.target.value)}
                      placeholder={`Member ${i + 1} name`}
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Phone Number</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={m.phone}
                      onChange={(e) => updateMember(i, 'phone', e.target.value.replace(/[^\d]/g, '').slice(0, 10))}
                      placeholder="10-digit number"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="planner-nav">
            <Button variant="ghost" onClick={back} icon="arrow-left">Back</Button>
            <Button onClick={next} iconRight="arrow-right">Continue</Button>
          </div>
        </div>
      )}

      {/* STEP 2 — Choose places */}
      {step === 2 && (
        <div className="planner-form">
          <h3 className="member-form-title">Choose the places you want to visit</h3>
          <p className="field-hint">Real nearby tourist places discovered around {form.destination}.</p>

          {loadingPlaces ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--purple)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <Icon name="loader" size={24} className="spin" />
              <span>Finding real tourist places around {form.destination}…</span>
            </div>
          ) : destinationPlaces.length === 0 ? (
            <div className="places-empty">
              <Icon name="map-pin" size={22} />
              <p>No places found for “{form.destination}”. Try searching for another destination.</p>
            </div>
          ) : (
            <>
              <div className="places-selected-count">
                {selectedPlaceIds.length} {selectedPlaceIds.length === 1 ? 'place' : 'places'} selected
              </div>
              <div className="place-select-list">
                {destinationPlaces.map((p) => {
                  const selected = selectedPlaceIds.includes(p.id);
                  return (
                    <label key={p.id} className={`place-select-card ${selected ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => togglePlace(p.id)}
                      />
                      <span className="place-select-image" style={{ width: '48px', height: '48px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}>
                        <ImageWithFallback
                          src={p.image}
                          alt={p.name}
                          category={p.category || 'places'}
                          type="places"
                          iconFallback={<Icon name="map-pin" size={24} />}
                        />
                      </span>
                      <span className="place-select-body">
                        <span className="place-select-name">{p.name}</span>
                        <span className="place-select-meta">
                          {p.rating != null && <span><Icon name="star" size={12} /> {p.rating.toFixed(1)}</span>}
                          {p.distanceKm != null && <span><Icon name="map-pin" size={12} /> {p.distanceKm} km</span>}
                          <span className="chip chip-muted">{p.category || 'Sightseeing'}</span>
                        </span>
                        <span className="place-select-hours"><Icon name="clock" size={12} /> {p.openingHours || 'Open daily'}</span>
                        <span className="place-select-desc">{p.address || p.description || 'Verified tourist destination'}</span>
                      </span>
                      <span className={`place-select-check ${selected ? 'checked' : ''}`}>
                        {selected && <Icon name="check" size={14} />}
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          )}

          <div className="planner-nav">
            <Button variant="ghost" onClick={back} icon="arrow-left">Back</Button>
            <Button onClick={next} iconRight="arrow-right">Continue</Button>
          </div>
        </div>
      )}

      {/* STEP 3 — Review & create */}
      {step === 3 && (
        <div className="planner-form">
          <h3 className="member-form-title">Review your trip</h3>
          <div className="review-grid">
            <div className="review-item"><span className="review-label">Destination</span><strong>{form.destination}</strong></div>
            <div className="review-item"><span className="review-label">Trip Dates</span><strong>{form.startDate} to {endDate}</strong></div>
            <div className="review-item"><span className="review-label">Duration</span><strong>{form.duration}</strong></div>
            <div className="review-item"><span className="review-label">Budget</span><strong>₹{Number(form.budget).toLocaleString('en-IN')}</strong></div>
            <div className="review-item"><span className="review-label">Travelling With</span><strong>{form.group}</strong></div>
            <div className="review-item"><span className="review-label">Members</span><strong>{memberCount} people</strong></div>
            <div className="review-item"><span className="review-label">Places</span><strong>{selectedPlaceIds.length} selected</strong></div>
          </div>

          <div className="review-members">
            {members.map((m, i) => (
              <div className="review-member-row" key={i}>
                <span className="member-avatar sm">{m.name[0]?.toUpperCase() || '?'}</span>
                <span className="review-member-info">
                  <strong>{m.name}</strong>
                  <span>{m.phone}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="review-places">
            {destinationPlaces
              .filter((p) => selectedPlaceIds.includes(p.id))
              .map((p) => (
                <span className="chip" key={p.id}>{p.name}</span>
              ))}
          </div>

          <div className="planner-nav">
            <Button variant="ghost" onClick={back} icon="arrow-left">Back</Button>
            <Button onClick={createTrip} loading={creating} icon="sparkles" size="lg">
              {creating ? 'Creating your personalized trip…' : 'Create My Trip'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
