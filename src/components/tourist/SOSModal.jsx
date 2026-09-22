import React, { useState } from 'react';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import Icon from '../common/Icon.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useLocation } from '../../context/LocationContext.jsx';
import * as sosService from '../../services/sosService.js';

const EMERGENCY_TYPES = [
  { key: 'Medical', icon: 'hospital', color: '#dc2626' },
  { key: 'Police', icon: 'police', color: '#2563eb' },
  { key: 'Fire', icon: 'fire', color: '#ea580c' },
  { key: 'Hospital', icon: 'pharmacy', color: '#7c3aed' }
];

export default function SOSModal({ open, onClose }) {
  const { user } = useAuth();
  const { push } = useToast();
  const { currentLocation, permissionStatus } = useLocation();

  const [step, setStep] = useState('type'); // type -> details -> confirm -> created
  const [emergencyType, setEmergencyType] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [created, setCreated] = useState(null);

  function reset() {
    setStep('type');
    setEmergencyType(null);
    setConnecting(false);
    setCreated(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function selectType(type) {
    setEmergencyType(type);
    setStep('details');
  }

  async function confirmSOS() {
    if (connecting) return;
    if (currentLocation.latitude == null || currentLocation.longitude == null) {
      push('Live GPS location is required to transmit emergency SOS. Please allow location permissions.', 'error', { id: 'sos-gps' });
      return;
    }

    setConnecting(true);
    try {
      playSOSAlertSound();
      triggerSOSVibration();
      const result = await sosService.createSOS({
        touristId: user?.id,
        touristName: user?.name,
        phone: user?.phone,
        emergencyType,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        accuracy: currentLocation.accuracy,
        locationText: `GPS (${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)})`
      });
      setCreated(result.request || result);
      setStep('created');
      push('SOS emergency broadcast transmitted to Command Center & responders', 'success', { id: 'sos-status' });
    } catch (e) {
      push(e?.message || 'Could not create SOS request.', 'error', { id: 'sos-status' });
    } finally {
      setConnecting(false);
    }
  }

  const hasGps = currentLocation.latitude != null && currentLocation.longitude != null;

  return (
    <Modal open={open} onClose={handleClose} title="Emergency SOS Dispatch" size="md">
      {step === 'type' && (
        <div className="sos-steps">
          <p className="sos-intro">Select the type of emergency you need immediate assistance with.</p>
          <div className="sos-types">
            {EMERGENCY_TYPES.map((t) => (
              <button key={t.key} className="sos-type" onClick={() => selectType(t.key)}>
                <span className="sos-type-icon" style={{ background: `${t.color}1a`, color: t.color }}>
                  <Icon name={t.icon} size={26} />
                </span>
                <span>{t.key}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'details' && (
        <div className="sos-steps">
          <div className="sos-detail-grid">
            <div className="sos-detail">
              <span className="sos-detail-label">Tourist Name</span>
              <span className="sos-detail-value">{user?.name || 'Tourist'}</span>
            </div>
            <div className="sos-detail">
              <span className="sos-detail-label">Phone</span>
              <span className="sos-detail-value">{user?.phone || '—'}</span>
            </div>
            <div className="sos-detail">
              <span className="sos-detail-label">Emergency Type</span>
              <span className="sos-detail-value sos-emergency">{emergencyType}</span>
            </div>
            <div className="sos-detail">
              <span className="sos-detail-label">Live GPS Coordinates</span>
              <span className="sos-detail-value" style={{ fontFamily: 'monospace' }}>
                {hasGps
                  ? `${currentLocation.latitude.toFixed(5)}, ${currentLocation.longitude.toFixed(5)}`
                  : permissionStatus === 'denied'
                  ? 'Permission Denied'
                  : 'Acquiring GPS…'}
              </span>
            </div>
            <div className="sos-detail">
              <span className="sos-detail-label">GPS Accuracy</span>
              <span className="sos-detail-value">
                {currentLocation.accuracy ? `±${Math.round(currentLocation.accuracy)} m` : '—'}
              </span>
            </div>
            <div className="sos-detail">
              <span className="sos-detail-label">Dispatch Target</span>
              <span className="sos-detail-value" style={{ color: '#dc2626', fontWeight: 600 }}>
                Admin Safety Control Center & Local 112 / 108
              </span>
            </div>
          </div>
          <div className="sos-actions" style={{ marginTop: '20px' }}>
            <Button variant="ghost" onClick={() => setStep('type')} icon="arrow-left">
              Back
            </Button>
            <Button variant="danger" onClick={confirmSOS} loading={connecting} disabled={!hasGps} icon="siren">
              {connecting ? 'Transmitting…' : 'Transmit SOS Now'}
            </Button>
          </div>
        </div>
      )}

      {step === 'created' && created && (
        <div className="sos-steps">
          <div className="sos-success">
            <div className="sos-success-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
              <Icon name="siren" size={30} />
            </div>
            <h3>Emergency SOS Active</h3>
            <p>Your live GPS coordinates have been broadcast to the admin safety response dashboard and emergency contacts.</p>
          </div>
          <div className="sos-detail-grid">
            <div className="sos-detail">
              <span className="sos-detail-label">Emergency Type</span>
              <span className="sos-detail-value sos-emergency">{created.emergencyType}</span>
            </div>
            <div className="sos-detail">
              <span className="sos-detail-label">Tourist</span>
              <span className="sos-detail-value">{created.touristName}</span>
            </div>
            <div className="sos-detail">
              <span className="sos-detail-label">GPS Coordinates</span>
              <span className="sos-detail-value" style={{ fontFamily: 'monospace' }}>
                {created.latitude?.toFixed(4)}, {created.longitude?.toFixed(4)}
              </span>
            </div>
            <div className="sos-detail">
              <span className="sos-detail-label">Timestamp</span>
              <span className="sos-detail-value">{new Date(created.timestamp).toLocaleTimeString()}</span>
            </div>
            <div className="sos-detail">
              <span className="sos-detail-label">Status</span>
              <StatusBadge status="danger">Active Dispatch</StatusBadge>
            </div>
          </div>
          <div className="sos-actions" style={{ marginTop: '20px' }}>
            <Button block onClick={handleClose}>
              Close & Monitor
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
