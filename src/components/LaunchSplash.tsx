import React, { useEffect, useState } from 'react';
import { NexaLogo } from '../shared/ui/NexaLogo';

let launchSplashShown = false;

export const LaunchSplash: React.FC = () => {
  const [visible, setVisible] = useState(!launchSplashShown);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (launchSplashShown) return;
    launchSplashShown = true;
    const leaveTimer = window.setTimeout(() => setLeaving(true), 1500);
    const hideTimer = window.setTimeout(() => setVisible(false), 2050);
    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`launch-splash ${leaving ? 'launch-splash-leaving' : ''}`}>
      <div className="launch-splash-bg" />
      <div className="launch-splash-content">
        <NexaLogo size={140} showText={false} />
        <div className="launch-splash-title">NEXA</div>
        <div className="launch-splash-line">
          <span />
        </div>
      </div>
    </div>
  );
};
