import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';
import { getInitials } from '../../utils/helpers';
import { socket } from '../../socket/client';
import { resolveApiUrl } from '../../utils/api';
import { withAuthHeader } from '../../utils/session';

export const StoryViewer: React.FC<{ stories: any[]; onClose: () => void; onUpdate: () => void }> = ({
  stories,
  onClose,
  onUpdate,
}) => {
  const { user } = useChatStore();
  const orderedStories = useMemo(
    () => [...stories].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [stories],
  );
  const initialIndex = orderedStories.findIndex((story) => !story.views?.some((view: any) => view.userId === user?.id));
  const [currentIndex, setCurrentIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<string>>(new Set());
  const videoRef = useRef<HTMLVideoElement>(null);

  const durationMs = 5000;
  const currentStory = orderedStories[currentIndex];
  const isVideo = currentStory?.mediaType === 'video';
  const mediaSrc = currentStory?.mediaUrl ? resolveApiUrl(currentStory.mediaUrl) : '';

  useEffect(() => {
    setProgress(0);
    setMediaReady(false);
    setMediaFailed(false);
  }, [currentStory?.id]);

  useEffect(() => {
    if (!currentStory || currentStory.userId === user?.id || viewedStoryIds.has(currentStory.id)) return;
    const hasViewed = currentStory.views?.some((view: any) => view.userId === user?.id);
    if (hasViewed) return;

    setViewedStoryIds((prev) => new Set(prev).add(currentStory.id));
    fetch(resolveApiUrl(`/api/stories/${currentStory.id}/view`), {
      method: 'POST',
      headers: withAuthHeader(),
    })
      .then(() => {
        socket.emit('story:viewed', { storyId: currentStory.id, authorId: currentStory.userId });
      })
      .catch(console.error);
  }, [currentStory, user?.id, viewedStoryIds]);

  const closeViewer = () => {
    onUpdate();
    onClose();
  };

  const handleNext = () => {
    if (currentIndex < orderedStories.length - 1) {
      setCurrentIndex((index) => index + 1);
    } else {
      closeViewer();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((index) => index - 1);
    } else {
      setProgress(0);
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (!currentStory || isPaused || isVideo || !mediaReady || mediaFailed) return undefined;

    const startTime = Date.now();
    interval = setInterval(() => {
      const nextProgress = ((Date.now() - startTime) / durationMs) * 100;
      if (nextProgress >= 100) {
        handleNext();
      } else {
        setProgress(nextProgress);
      }
    }, 50);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentStory?.id, isPaused, isVideo, mediaReady, mediaFailed]);

  const handleVideoTimeUpdate = () => {
    const video = videoRef.current;
    if (video && !isPaused && Number.isFinite(video.duration) && video.duration > 0) {
      setProgress((video.currentTime / video.duration) * 100);
    }
  };

  const handleReact = async (emoji: string) => {
    if (!currentStory || currentStory.userId === user?.id) return;
    try {
      await fetch(resolveApiUrl(`/api/stories/${currentStory.id}/react`), {
        method: 'POST',
        headers: withAuthHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ emoji }),
      });
      socket.emit('story:react', { storyId: currentStory.id, authorId: currentStory.userId, reaction: emoji });
    } catch (error) {
      console.error(error);
    }
  };

  if (!currentStory) return null;

  return (
    <div className="story-viewer-overlay">
      <div className="story-viewer-shell">
        <div className="story-progress-row">
          {orderedStories.map((story, index) => (
            <div key={story.id} className="story-progress-track">
              <div
                className="story-progress-fill"
                style={{ width: index < currentIndex ? '100%' : index === currentIndex ? `${progress}%` : '0%' }}
              />
            </div>
          ))}
        </div>

        <div className="story-viewer-header">
          <div className="story-viewer-author">
            <div
              className="story-viewer-avatar"
              style={{
                backgroundColor: currentStory.user.avatarColor || '#64748b',
                backgroundImage: currentStory.user.avatarImage ? `url(${currentStory.user.avatarImage})` : 'none',
              }}
            >
              {!currentStory.user.avatarImage && getInitials(currentStory.user.nickname)}
            </div>
            <div className="story-viewer-author-text">
              <span>{currentStory.user.firstName || currentStory.user.nickname}</span>
              <small>{new Date(currentStory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
            </div>
          </div>
          <div className="story-viewer-actions">
            {currentStory.userId === user?.id && (
              <span className="story-viewer-views">Просмотры: {currentStory.views?.length || 0}</span>
            )}
            <button type="button" onClick={closeViewer} className="story-viewer-close" aria-label="Close story">
              <X size={24} />
            </button>
          </div>
        </div>

        <div
          className="story-media-stage"
          onPointerDown={() => setIsPaused(true)}
          onPointerUp={() => setIsPaused(false)}
          onPointerLeave={() => setIsPaused(false)}
        >
          {isVideo ? (
            <video
              ref={videoRef}
              src={mediaSrc}
              autoPlay
              playsInline
              preload="metadata"
              onLoadedMetadata={() => setMediaReady(true)}
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={handleNext}
              onError={() => setMediaFailed(true)}
              className="story-media"
            />
          ) : (
            <img
              src={mediaSrc}
              alt="Story"
              loading="eager"
              decoding="async"
              onLoad={() => setMediaReady(true)}
              onError={() => setMediaFailed(true)}
              className="story-media"
            />
          )}

          {mediaFailed && (
            <div className="story-media-error">Не удалось загрузить историю</div>
          )}

          <button type="button" className="story-tap-zone story-tap-prev" onClick={handlePrev} aria-label="Previous story" />
          <button type="button" className="story-tap-zone story-tap-next" onClick={handleNext} aria-label="Next story" />

          {currentStory.caption && (
            <div className="story-caption">
              <p>{currentStory.caption}</p>
            </div>
          )}
        </div>

        {currentStory.userId !== user?.id && (
          <div className="story-reply-bar">
            <input
              type="text"
              placeholder="Ответить..."
              className="story-reply-input"
              onFocus={() => setIsPaused(true)}
              onBlur={() => setIsPaused(false)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && event.currentTarget.value.trim()) {
                  const text = event.currentTarget.value.trim();
                  socket.emit('message:send', {
                    to: currentStory.userId,
                    text: `Реакция на историю: ${text}`,
                  });

                  event.currentTarget.value = '';
                  setIsPaused(false);
                  handleNext();
                }
              }}
            />
            <div className="story-reaction-list">
              {['❤️', '🔥', '😂', '😮', '👍'].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleReact(emoji);
                  }}
                  className="story-reaction-button"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
