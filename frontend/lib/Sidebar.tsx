'use client';

import React, { useState } from 'react';
import styles from '../styles/Sidebar.module.css';
import { LiveIcon, ViewIcon, PersonalizeIcon, DashboardIcon, ExternalStreamIcon } from './icons/SidebarIcons';
import { ExternalStreamModal } from './ExternalStreamModal';
import { useRoomContext } from '@livekit/components-react';
import { Room } from 'livekit-client';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
}

interface SidebarProps {
  className?: string;
  isCollapsed?: boolean;
  onToggle?: () => void;
  room?: Room | null;
  onTabChange?: (tabId: string) => void;
  activeTab?: string;
}

const defaultItems: SidebarItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon size={16} />, isActive: true },
  { id: 'live', label: 'Live', icon: <LiveIcon size={16} /> },
  { id: 'view', label: 'View', icon: <ViewIcon size={16} /> },
  { id: 'external-stream', label: 'Add Stream', icon: <ExternalStreamIcon size={16} /> },
];

export function Sidebar({ className = '', isCollapsed = false, onToggle, room: propRoom, onTabChange, activeTab }: SidebarProps) {
  const [items, setItems] = useState<SidebarItem[]>(defaultItems);
  const [activeItem, setActiveItem] = useState(activeTab || 'dashboard');
  const [isExternalStreamModalOpen, setIsExternalStreamModalOpen] = useState(false);
  
  // Try to get room from context, fallback to prop
  let room: Room | null = null;
  try {
    room = useRoomContext();
  } catch (error) {
    // Room context not available, use prop
    room = propRoom || null;
  }

  const handleItemClick = (itemId: string) => {
    if (itemId === 'external-stream') {
      setIsExternalStreamModalOpen(true);
      return;
    }
    
    setActiveItem(itemId);
    if (onTabChange) {
      onTabChange(itemId);
    }
    const item = items.find(i => i.id === itemId);
    if (item?.onClick) {
      item.onClick();
    }
  };

  const toggleSidebar = () => {
    if (onToggle) {
      onToggle();
    }
  };

  const openSidebar = () => {
    if (isCollapsed && onToggle) {
      onToggle();
    }
  };

  return (
    <div className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''} ${className}`}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.logo} onClick={openSidebar} style={{ cursor: isCollapsed ? 'pointer' : 'default' }}>
          <img src="/logo.svg" alt="Geome" className={styles.logoImage} />
        </div>
        {!isCollapsed && (
          <button 
            className={styles.toggleButton}
            onClick={toggleSidebar}
            aria-label="Collapse sidebar"
          >
            ←
          </button>
        )}
      </div>

      {/* Navigation Items */}
      <nav className={styles.navigation}>
        {items.map((item) => (
          <button
            key={item.id}
            className={`${styles.navItem} ${activeItem === item.id ? styles.active : ''}`}
            onClick={() => handleItemClick(item.id)}
            title={isCollapsed ? item.label : undefined}
          >
            <span className={styles.icon}>{item.icon}</span>
            {!isCollapsed && <span className={styles.label}>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* User Profile Section */}
      <div className={styles.userSection}>
        <div className={styles.userProfile}>
          <div className={styles.avatar}>
            <img 
              src="https://via.placeholder.com/32x32/4F46E5/FFFFFF?text=U" 
              alt="User" 
              className={styles.avatarImage}
            />
          </div>
          {!isCollapsed && (
            <div className={styles.userInfo}>
              <span className={styles.userName}>User</span>
              <span className={styles.userStatus}>Online</span>
            </div>
          )}
        </div>
      </div>

      <ExternalStreamModal
        isOpen={isExternalStreamModalOpen}
        onClose={() => setIsExternalStreamModalOpen(false)}
        room={room}
      />
    </div>
  );
}

export default Sidebar;
