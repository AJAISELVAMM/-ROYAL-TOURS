// =============================================================================
// LocationAutocomplete.jsx — Live Geocoding Autocomplete with Nominatim/Photon.
// Debounces queries, shows coordinates & address, supports keyboard navigation.
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';
import Icon from './Icon.jsx';
import { api } from '../../services/api.js';

export default function LocationAutocomplete({
  value = '',
  onChange,
  onSelect,
  placeholder = 'Search places, attractions, hotels…',
  className = '',
  onKeyDown
}) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const wrapperRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const abortCtrlRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortCtrlRef.current) abortCtrlRef.current.abort();
    };
  }, []);

  function handleInputChange(text) {
    setQuery(text);
    if (onChange) onChange(text);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (abortCtrlRef.current) abortCtrlRef.current.abort();

    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      setLoading(true);
      const abortCtrl = new AbortController();
      abortCtrlRef.current = abortCtrl;

      try {
        const results = await api.get(`/geocoding/search?q=${encodeURIComponent(trimmed)}&limit=5`, {
          signal: abortCtrl.signal
        });
        const items = Array.isArray(results) ? results : (results.items || []);
        setSuggestions(items);
        setIsOpen(items.length > 0);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setSuggestions([]);
        }
      } finally {
        setLoading(false);
      }
    }, 350);
  }

  function handleSelectSuggestion(item) {
    const name = item.name || item.label;
    setQuery(name);
    setIsOpen(false);
    if (onChange) onChange(name);
    if (onSelect) {
      onSelect({
        name,
        address: item.address || item.label,
        label: item.label,
        latitude: item.latitude,
        longitude: item.longitude
      });
    }
  }

  async function handleKeyDownInternal(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      setIsOpen(false);
      if (suggestions.length > 0 && isOpen) {
        handleSelectSuggestion(suggestions[0]);
      } else if (query.trim().length >= 2) {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        if (abortCtrlRef.current) abortCtrlRef.current.abort();
        setLoading(true);
        try {
          const results = await api.get(`/geocoding/search?q=${encodeURIComponent(query.trim())}&limit=1`);
          const items = Array.isArray(results) ? results : (results?.items || []);
          if (items.length > 0) {
            handleSelectSuggestion(items[0]);
          }
        } catch {
          // ignore
        } finally {
          setLoading(false);
        }
      }
      if (onKeyDown) onKeyDown(e);
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }

  return (
    <div className={`location-autocomplete-wrap ${className}`} ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <div className="searchbar" style={{ width: '100%' }}>
        <Icon name="search" size={16} />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDownInternal}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="off"
        />
        {loading && (
          <span style={{ fontSize: '11px', color: 'var(--purple)', marginRight: '8px' }}>
            <Icon name="loader" size={14} className="spin" />
          </span>
        )}
      </div>

      {/* Autocomplete Dropdown List */}
      {isOpen && suggestions.length > 0 && (
        <div
          className="autocomplete-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'var(--bg-card, #ffffff)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.15))',
            border: '1px solid var(--border)',
            zIndex: 1000,
            overflow: 'hidden',
            maxHeight: '280px',
            overflowY: 'auto'
          }}
        >
          {suggestions.map((item, idx) => (
            <div
              key={idx}
              className="autocomplete-item"
              onClick={() => handleSelectSuggestion(item)}
              style={{
                padding: '10px 14px',
                borderBottom: idx < suggestions.length - 1 ? '1px solid var(--border-soft, #f1f5f9)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--purple-50, #f5f3ff)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'var(--purple-50, #f5f3ff)',
                  color: 'var(--purple)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Icon name="map-pin" size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name || item.label}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.address || item.label}
                </div>
              </div>
              {item.latitude != null && item.longitude != null && (
                <span style={{ fontSize: '10.5px', color: 'var(--text-faint)', fontFamily: 'monospace', flexShrink: 0 }}>
                  {item.latitude.toFixed(2)}, {item.longitude.toFixed(2)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
