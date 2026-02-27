import React from 'react'
import './Card.css'

interface CardProps extends React.HTMLAttributes<HTMLDivElement | HTMLButtonElement> {
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
    ...rest
}: CardProps) {
    const Component = onClick ? 'button' : 'div'
    return (
        <Component
            className={`card card-${variant} card-p-${padding} ${onClick ? 'card-interactive' : ''} ${className}`}
            onClick={onClick}
            {...rest}
        >
            {children}
        </Component>
    )
}
