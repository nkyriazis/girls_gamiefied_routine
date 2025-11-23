import React from 'react';
import { type IconValue } from '@shared/types';

interface SmartIconProps {
    value: IconValue;
    className?: string;
    style?: React.CSSProperties;
    size?: number; // Size in pixels (default: 48)
}

export const SmartIcon: React.FC<SmartIconProps> = ({ value, className, style, size = 48 }) => {
    // Base style with consistent sizing and circular cropping
    const baseStyle: React.CSSProperties = {
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        overflow: 'hidden',
        ...style
    };

    // 1. Handle Object format
    if (typeof value === 'object' && value !== null) {
        if (value.type === 'emoji') {
            return (
                <span className={className} style={{ ...baseStyle, fontSize: size * 0.75 }}>
                    {value.value}
                </span>
            );
        }
        if (value.type === 'image') {
            // Auto-resolve uploaded filenames to /uploads/ path
            const src = value.value?.startsWith('http') || value.value?.startsWith('/') || value.value?.startsWith('data:')
                ? value.value
                : `/uploads/${value.value}`;
            return (
                <img
                    src={src}
                    alt="icon"
                    className={className}
                    style={{ ...baseStyle, objectFit: 'contain' }}
                />
            );
        }
        if (value.type === 'vector') {
            return (
                <div
                    className={className}
                    style={baseStyle}
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
                    style={baseStyle}
                    dangerouslySetInnerHTML={{ __html: value }}
                />
            );
        }

        // Check if it's a URL (starts with http, /, or data:)
        if (value.startsWith('http') || value.startsWith('/') || value.startsWith('data:')) {
            return (
                <img
                    src={value}
                    alt="icon"
                    className={className}
                    style={{ ...baseStyle, objectFit: 'contain' }}
                />
            );
        }

        // Default to Emoji/Text
        return (
            <span className={className} style={{ ...baseStyle, fontSize: size * 0.75 }}>
                {value}
            </span>
        );
    }

    return null;
};
