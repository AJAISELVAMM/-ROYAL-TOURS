import React, { useState, useEffect } from 'react';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Icon from '../../components/common/Icon.jsx';
import Tabs from '../../components/common/Tabs.jsx';
import Modal from '../../components/common/Modal.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import * as catalog from '../../services/catalogService.js';

const COLLECTIONS = [
  { key: 'places', label: 'Places', icon: 'map-pin' },
  { key: 'hotels', label: 'Hotels', icon: 'bed' },
  { key: 'restaurants', label: 'Restaurants', icon: 'utensils' },
  { key: 'theatres', label: 'Theatres', icon: 'film' },
  { key: 'shopping', label: 'Shopping', icon: 'bag' },
  { key: 'transport', label: 'Transport', icon: 'bus' }
];

const EMPTY_FORMS = {
  places: { name: '', category: '', rating: '', distanceKm: '', description: '', location: '' },
  hotels: { name: '', rating: '', pricePerNight: '', distanceKm: '', facilities: '', location: '' },
  restaurants: { name: '', rating: '', priceRange: '', cuisine: '', distanceKm: '', veg: false, location: '' },
  theatres: { name: '', rating: '', distanceKm: '', currentMovies: '', location: '' },
  shopping: { name: '', category: '', rating: '', distanceKm: '', description: '', location: '' },
  transport: { mode: '', price: '', duration: '', label: '' }
};

export default function AdminTravelData() {
  const { push } = useToast();
  const [tab, setTab] = useState('places');
  const [modal, setModal] = useState(null); // { mode: 'add'|'edit', id }
  const [form, setForm] = useState(EMPTY_FORMS.places);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [items, setItems] = useState([]);

  useEffect(() => {
    let active = true;
    catalog.list(tab).then((d) => active && setItems(d)).catch(() => {});
    return () => {
      active = false;
    };
  }, [tab]);

  function openAdd() {
    setForm({ ...EMPTY_FORMS[tab] });
    setModal({ mode: 'add' });
  }

  function openEdit(item) {
    setForm({ ...item });
    setModal({ mode: 'edit', id: item.id });
  }

  async function save() {
    const record = { ...form };
    if (tab === 'hotels') {
      record.facilities = Array.isArray(record.facilities) ? record.facilities.join(', ') : record.facilities;
      record.pricePerNight = Number(record.pricePerNight) || 0;
      record.rating = Number(record.rating) || 0;
      record.distanceKm = Number(record.distanceKm) || 0;
    }
    if (tab === 'restaurants' || tab === 'places' || tab === 'shopping') {
      record.rating = Number(record.rating) || 0;
      record.distanceKm = Number(record.distanceKm) || 0;
    }
    if (tab === 'theatres') {
      delete record.currentMovies;
      delete record.showTimings;
      record.rating = Number(record.rating) || 0;
      record.distanceKm = Number(record.distanceKm) || 0;
    }
    if (tab === 'transport') {
      record.price = Number(record.price) || 0;
    }

    try {
      if (modal.mode === 'add') {
        await catalog.addItem(tab, record);
        push(`${tab.slice(0, -1)} added`, 'success');
      } else {
        await catalog.updateItem(tab, modal.id, record);
        push('Changes saved', 'success');
      }
      setModal(null);
      catalog.list(tab).then(setItems).catch(() => {});
    } catch (e) {
      push(e?.message || 'Could not save changes.', 'error');
    }
  }

  async function doRemove() {
    try {
      await catalog.removeItem(tab, confirmRemove);
      push('Item removed', 'success');
      setConfirmRemove(null);
      setItems((prev) => prev.filter((i) => i.id !== confirmRemove));
    } catch (e) {
      push(e?.message || 'Could not remove item.', 'error');
    }
  }

  async function verify(item) {
    try {
      await catalog.verifyItem(tab, item.id, !item.verified);
      push(item.verified ? 'Unverified' : 'Marked as verified', 'success');
      catalog.list(tab).then(setItems).catch(() => {});
    } catch (e) {
      push(e?.message || 'Could not update verification.', 'error');
    }
  }

  const columns = {
    places: ['Name', 'Category', 'Rating', 'Distance', 'Status'],
    hotels: ['Name', 'Rating', 'Price/Night', 'Distance', 'Status'],
    restaurants: ['Name', 'Cuisine', 'Rating', 'Price', 'Status'],
    theatres: ['Name', 'Rating', 'Distance', 'Movies', 'Status'],
    shopping: ['Name', 'Category', 'Rating', 'Distance', 'Status'],
    transport: ['Mode', 'Price', 'Duration', 'Label', 'Status']
  };

  function cellValue(item, col) {
    if (col === 'Mode') return item.mode;
    if (col === 'Name') return item.name || item.mode;
    if (col === 'Category') return item.category;
    if (col === 'Cuisine') return item.cuisine;
    if (col === 'Rating') return item.rating;
    if (col === 'Distance') return item.distanceKm != null ? `${item.distanceKm} km` : '—';
    if (col === 'Price') {
      if (tab === 'transport') return item.price === 0 ? 'Free' : `₹${item.price}`;
      return item.priceRange;
    }
    if (col === 'Price/Night') return item.pricePerNight ? `₹${item.pricePerNight}` : '—';
    if (col === 'Duration') return item.duration;
    if (col === 'Label') return item.label;
    if (col === 'Movies') return (item.currentMovies || []).length;
    return '—';
  }

  return (
    <div className="page-inner">
      <h1 className="page-title">Travel Data</h1>
      <p className="page-sub">Manage the catalog of places, hotels and services.</p>

      <div className="page-head-row">
        <Tabs tabs={COLLECTIONS.map((c) => ({ key: c.key, label: c.label }))} active={tab} onChange={setTab} />
        <Button icon="plus" onClick={openAdd}>Add {tab.slice(0, -1)}</Button>
      </div>

      <Card padded={false}>
        {items.length === 0 ? (
          <EmptyState title={`No ${tab} yet`} message={`Add your first ${tab.slice(0, -1)} entry.`} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {columns[tab].map((c) => <th key={c}>{c}</th>)}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    {columns[tab].map((c) => (
                      <td key={c}>
                        {c === 'Name' ? (
                          <div className="table-user">
                            <strong>{cellValue(item, c)}</strong>
                          </div>
                        ) : c === 'Status' ? (
                          <StatusBadge status={item.verified ? 'verified' : 'pending'}>
                            {item.verified ? 'Verified' : 'Unverified'}
                          </StatusBadge>
                        ) : (
                          cellValue(item, c)
                        )}
                      </td>
                    ))}
                    <td>
                      <div className="table-actions">
                        <button className="icon-btn" title="Edit" onClick={() => openEdit(item)}><Icon name="edit" size={16} /></button>
                        <button className="icon-btn" title={item.verified ? 'Unverify' : 'Verify'} onClick={() => verify(item)}>
                          <Icon name="shield-check" size={16} />
                        </button>
                        <button className="icon-btn icon-danger" title="Remove" onClick={() => setConfirmRemove(item.id)}><Icon name="trash" size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'add' ? `Add ${tab.slice(0, -1)}` : `Edit ${tab.slice(0, -1)}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button onClick={save} icon="check">Save</Button>
          </>
        }
      >
        <div className="modal-form">
          {Object.keys(EMPTY_FORMS[tab]).map((key) => {
            if (key === 'veg') {
              return (
                <label className="field" key={key}>
                  <span className="field-label">Vegetarian</span>
                  <select value={form.veg ? 'yes' : 'no'} onChange={(e) => setForm((f) => ({ ...f, veg: e.target.value === 'yes' }))}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </label>
              );
            }
            return (
              <label className="field" key={key}>
                <span className="field-label">{key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}</span>
                {key === 'description' || key === 'facilities' || key === 'currentMovies' ? (
                  <textarea rows={2} value={form[key] || ''} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
                ) : (
                  <input type="text" value={form[key] || ''} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
                )}
              </label>
            );
          })}
        </div>
      </Modal>

      <Modal
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        title="Remove item"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRemove(null)}>Cancel</Button>
            <Button variant="danger" onClick={doRemove} icon="trash">Remove</Button>
          </>
        }
      >
        <p>Are you sure you want to remove this item? This action cannot be undone.</p>
      </Modal>
    </div>
  );
}
