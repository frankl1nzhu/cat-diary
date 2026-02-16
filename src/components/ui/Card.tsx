import React from 'react'
import './Card.css'

interface CardProps {
    children: React.ReactNode
    variant?: 'default' | 'glass' | 'accent'
    className?: string
    onClick?: () => void
    padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function Card({
    children,
    variant = 'default',
    className = '',
    onClick,
    padding = 'md',
}: CardProps) {
    const Component = onClick ? 'button' : 'div'
    return (
        <Component
            className={`card card-${variant} card-p-${padding} ${onClick ? 'card-interactive' : ''} ${className}`}
            onClick={onClick}
        >
            {children}
        </Component>
    )
}
