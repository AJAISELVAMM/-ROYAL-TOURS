import React from 'react';

export default function Logo({ size = 34, light = false, compact = false }) {
  return (
    <div className={`logo ${light ? 'logo-light' : ''}`}>
      <span className="logo-mark" style={{ width: size, height: size }}>
        <img
          src="/assets/royal-tours-logo.png"
          alt="Royal Tours"
          className="logo-mark-img"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 'inherit',
            display: 'block'
          }}
        />
      </span>
      {!compact && (
        <span className="logo-text">
          ROYAL <em>TOURS</em>
        </span>
      )}
    </div>
  );
}
