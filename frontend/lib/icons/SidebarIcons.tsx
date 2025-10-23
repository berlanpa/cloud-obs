'use client';

import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

export function LiveIcon({ className = '', size = 20 }: IconProps) {
  return (
    <div className={className} style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
        <circle cx="12" cy="12" r="6" fill="currentColor"/>
      </svg>
    </div>
  );
}

export function ViewIcon({ className = '', size = 20 }: IconProps) {
  return (
    <div className={className} style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" fill="none"/>
        <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="2" fill="none"/>
      </svg>
    </div>
  );
}

export function PersonalizeIcon({ className = '', size = 20 }: IconProps) {
  return (
    <div className={className} style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="4" y1="21" x2="4" y2="14" stroke="currentColor" strokeWidth="2"/>
        <line x1="4" y1="10" x2="4" y2="3" stroke="currentColor" strokeWidth="2"/>
        <line x1="12" y1="21" x2="12" y2="12" stroke="currentColor" strokeWidth="2"/>
        <line x1="12" y1="8" x2="12" y2="3" stroke="currentColor" strokeWidth="2"/>
        <line x1="20" y1="21" x2="20" y2="16" stroke="currentColor" strokeWidth="2"/>
        <line x1="20" y1="12" x2="20" y2="3" stroke="currentColor" strokeWidth="2"/>
        <line x1="1" y1="14" x2="7" y2="14" stroke="currentColor" strokeWidth="2"/>
        <line x1="9" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="2"/>
        <line x1="17" y1="16" x2="23" y2="16" stroke="currentColor" strokeWidth="2"/>
      </svg>
    </div>
  );
}

export function DashboardIcon({ className = '', size = 20 }: IconProps) {
  return (
    <div className={className} style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2" fill="none"/>
        <rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2" fill="none"/>
        <rect x="14" y="14" width="7" height="7" stroke="currentColor" strokeWidth="2" fill="none"/>
        <rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="2" fill="none"/>
      </svg>
    </div>
  );
}

export function ExternalStreamIcon({ className = '', size = 20 }: IconProps) {
  return (
    <div className={className} style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="2" fill="none"/>
        <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none"/>
        <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none"/>
        <circle cx="12" cy="7" r="2" fill="currentColor"/>
      </svg>
    </div>
  );
}
