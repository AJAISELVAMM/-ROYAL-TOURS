import React from 'react';

export default function Card({ children, className = '', padded = true, onClick, hover, ...rest }) {
  const classes = [
    'card',
    padded ? 'card-padded' : '',
    hover ? 'card-hover' : '',
    onClick ? 'card-clickable' : '',
    className
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} {...rest}>
      {children}
    </div>
  );
}
