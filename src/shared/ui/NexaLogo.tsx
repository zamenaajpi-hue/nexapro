import React from 'react';

export const NexaLogo = ({ className = '', size = 52, showText = true, tagline = 'FAST • SECURE • INTELLIGENT' }: { className?: string; size?: number; showText?: boolean; tagline?: string }) => (
  <div className={`logo ${className}`} style={{ gap: size * 0.25, justifyContent: showText ? 'flex-start' : 'center' }}>
    <div className="logo-icon" style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '1px' }}>
      <img src="/logo.jpg" alt="Nexa Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} referrerPolicy="no-referrer" />
    </div>
    {showText && (
      <div className="brand">
        <h1 style={{ fontSize: `${size * 0.45}px`, letterSpacing: `${Math.round(size * 0.08)}px` }}>NEXA</h1>
        <small style={{ fontSize: `${size * 0.22}px`, letterSpacing: `${Math.round(size * 0.03)}px` }}>{tagline}</small>
      </div>
    )}
  </div>
);
