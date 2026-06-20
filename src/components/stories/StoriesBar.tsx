import React, { useState, useEffect } from 'react';
import { PlusCircle } from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';
import { getInitials } from '../../utils/helpers';
import { StoryCreator } from './StoryCreator';
import { StoryViewer } from './StoryViewer';
import { socket } from '../../socket/client';
import { resolveApiUrl } from '../../utils/api';
import { withAuthHeader } from '../../utils/session';

export const StoriesBar: React.FC = () => {
  const { user } = useChatStore();
  const [activeStories, setActiveStories] = useState<any[]>([]);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [viewerStories, setViewerStories] = useState<any[] | null>(null);

  useEffect(() => {
    fetchStories();

    const handleViewUpdate = ({ storyId, viewerId }: any) => {
      setActiveStories((stories) => stories.map((story) => {
        if (story.id !== storyId) return story;
        const views = Array.isArray(story.views) ? story.views : [];
        if (views.some((view: any) => view.userId === viewerId)) return story;
        return { ...story, views: [...views, { userId: viewerId }] };
      }));
    };

    socket.on('story:new', fetchStories);
    socket.on('story:viewUpdate', handleViewUpdate);
    socket.on('story:reactionAdded', fetchStories);
    return () => {
      socket.off('story:new', fetchStories);
      socket.off('story:viewUpdate', handleViewUpdate);
      socket.off('story:reactionAdded', fetchStories);
    };
  }, []);

  const fetchStories = async () => {
    try {
      const res = await fetch(resolveApiUrl("/api/stories/active"), {
        headers: withAuthHeader()
      });
      if (res.status === 401) {
        setActiveStories([]);
        window.dispatchEvent(new CustomEvent("nexa:session-expired"));
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setActiveStories(data);
      }
    } catch (e) {
      console.warn("fetch stories", e);
    }
  };

  if (!user) return null;

  // Group stories by userId
  const groupedStories = activeStories.reduce((acc: any, story: any) => {
    if (!user) return acc;
    if (!acc[story.userId]) {
      acc[story.userId] = {
        user: story.user,
        stories: [],
        hasUnviewed: false
      };
    }
    acc[story.userId].stories.push(story);
    // Check if viewed by current user
    const hasViewed = story.views?.some((v: any) => v.userId === user.id);
    if (!hasViewed && story.userId !== user.id) { // Own stories don't count as unviewed
      acc[story.userId].hasUnviewed = true;
    }
    return acc;
  }, {});

  const usersWithStories = Object.values(groupedStories);
  // Sort: own first, unviewed first, viewed last
  usersWithStories.sort((a: any, b: any) => {
    if (a.user.id === user.id) return -1;
    if (b.user.id === user.id) return 1;
    if (a.hasUnviewed && !b.hasUnviewed) return -1;
    if (!a.hasUnviewed && b.hasUnviewed) return 1;
    return 0;
  });

  const myGroup: any = usersWithStories.find((g: any) => g.user.id === user.id);
  const othersGroups: any[] = usersWithStories.filter((g: any) => g.user.id !== user.id);

  const openViewer = (group: any) => {
    setViewerStories([...group.stories].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
  };

  return (
    <>
      <div className="stories-bar" style={{ display: 'flex', overflowX: 'auto', padding: '0 1rem 1rem 1rem', gap: '12px', scrollbarWidth: 'none' }}>
        
        {/* My Story Button / My Active Story */}
        <div className="story-item" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', minWidth: '60px' }}>
          <div 
            onClick={() => myGroup ? openViewer(myGroup) : setIsCreatorOpen(true)}
            style={{ 
              position: 'relative', 
              width: '56px', 
              height: '56px', 
              borderRadius: '50%', 
              backgroundColor: myGroup?.user?.avatarColor || 'var(--bg-secondary)', 
              backgroundImage: myGroup?.user?.avatarImage ? `url(${myGroup.user.avatarImage})` : 'none', 
              backgroundSize: 'cover', 
              backgroundPosition: 'center', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              border: myGroup ? '2px solid var(--border-color)' : 'none' 
            }}
          >
            {(!myGroup || !myGroup.user.avatarImage) && <span style={{color: '#fff'}}>{getInitials(user.nickname || '')}</span>}
            <div 
              onClick={(e) => { e.stopPropagation(); setIsCreatorOpen(true); }}
              style={{
                position: 'absolute',
                bottom: '-2px',
                right: '-2px',
                background: 'var(--bg-primary)',
                borderRadius: '50%',
                padding: '2px',
                display: 'flex',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}
            >
              <PlusCircle size={16} style={{ color: 'var(--accent-color)' }} />
            </div>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Моя история</span>
        </div>

        {/* Other Users Stories */}
        {othersGroups.map((group: any) => (
          <div key={group.user.id} className="story-item" onClick={() => openViewer(group)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', minWidth: '60px' }}>
            <div style={{ 
              width: '56px', 
              height: '56px', 
              borderRadius: '50%', 
              backgroundColor: group.user?.avatarColor || '#9b59b6', 
              backgroundImage: group.user?.avatarImage ? `url(${group.user.avatarImage})` : 'none', 
              backgroundSize: 'cover', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: '#fff', 
              border: group.hasUnviewed ? '2px solid var(--accent-color)' : '2px solid var(--border-color)',
              padding: '2px',
              backgroundClip: 'content-box'
            }}>
              {!group.user?.avatarImage && getInitials(group.user?.nickname || 'U')}
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60px' }}>
              {group.user?.firstName ? group.user.firstName : group.user?.nickname}
            </span>
          </div>
        ))}
      </div>

      {isCreatorOpen && (
        <StoryCreator onClose={() => setIsCreatorOpen(false)} onCreated={() => { setIsCreatorOpen(false); fetchStories(); }} />
      )}

      {viewerStories && (
        <StoryViewer stories={viewerStories} onClose={() => setViewerStories(null)} onUpdate={fetchStories} />
      )}
    </>
  );
};
