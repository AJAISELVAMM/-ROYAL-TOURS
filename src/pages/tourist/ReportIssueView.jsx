import React, { useState } from 'react';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Icon from '../../components/common/Icon.jsx';
import LocationAutocomplete from '../../components/common/LocationAutocomplete.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import * as safetyService from '../../services/safetyService.js';

const CATEGORIES = [
  { key: 'Fare', icon: 'car', label: 'Taxi / Fare' },
  { key: 'Restaurant', icon: 'utensils', label: 'Restaurant' },
  { key: 'Shop', icon: 'bag', label: 'Shop' },
  { key: 'Attraction', icon: 'map-pin', label: 'Attraction' },
  { key: 'Other', icon: 'alert-circle', label: 'Other' }
];

export default function ReportIssueView() {
  const { user } = useAuth();
  const { push } = useToast();
  const [form, setForm] = useState({
    category: 'Fare',
    location: '',
    latitude: null,
    longitude: null,
    description: '',
    expectedPrice: '',
    chargedPrice: '',
    photo: ''
  });
  const [photoName, setPhotoName] = useState('');
  const [submitted, setSubmitted] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) {
      setForm((f) => ({ ...f, photo: '' }));
      setPhotoName('');
      return;
    }
    if (!file.type.startsWith('image/')) {
      push('Please select a valid image (JPG, JPEG, PNG, WEBP).', 'error');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      push('Image size should be less than 8MB.', 'error');
      return;
    }
    setPhotoName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, photo: reader.result }));
    };
    reader.readAsDataURL(file);
  }

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await safetyService.submitReport({
        category: form.category,
        location: form.location,
        latitude: form.latitude,
        longitude: form.longitude,
        description: form.description,
        expectedPrice: form.expectedPrice ? Number(form.expectedPrice) : undefined,
        chargedPrice: form.chargedPrice ? Number(form.chargedPrice) : undefined,
        photo: form.photo
      });
      setSubmitted(result.report || result);
      push('Safety report submitted successfully. Under review by authorities.', 'success');
    } catch (err) {
      setError(err?.message || 'Could not submit safety report.');
      push(err?.message || 'Report submission failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="safety-view">
        <Card>
          <div className="report-success">
            <div className="success-mark"><Icon name="check" size={28} /></div>
            <h2>Report Created</h2>
            <p>Thank you. Your report has been submitted and is being reviewed.</p>
            <div className="report-summary">
              <div className="detail-facts">
                <li><strong>Report ID:</strong> {submitted.id}</li>
                <li><strong>Category:</strong> {submitted.category}</li>
                <li><strong>Status:</strong> <span className="badge badge-warning">Under Review</span></li>
              </div>
            </div>
            <Button icon="plus" onClick={() => { setSubmitted(null); setPhotoName(''); setForm({ category: 'Fare', location: '', latitude: null, longitude: null, description: '', expectedPrice: '', chargedPrice: '', photo: '' }); }}>
              Submit Another Report
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="safety-view">
      <Card>
        <div className="card-head"><h2>Report an Issue</h2></div>
        <form onSubmit={submit} className="modal-form">
          <div className="field">
            <span className="field-label">Category</span>
            <div className="category-picker">
              {CATEGORIES.map((c) => (
                <button type="button" key={c.key} className={`category-option ${form.category === c.key ? 'active' : ''}`} onClick={() => setForm((f) => ({ ...f, category: c.key }))}>
                  <Icon name={c.icon} size={18} />
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field-label">Location</span>
            <LocationAutocomplete
              value={form.location}
              onChange={(val) => setForm((f) => ({ ...f, location: val, latitude: null, longitude: null }))}
              onSelect={(sug) => setForm((f) => ({
                ...f,
                location: sug.name,
                latitude: sug.latitude,
                longitude: sug.longitude
              }))}
              placeholder="Search location (e.g. Gandhipuram, Railway Station)"
            />
          </div>
          <label className="field">
            <span className="field-label">Description</span>
            <textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Describe what happened…" required />
          </label>
          <div className="grid-2">
            <label className="field">
              <span className="field-label">Expected Price (₹)</span>
              <input type="number" value={form.expectedPrice} onChange={(e) => setForm((f) => ({ ...f, expectedPrice: e.target.value }))} placeholder="e.g. 280" />
            </label>
            <label className="field">
              <span className="field-label">Charged Price (₹)</span>
              <input type="number" value={form.chargedPrice} onChange={(e) => setForm((f) => ({ ...f, chargedPrice: e.target.value }))} placeholder="e.g. 500" />
            </label>
          </div>
          <label className="field">
            <span className="field-label">Optional Photo Evidence</span>
            <div className="upload-box">
              <Icon name="upload" size={20} />
              <span>{photoName || (form.photo ? 'Photo attached' : 'Add a photo as evidence (optional)')}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/jpg" onChange={handlePhotoChange} />
            </div>
          </label>
          {error && (
            <div className="form-error" style={{ marginBottom: '14px' }}>
              <Icon name="alert-circle" size={15} /> {error}
            </div>
          )}
          <Button type="submit" block size="lg" icon="send" loading={submitting}>Submit Report</Button>
        </form>
      </Card>
    </div>
  );
}
