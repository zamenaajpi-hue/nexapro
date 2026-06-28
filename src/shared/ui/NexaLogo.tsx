import React from 'react';
import nexaLogoUrl from '../../assets/nexa-logo.svg';

type NexaLogoProps = {
  className?: string;
  size?: number;
  showText?: boolean;
  tagline?: string;
  animated?: boolean;
};

export const NexaLogo = ({
  className = '',
  size = 52,
  showText = true,
  tagline = 'FAST • SECURE • INTELLIGENT',
  animated = false,
}: NexaLogoProps) => (
  <div
    className={`logo nexa-logo ${animated ? 'nexa-logo-animated' : ''} ${className}`}
    style={{ gap: size * 0.24, justifyContent: showText ? 'flex-start' : 'center' }}
  >
    <div
      className="logo-icon nexa-logo-mark"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28) }}
    >
      <img src={nexaLogoUrl} alt="" aria-hidden="true" />
    </div>
    {showText && (
      <div className="brand nexa-logo-wordmark">
        <h1 style={{ fontSize: `${size * 0.45}px`, letterSpacing: `${Math.max(1, Math.round(size * 0.07))}px` }}>NEXA</h1>
        <small style={{ fontSize: `${size * 0.19}px`, letterSpacing: `${Math.max(1, Math.round(size * 0.025))}px` }}>{tagline}</small>
      </div>
    )}
  </div>
);
