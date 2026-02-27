import React from 'react'
import './Card.css'

type CardBaseProps = {
    children: React.ReactNode
    variant?: 'default' | 'glass' | 'accent'
    className?: string
    padding?: 'none' | 'sm' | 'md' | 'lg'
}

type CardDivProps = CardBaseProps & React.HTMLAttributes<HTMLDivElement> & { onClick?: undefined }
type CardButtonProps = CardBaseProps & React.ButtonHTMLAttributes<HTMLButtonElement> & { onClick: () => void }

type CardProps = CardDivProps | CardButtonProps

export function Card({
    children,
    variant = 'default',
    className = '',
    onClick,
    padding = 'md',
    ...rest
}: CardProps) {
    const classes = `card card-${variant} card-p-${padding} ${onClick ? 'card-interactive' : ''} ${className}`

    if (onClick) {
        return (
            <button
                type="button"
                className={classes}
                onClick={onClick}
                {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
            >
                {children}
            </button>
        )
    }

    return (
        <div
            className={classes}
            {...(rest as React.HTMLAttributes<HTMLDivElement>)}
        >
            {children}
        </div>
    )
}
