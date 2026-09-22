import React from 'react';
import Icon from './Icon.jsx';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  block,
  loading,
  disabled,
  className = '',
  type = 'button',
  ...rest
}) {
  const classes = [
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    block ? 'btn-block' : '',
    loading ? 'btn-loading' : '',
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} disabled={disabled || loading} {...rest}>
      {loading && <span className="spinner" aria-hidden="true" />}
      {icon && !loading && <Icon name={icon} size={16} />}
      {children && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={16} />}
    </button>
  );
}
