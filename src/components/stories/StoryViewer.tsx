import React, { useState, useEffect, useRef } from 'react';
import { X, Heart, Flame, Smile, Frown, ThumbsUp } from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';
import { getInitials } from '../../utils/helpers';
import { socket } from '../../socket/client';

export const StoryViewer: React.FC<{ stories: any[], onClose: () => void, onUpdate: () => void }> = ({ stories, onClose, onUpdate }) => {
  const { user } = useChatStore();
  
  // Start from first unviewed story, or 0
  const initialIndex = stories.findIndex(s => !s.views?.some((v: any) => v.userId === user?.id));
  const [currentIndex, setCurrentIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  const DURATION = 5000; // 5 seconds per image story
  const currentStory = stories[currentIndex];
  const isVideo = currentStory?.mediaType === 'video';
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Mark as viewed
    if (currentStory && currentStory.userId !== user?.id) {
      const hasViewed = currentStory.views?.some((v: any) => v.userId === user?.id);
      if (!hasViewed) {
        fetch(`/api/stories/${currentStory.id}/view`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('nexa_token')}` }
        }).then(() => {
          socket.emit('story:viewed', { storyId: currentStory.id, authorId: currentStory.userId });
        }).catch(console.error);
        
        // optimistic update
        if (!currentStory.views) currentStory.views = [];
        currentStory.views.push({ userId: user?.id });
      }
    }
  }, [currentIndex, currentStory, user]);

  useEffect(() => {
    setProgress(0);
    let interval: any;
    
    if (!isPaused && !isVideo) {
      const startTime = Date.now();
      interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const newProgress = (elapsed / DURATION) * 100;
        if (newProgress >= 100) {
          handleNext();
        } else {
          setProgress(newProgress);
        }
      }, 50);
    }
    
    return () => clearInterval(interval);
  }, [currentIndex, isPaused, isVideo]);

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onUpdate();
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else {
      setProgress(0);
    }
  };

  const handleVideoTimeUpdate = () => {
    if (videoRef.current && !isPaused) {
      const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(p);
    }
  };

  const handleVideoEnded = () => {
    handleNext();
  };

  const handleReact = async (emoji: string) => {
    if (currentStory.userId === user?.id) return;
    try {
      await fetch(`/api/stories/${currentStory.id}/react`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('nexa_token')}` 
        },
        body: JSON.stringify({ emoji })
      });
      socket.emit('story:react', { storyId: currentStory.id, authorId: currentStory.userId, reaction: emoji });
      // animate reaction
    } catch (e) {
      console.error(e);
    }
  };

  if (!currentStory) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: '#000', zIndex: 9999,
      display: 'flex', flexDirection: 'column'
    }}>
      {/* Progress Bars */}
      <div style={{ display: 'flex', gap: '4px', padding: '16px 16px 8px 16px', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
        {stories.map((s, i) => (
          <div key={s.id} style={{ height: '2px', background: 'rgba(255,255,255,0.3)', flex: 1, borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ 
              height: '100%', 
              background: '#fff', 
              width: i < currentIndex ? '100%' : i === currentIndex ? `${progress}%` : '0%',
              transition: 'width 50ms linear'
            }} />
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 16px', position: 'absolute', top: 10, left: 0, right: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: currentStory.user.avatarColor || '#ccc', backgroundImage: currentStory.user.avatarImage ? `url(${currentStory.user.avatarImage})` : 'none', backgroundSize: 'cover', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
            {!currentStory.user.avatarImage && getInitials(currentStory.user.nickname)}
          </div>
          <div style={{ color: '#fff', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 500, fontSize: '14px' }}>{currentStory.user.firstName || currentStory.user.nickname}</span>
            <span style={{ fontSize: '12px', opacity: 0.8 }}>
              {new Date(currentStory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          {currentStory.userId === user?.id && (
            <div style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
              <span>👁️ {currentStory.views?.length || 0}</span>
            </div>
          )}
          <button onClick={() => { onUpdate(); onClose(); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Media Container */}
      <div 
        style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onPointerDown={() => setIsPaused(true)}
        onPointerUp={() => setIsPaused(false)}
        onPointerLeave={() => setIsPaused(false)}
      >
        {isVideo ? (
          <video 
            ref={videoRef}
            src={currentStory.mediaUrl} 
            autoPlay 
            playsInline
            onTimeUpdate={handleVideoTimeUpdate}
            onEnded={handleVideoEnded}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <img src={currentStory.mediaUrl} alt="Story" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
        )}

        {/* Tap zones */}
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '30%', zIndex: 5 }} onClick={handlePrev} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '70%', zIndex: 5 }} onClick={handleNext} />
        
        {/* Caption */}
        {currentStory.caption && (
          <div style={{ position: 'absolute', bottom: '80px', left: 0, right: 0, padding: '24px', zIndex: 10, background: 'linear-gradient(transparent, rgba(0,0,0,0.8))', color: '#fff', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '16px', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{currentStory.caption}</p>
          </div>
        )}
      </div>

      {/* Reactions / Reply */}
      {currentStory.userId !== user?.id && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px', zIndex: 10, display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="Reply..." 
            style={{ flex: 1, padding: '12px 16px', borderRadius: '24px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', outline: 'none' }}
            onFocus={() => setIsPaused(true)}
            onBlur={() => setIsPaused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                const text = e.currentTarget.value.trim();
                socket.emit('message:send', { 
                  toUserId: currentStory.userId, 
                  text: `Реакция на историю: ${text}` 
                });
                
                // Show success or simply close
                e.currentTarget.value = '';
                setIsPaused(false);
                handleNext(); // Skip story after reply
              }
            }}
          />
          <div style={{ display: 'flex', gap: '8px', fontSize: '24px', position: 'relative', zIndex: 20 }}>
            {['❤️', '🔥', '😂', '😮', '👍'].map(emoji => (
              <button 
                key={emoji}
                onClick={(e) => { e.stopPropagation(); handleReact(emoji); }}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', transition: 'transform 0.2s' }}
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
