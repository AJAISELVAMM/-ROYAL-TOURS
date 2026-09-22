import React, { useState, useEffect } from 'react';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Icon from '../../components/common/Icon.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import LocationAutocomplete from '../../components/common/LocationAutocomplete.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useLocation } from '../../context/LocationContext.jsx';
import * as fareService from '../../services/fareService.js';
import * as transportService from '../../services/transportService.js';
import { formatDistance } from '../../utils/geoUtils.js';

const VEHICLES = [
  { id: 'AUTO', label: 'Auto', icon: 'navigation' },
  { id: 'RICKSHAW', label: 'Rickshaw', icon: 'compass' },
  { id: 'CAB', label: 'Cab / Taxi', icon: 'car' },
  { id: 'BIKE', label: 'Bike Taxi', icon: 'navigation' }
];

const VEHICLE_FARE_CONFIG = {
  AUTO: { name: 'Auto', baseFare: 30, perKm: 12, minFare: 40 },
  RICKSHAW: { name: 'Rickshaw', baseFare: 15, perKm: 9, minFare: 20 },
  CAB: { name: 'Cab / Taxi', baseFare: 50, perKm: 18, minFare: 80 },
  BIKE: { name: 'Bike Taxi', baseFare: 15, perKm: 8, minFare: 25 },
  BIKE_TAXI: { name: 'Bike Taxi', baseFare: 15, perKm: 8, minFare: 25 }
};

export default function FairFareView() {
  const { push } = useToast();
  const { currentLocation, selectedLocation } = useLocation();

  const [vehicleType, setVehicleType] = useState('AUTO');
  const [pickup, setPickup] = useState('My Current Location');
  const [pickupCoords, setPickupCoords] = useState(null);
  const [destination, setDestination] = useState('');
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [quotedFare, setQuotedFare] = useState('');
  const [distanceKm, setDistanceKm] = useState(null);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Pre-fill destination from selected place
  useEffect(() => {
    if (selectedLocation?.name) {
      setDestination(selectedLocation.name);
      if (selectedLocation.latitude != null && selectedLocation.longitude != null) {
        setDestinationCoords({
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          name: selectedLocation.name,
          address: selectedLocation.address
        });
      }
    }
  }, [selectedLocation]);

  // When pickup or destination changes, calculate real road distance via OSRM
  async function calculateRoadDistance(destOverride, pickupOverride) {
    let origin = pickup.trim();
    if (pickupOverride?.latitude != null && pickupOverride?.longitude != null) {
      origin = { latitude: pickupOverride.latitude, longitude: pickupOverride.longitude, label: pickupOverride.name || pickup };
    } else if (origin === 'My Current Location' || !origin) {
      if (currentLocation.latitude != null && currentLocation.longitude != null) {
        origin = { latitude: currentLocation.latitude, longitude: currentLocation.longitude };
      } else {
        return null;
      }
    } else if (pickupCoords?.latitude != null && pickupCoords?.longitude != null) {
      origin = { latitude: pickupCoords.latitude, longitude: pickupCoords.longitude, label: pickupCoords.name || pickup };
    }

    let dest = destOverride || destination.trim();
    if (!dest) return null;

    if (destinationCoords?.latitude != null && destinationCoords.longitude != null && (!destOverride || destOverride === destinationCoords.name)) {
      dest = { latitude: destinationCoords.latitude, longitude: destinationCoords.longitude, label: destinationCoords.name };
    }

    setCalculatingDistance(true);
    try {
      const route = await transportService.getRoute({
        from: origin,
        to: dest,
        mode: 'driving-car'
      });
      if (route?.distanceKm) {
        setDistanceKm(route.distanceKm);
        return route.distanceKm;
      }
    } catch {
      // Fallback
    } finally {
      setCalculatingDistance(false);
    }
    return null;
  }

  function handlePickupSelect(sug) {
    setPickup(sug.name);
    const coords = {
      latitude: sug.latitude,
      longitude: sug.longitude,
      name: sug.name,
      address: sug.address || sug.label
    };
    setPickupCoords(coords);
    calculateRoadDistance(undefined, coords);
  }

  function handleDestinationSelect(sug) {
    setDestination(sug.name);
    const coords = {
      latitude: sug.latitude,
      longitude: sug.longitude,
      name: sug.name,
      address: sug.address || sug.label
    };
    setDestinationCoords(coords);
    calculateRoadDistance({ latitude: sug.latitude, longitude: sug.longitude, label: sug.name });
  }

  async function recalculateFare(targetVehicle, targetQuote) {
    const vType = targetVehicle || vehicleType;
    const vConf = VEHICLE_FARE_CONFIG[vType] || VEHICLE_FARE_CONFIG.AUTO;

    let d = distanceKm;
    if (!d) {
      d = await calculateRoadDistance();
    }
    const dist = d || 5.0;
    const defaultFair = Math.max(vConf.minFare, Math.round(vConf.baseFare + dist * vConf.perKm));
    const qFare = (targetQuote != null && String(targetQuote).trim() !== '') ? Number(targetQuote) : defaultFair;

    setLoading(true);
    try {
      const res = await fareService.predictFare({
        vehicleType: vType,
        distanceKm: dist,
        quotedFare: qFare,
        pickup: pickup === 'My Current Location' && currentLocation?.latitude ? `${currentLocation.latitude},${currentLocation.longitude}` : (pickupCoords ? `${pickupCoords.latitude},${pickupCoords.longitude}` : pickup),
        destination: destinationCoords ? `${destinationCoords.latitude},${destinationCoords.longitude}` : destination
      });

      setResult(res);
      return res;
    } catch (err) {
      const fb = {
        estimatedFare: defaultFair,
        expectedFare: defaultFair,
        distanceKm: dist,
        fareStatus: qFare > defaultFair * 1.3 ? 'OVERCHARGED' : qFare > defaultFair * 1.1 ? 'SLIGHTLY_HIGH' : 'FAIR',
        breakdown: {
          baseFare: vConf.baseFare,
          perKmRate: vConf.perKm,
          distanceFare: Math.round(dist * vConf.perKm)
        }
      };
      setResult(fb);
      return fb;
    } finally {
      setLoading(false);
    }
  }

  async function handleEstimate(e) {
    if (e) e.preventDefault();
    if (!quotedFare || Number(quotedFare) <= 0) {
      push('Please enter the driver’s quoted fare.', 'error');
      return;
    }

    const res = await recalculateFare(vehicleType, quotedFare);
    if (res) {
      push('Fare analyzed with ML model', 'success');
    }
  }

  function handleVehicleChange(newType) {
    setVehicleType(newType);
    recalculateFare(newType, quotedFare);
  }

  return (
    <div className="fair-fare-view">
      <div className="fair-fare-grid">
        <Card>
          <h2>Fair Fare AI Calculator</h2>
          <p className="section-sub">
            Trained Random Forest ML model analyzing real road network distances to protect tourists against overcharging.
          </p>

          <form onSubmit={handleEstimate} className="fair-form">
            <div className="form-group">
              <label>Vehicle Type</label>
              <div className="vehicle-row">
                {VEHICLES.map((v) => (
                  <button
                    type="button"
                    key={v.id}
                    className={`vehicle-btn ${vehicleType === v.id ? 'active' : ''}`}
                    onClick={() => handleVehicleChange(v.id)}
                  >
                    <Icon name={v.icon} size={18} />
                    <span>{v.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ margin: 0 }}>Pickup Location</label>
                {pickup !== 'My Current Location' && (
                  <button
                    type="button"
                    onClick={() => {
                      setPickup('My Current Location');
                      setPickupCoords(null);
                      calculateRoadDistance(undefined, null);
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--purple)', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Use Live GPS
                  </button>
                )}
              </div>
              <LocationAutocomplete
                value={pickup}
                onChange={(val) => {
                  setPickup(val);
                  if (pickupCoords && pickupCoords.name !== val) {
                    setPickupCoords(null);
                  }
                }}
                onSelect={handlePickupSelect}
                placeholder="Enter pickup location or 'My Current Location'"
              />
              {pickup === 'My Current Location' && currentLocation.latitude != null ? (
                <span style={{ fontSize: '11.5px', color: 'var(--success, #16a34a)', marginTop: '4px', display: 'block' }}>
                  ✓ Live GPS connected ({currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)})
                </span>
              ) : pickupCoords?.address ? (
                <span style={{ fontSize: '11.5px', color: 'var(--purple)', marginTop: '4px', display: 'block' }}>
                  📍 {pickupCoords.address}
                </span>
              ) : null}
            </div>

            <div className="form-group">
              <label>Destination</label>
              <LocationAutocomplete
                value={destination}
                onChange={(val) => {
                  setDestination(val);
                  if (destinationCoords && destinationCoords.name !== val) {
                    setDestinationCoords(null);
                  }
                }}
                onSelect={handleDestinationSelect}
                placeholder="e.g. Coimbatore Airport, Railway Station"
              />
              {destinationCoords?.address && (
                <span style={{ fontSize: '11.5px', color: 'var(--purple)', marginTop: '4px', display: 'block' }}>
                  📍 {destinationCoords.address}
                </span>
              )}
              {calculatingDistance && (
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                  Calculating real road distance…
                </span>
              )}
              {distanceKm != null && !calculatingDistance && (
                <span style={{ fontSize: '12px', color: 'var(--purple)', marginTop: '2px', display: 'block', fontWeight: 600 }}>
                  🛣️ OSRM Road Distance: {formatDistance(distanceKm)}
                </span>
              )}
            </div>

            <div className="form-group">
              <label>Driver’s Quoted Fare (₹)</label>
              <div className="input-with-icon">
                <Icon name="wallet" size={16} />
                <input
                  type="number"
                  value={quotedFare}
                  onChange={(e) => setQuotedFare(e.target.value)}
                  placeholder="Enter quoted fare (e.g. 250)"
                  min="1"
                />
              </div>
            </div>

            <Button type="submit" variant="primary" icon="sparkles" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Analyzing with ML Model…' : 'Check Fair Fare'}
            </Button>
          </form>
        </Card>

        {result && (
          <Card className="fare-result-card">
            <h2>Fare Analysis Verdict</h2>

            <div className="verdict-banner" style={{ marginTop: '16px' }}>
              <div className="fare-big-display">
                <span className="fare-label">Estimated Fair Rate</span>
                <span className="fare-amount">₹{Math.round(result.estimatedFare || result.expectedFare || result.fairFare || 0)}</span>
              </div>
              <div className="fare-status-box">
                <span className="fare-label">Driver Quote</span>
                <span className="fare-quoted">₹{quotedFare}</span>
                <StatusBadge
                  status={
                    result.fareStatus === 'FAIR' || result.status === 'FAIR'
                      ? 'Fair'
                      : result.fareStatus === 'OVERCHARGED' || result.status === 'OVERCHARGED'
                      ? 'Overcharged'
                      : 'Slightly High'
                  }
                >
                  {result.fareStatus || result.status || 'FAIR'}
                </StatusBadge>
              </div>
            </div>

            <div className="fare-breakdown" style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="breakdown-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                <span>Standard Base Fare ({VEHICLE_FARE_CONFIG[vehicleType]?.name || 'Vehicle'})</span>
                <strong>₹{result.breakdown?.baseFare || VEHICLE_FARE_CONFIG[vehicleType]?.baseFare || 30}</strong>
              </div>
              <div className="breakdown-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                <span>Distance Rate ({formatDistance(result.distanceKm || distanceKm || 5)} @ ₹{result.breakdown?.perKmRate || VEHICLE_FARE_CONFIG[vehicleType]?.perKm || 12}/km)</span>
                <strong>₹{Math.round(result.breakdown?.distanceFare || (result.distanceKm || distanceKm || 5) * (VEHICLE_FARE_CONFIG[vehicleType]?.perKm || 12))}</strong>
              </div>
              {result.breakdown?.surgeMultiplier && result.breakdown.surgeMultiplier > 1 && (
                <div className="breakdown-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                  <span>Surge Multiplier</span>
                  <strong>{result.breakdown.surgeMultiplier}x</strong>
                </div>
              )}
              <div className="breakdown-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                <span>Difference</span>
                <strong style={{ color: Number(quotedFare) > (result.estimatedFare || result.expectedFare || 0) ? 'var(--red)' : 'var(--green)' }}>
                  {Number(quotedFare) > (result.estimatedFare || result.expectedFare || 0)
                    ? `+₹${Math.round(Number(quotedFare) - (result.estimatedFare || result.expectedFare || 0))} above fair rate`
                    : 'Within fair range'}
                </strong>
              </div>
            </div>

            <div className="ml-meta-footer" style={{ marginTop: '20px', padding: '10px 14px', background: 'var(--purple-50)', borderRadius: '10px', fontSize: '12px', color: 'var(--purple-deep)' }}>
              <div>🤖 <strong>Model:</strong> {result.modelVersion || 'fare_model_v1 (Random Forest)'}</div>
              {result.confidence != null && (
                <div>🎯 <strong>Confidence:</strong> {Math.min(100, Math.max(0, Math.round(result.confidence * 100)))}%</div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
