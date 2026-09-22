import React, { useState, useEffect } from 'react';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Icon from '../../components/common/Icon.jsx';
import Tabs from '../../components/common/Tabs.jsx';
import Modal from '../../components/common/Modal.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import * as safetyService from '../../services/safetyService.js';

const TABS = [
  { key: 'All', label: 'All' },
  { key: 'Fare', label: 'Fare' },
  { key: 'Restaurant', label: 'Restaurant' },
  { key: 'Shop', label: 'Shop' },
  { key: 'Attraction', label: 'Attraction' }
];

export default function AdminReports() {
  const { push } = useToast();
  const [tab, setTab] = useState('All');
  const [detail, setDetail] = useState(null);
  const [allReports, setAllReports] = useState([]);
  const [enlargedImage, setEnlargedImage] = useState(null);

  function isImageEvidence(evidence) {
    if (!evidence || typeof evidence !== 'string') return false;
    const trimmed = evidence.trim();
    if (trimmed === 'No photo attached' || trimmed === 'No evidence attached') return false;
    if (trimmed.startsWith('data:image/')) return true;
    return /\.(jpe?g|png|webp)($|\?)/i.test(trimmed);
  }

  function hasEvidence(evidence) {
    if (!evidence || typeof evidence !== 'string') return false;
    const trimmed = evidence.trim();
    return trimmed && trimmed !== 'No photo attached' && trimmed !== 'No evidence attached';
  }

  useEffect(() => {
    safetyService.getReports().then(setAllReports).catch(() => {});
  }, []);

  const reports = allReports.filter((r) => tab === 'All' || r.category === tab);
  const detailReport = detail ? allReports.find((r) => r.id === detail) : null;

  async function setStatus(id, status) {
    try {
      await safetyService.updateReportStatus(id, status);
      setAllReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      push(`Report ${status.toLowerCase()}`, 'success');
      if (detail === id) setDetail(null);
    } catch (e) {
      push(e?.message || 'Could not update report.', 'error');
    }
  }

  return (
    <div className="page-inner">
      <h1 className="page-title">Fare & Reports</h1>
      <p className="page-sub">Review and resolve user-submitted reports.</p>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <Card padded={false}>
        {reports.length === 0 ? (
          <EmptyState icon="alert-triangle" title="No reports" message={`No ${tab.toLowerCase()} reports to review.`} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tourist</th><th>Category</th><th>Location</th><th>Expected</th><th>Charged</th><th>Status</th><th>Date</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.touristName}</strong></td>
                    <td><span className="chip chip-muted">{r.category}</span></td>
                    <td>{r.location}</td>
                    <td>₹{r.expectedPrice}</td>
                    <td>₹{r.chargedPrice}</td>
                    <td><StatusBadge status={r.status}>{r.status}</StatusBadge></td>
                    <td>{r.date}</td>
                    <td>
                      <div className="table-actions">
                        <button className="icon-btn" title="View" onClick={() => setDetail(r.id)}><Icon name="eye" size={16} /></button>
                        {r.status === 'Under Review' && (
                          <>
                            <button className="icon-btn" title="Resolve" onClick={() => setStatus(r.id, 'Resolved')}><Icon name="check-circle" size={16} /></button>
                            <button className="icon-btn icon-danger" title="Reject" onClick={() => setStatus(r.id, 'Rejected')}><Icon name="x" size={16} /></button>
                          </>
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

      <Modal open={!!detailReport} onClose={() => setDetail(null)} title={detailReport ? `Report ${detailReport.id}` : 'Report'} footer={<Button onClick={() => setDetail(null)}>Close</Button>}>
        {detailReport && (
          <div className="report-detail">
            <div className="detail-facts">
              <li><Icon name="user" size={15} /> <strong>Tourist:</strong> {detailReport.touristName}</li>
              <li><Icon name="map-pin" size={15} /> <strong>Location:</strong> {detailReport.location}</li>
              <li><Icon name="message-square" size={15} /> <strong>Description:</strong> {detailReport.description}</li>
              <li><Icon name="wallet" size={15} /> <strong>Expected:</strong> ₹{detailReport.expectedPrice}</li>
              <li><Icon name="wallet" size={15} /> <strong>Charged:</strong> ₹{detailReport.chargedPrice}</li>
              <li style={{ alignItems: 'flex-start' }}>
                <Icon name="image" size={15} style={{ marginTop: '3px' }} />
                <div style={{ flex: 1 }}>
                  <strong>Evidence:</strong>{' '}
                  {!hasEvidence(detailReport.evidence) ? (
                    <span style={{ color: 'var(--text-muted)' }}>No photo attached</span>
                  ) : isImageEvidence(detailReport.evidence) ? (
                    <div style={{ marginTop: '8px' }}>
                      <div
                        style={{
                          display: 'inline-block',
                          cursor: 'pointer',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: '1px solid var(--border-color, #e5e7eb)',
                          background: 'var(--bg-card, #ffffff)'
                        }}
                        onClick={() => setEnlargedImage(detailReport.evidence)}
                        title="Click to view full image"
                      >
                        <img
                          src={detailReport.evidence}
                          alt="Evidence preview"
                          style={{
                            display: 'block',
                            maxWidth: '240px',
                            maxHeight: '160px',
                            objectFit: 'cover'
                          }}
                        />
                      </div>
                      <div style={{ marginTop: '6px' }}>
                        <Button
                          size="xs"
                          variant="outline"
                          icon="eye"
                          onClick={() => setEnlargedImage(detailReport.evidence)}
                        >
                          Enlarge Image
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <span>{detailReport.evidence}</span>
                  )}
                </div>
              </li>
              <li><Icon name="info" size={15} /> <strong>Status:</strong> <StatusBadge status={detailReport.status}>{detailReport.status}</StatusBadge></li>
            </div>
            {detailReport.status === 'Under Review' && (
              <div className="report-detail-actions">
                <Button variant="ghost" onClick={() => setStatus(detailReport.id, 'Rejected')}>Reject</Button>
                <Button icon="check" onClick={() => setStatus(detailReport.id, 'Resolved')}>Resolve</Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Evidence Image Lightbox Modal */}
      <Modal
        open={!!enlargedImage}
        onClose={() => setEnlargedImage(null)}
        title="Evidence Image"
        size="lg"
        footer={<Button onClick={() => setEnlargedImage(null)}>Close</Button>}
      >
        {enlargedImage && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <img
              src={enlargedImage}
              alt="Enlarged Evidence"
              style={{
                maxWidth: '100%',
                maxHeight: '70vh',
                objectFit: 'contain',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #e5e7eb)'
              }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
