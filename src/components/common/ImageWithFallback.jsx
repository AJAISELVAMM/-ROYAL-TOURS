// =============================================================================
// ImageWithFallback.jsx — Graceful image loader with category fallback.
// Never displays a broken image box.
// =============================================================================

import React, { useState, useEffect } from 'react';
import { getFallbackImageForPoi } from '../../utils/imageUtils.js';

export default function ImageWithFallback({
  src,
  alt = 'Tourist Place',
  category,
  type,
  className = '',
  style = {},
  iconFallback = null
}) {
  const fallbackSrc = getFallbackImageForPoi(category, type, alt);
  const [imgSrc, setImgSrc] = useState(src || fallbackSrc);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setImgSrc(src || fallbackSrc);
    setHasError(false);
  }, [src, fallbackSrc]);

  function handleError() {
    if (imgSrc !== fallbackSrc) {
      setImgSrc(fallbackSrc);
    } else {
      setHasError(true);
    }
  }

  if (hasError && iconFallback) {
    return iconFallback;
  }

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      style={{ objectFit: 'cover', width: '100%', height: '100%', ...style }}
      onError={handleError}
      loading="lazy"
    />
  );
}
