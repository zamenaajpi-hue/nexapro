import React, { useState, useRef } from 'react';
import { X, Image as ImageIcon, Send, Type, Video } from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';
import { socket } from '../../socket/client';
import { notifyApp } from '../../utils/notifications';
import { resolveApiUrl } from '../../utils/api';

export const StoryCreator: React.FC<{ onClose: () => void, onCreated: () => void }> = ({ onClose, onCreated }) => {
  const { user } = useChatStore();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [privacy, setPrivacy] = useState('PUBLIC');
  const [expiresIn, setExpiresIn] = useState('24');
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      const url = URL.createObjectURL(selected);
      setPreview(url);
    }
  };

  const currentType = file?.type.startsWith('video/') ? 'video' : 'image';

  const handleSubmit = async () => {
    if (!file) return;
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('nexa_token');
      // Upload media
      const upRes = await fetch(resolveApiUrl('/api/upload'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (!upRes.ok) throw new Error('Upload failed');
      const { url } = await upRes.json();

      // Create story
      const createRes = await fetch(resolveApiUrl('/api/stories'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          mediaUrl: url,
          mediaType: currentType,
          caption,
          privacy,
          expiresInHours: parseInt(expiresIn, 10),
        })
      });

      if (createRes.ok) {
        const newStory = await createRes.json();
        socket.emit('story:created', newStory);
        onCreated();
      }
    } catch (e) {
      console.error(e);
      notifyApp('Не удалось опубликовать историю');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 1000,
      display: 'flex', flexDirection: 'column'
    }}>
      <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
          <X size={24} />
        </button>
        <span style={{ color: '#fff', fontWeight: 500 }}>Create Story</span>
        <div style={{ width: 24 }} />
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {!preview ? (
          <div style={{ textAlign: 'center', color: '#ccc' }}>
            <button onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: '2px dashed #666', padding: '2rem', borderRadius: '1rem', color: '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <ImageIcon size={48} />
              <span>Select Photo or Video</span>
            </button>
            <input type="file" accept="image/*,video/*" hidden ref={fileInputRef} onChange={handleFileChange} />
          </div>
        ) : (
          <div className="story-creator-preview-layout">
            {currentType === 'video' ? (
              <video src={preview} controls autoPlay loop className="story-creator-preview-media" />
            ) : (
              <img src={preview} alt="Preview" className="story-creator-preview-media" />
            )}

            <div style={{ width: '100%', maxWidth: '400px', padding: '1rem', marginTop: '1rem', display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
              <input 
                type="text" 
                placeholder="Add a caption..." 
                maxLength={2000}
                value={caption}
                onChange={e => setCaption(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '2rem', border: 'none', backgroundColor: '#333', color: '#fff', outline: 'none' }}
              />

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <select 
                  value={privacy} 
                  onChange={e => setPrivacy(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem', borderRadius: '0.5rem', backgroundColor: '#222', color: '#fff', border: 'none' }}
                >
                  <option value="PUBLIC">Public</option>
                  <option value="CONTACTS">Contacts</option>
                  <option value="CLOSE_FRIENDS">Close Friends</option>
                </select>

                <select 
                  value={expiresIn} 
                  onChange={e => setExpiresIn(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem', borderRadius: '0.5rem', backgroundColor: '#222', color: '#fff', border: 'none' }}
                >
                  <option value="6">6 Hours</option>
                  <option value="12">12 Hours</option>
                  <option value="24">24 Hours</option>
                  <option value="48">48 Hours</option>
                </select>
              </div>

              <button 
                onClick={handleSubmit}
                disabled={isUploading}
                style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '2rem', backgroundColor: 'var(--accent-color)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {isUploading ? 'Publishing...' : <><Send size={18} /> Publish Story</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
