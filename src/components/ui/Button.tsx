import React from 'react'
import './Button.css'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg' | 'xl'
    fullWidth?: boolean
    icon?: React.ReactNode
}

export function Button({
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    icon,
    children,
    className = '',
    ...props
}: ButtonProps) {
    return (
        <button
            className={`btn btn-${variant} btn-${size} ${fullWidth ? 'btn-full' : ''} ${className}`}
            {...props}
        >
            {icon && <span className="btn-icon">{icon}</span>}
            {children}
        </button>
    )
}
