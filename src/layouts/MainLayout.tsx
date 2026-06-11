import React from 'react';
import { Sidebar } from '../components/sidebar/Sidebar';
import { Settings } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';

interface MainLayoutProps {
  children: React.ReactNode;
  setShowAdminPanel: (show: boolean) => void;
  setShowGroupModal: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setShowMenuDrawer: (show: boolean) => void;
  setShowCallsModal: (show: boolean) => void;
  setShowContactsModal: (show: boolean) => void;
  showContactsEntry?: boolean;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ 
  children, 
  setShowAdminPanel, 
  setShowGroupModal, 
  setShowSettings,
  setShowMenuDrawer,
  setShowCallsModal,
  setShowContactsModal,
  showContactsEntry = true
}) => {
  const { activeChat, setActiveChat } = useChatStore();

  return (
    <div className="screen active">
      <Sidebar 
        setShowAdminPanel={setShowAdminPanel} 
        setShowGroupModal={setShowGroupModal} 
        setShowSettings={setShowSettings} 
        setShowMenuDrawer={setShowMenuDrawer}
        setShowCallsModal={setShowCallsModal}
        isMobileActive={!activeChat}
      />

      {!activeChat && (
        <div className="bottom-nav">
           <button className="bottom-nav-item active" onClick={() => setActiveChat(null)}>
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
             Чаты
           </button>
           <button className="bottom-nav-item" onClick={() => setShowCallsModal(true)}>
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
             Звонки
           </button>
           {showContactsEntry && (
             <button className="bottom-nav-item" onClick={() => setShowContactsModal(true)}>
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
               Контакты
             </button>
           )}
           <button className="bottom-nav-item" onClick={() => setShowSettings(true)}>
             <Settings size={24} />
             Настройки
           </button>
        </div>
      )}

      {children}
    </div>
  );
};
