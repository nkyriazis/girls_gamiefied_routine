import React from 'react';
import { type IconValue } from '../types';

interface SmartIconProps {
  value: IconValue;
  className?: string;
  style?: React.CSSProperties;
}

export const SmartIcon: React.FC<SmartIconProps> = ({ value, className, style }) => {
  // 1. Handle Object format
  if (typeof value === 'object' && value !== null) {
    if (value.type === 'emoji') {
      return <span className={className} style={style}>{value.value}</span>;
    }
    if (value.type === 'image') {
      return <img src={value.src} alt="icon" className={className} style={{ ...style, objectFit: 'contain' }} />;
    }
    if (value.type === 'vector') {
      return (
        <div 
          className={className} 
          style={style}
          dangerouslySetInnerHTML={{ __html: value.content }} 
        />
      );
    }
  }

  // 2. Handle String format (Auto-detect)
  if (typeof value === 'string') {
    // Check if it's an SVG string
    if (value.trim().startsWith('<svg')) {
      return (
        <div 
          className={className} 
          style={style}
          dangerouslySetInnerHTML={{ __html: value }} 
        />
      );
    }
    
    // Check if it's a URL (starts with http, /, or data:)
    if (value.startsWith('http') || value.startsWith('/') || value.startsWith('data:')) {
      return <img src={value} alt="icon" className={className} style={{ ...style, objectFit: 'contain' }} />;
    }

    // Default to Emoji/Text
    return <span className={className} style={style}>{value}</span>;
  }

  return null;
};
