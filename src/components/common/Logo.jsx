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
            objectFit: 'contain',
            borderRadius: 'inherit',
            display: 'block'
          }}
        />
      </span>
      {!compact && (
        <span className="logo-text">
          <span className="logo-text-royal">ROYAL</span>
          <span className="logo-text-tours">TOURS</span>
        </span>
      )}
    </div>
  );
}

export { Logo as RoyalToursLogo };
