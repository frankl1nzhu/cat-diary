import { useRef, useState, useCallback } from 'react'
import './SwipeableRow.css'

interface SwipeableRowProps {
    onDelete: () => void
    children: React.ReactNode
}

export function SwipeableRow({ onDelete, children }: SwipeableRowProps) {
    const startXRef = useRef<number | null>(null)
    const startOffsetRef = useRef(0)
    const [offsetX, setOffsetX] = useState(0)
    const [open, setOpen] = useState(false)

    const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        startXRef.current = e.touches[0].clientX
        startOffsetRef.current = offsetX
    }

    const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        if (startXRef.current === null) return
        const currentX = e.touches[0].clientX
        const delta = currentX - startXRef.current
        const next = Math.max(Math.min(startOffsetRef.current + delta, 0), -88)
        setOffsetX(next)
    }

    const onTouchEnd = () => {
        const shouldOpen = offsetX < -44
        setOpen(shouldOpen)
        setOffsetX(shouldOpen ? -88 : 0)
        startXRef.current = null
    }

    const close = () => {
        setOpen(false)
        setOffsetX(0)
    }

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault()
            onDelete()
        }
    }, [onDelete])

    return (
        <div className="swipe-row" onClick={open ? close : undefined} onKeyDown={handleKeyDown} tabIndex={0} role="group" aria-label="可滑动删除的行">
            <button className="swipe-delete" onClick={onDelete} aria-label="删除">
                删除
            </button>
            <div
                className="swipe-content"
                style={{ transform: `translateX(${offsetX}px)` }}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                {children}
                <button className="swipe-kb-delete" onClick={onDelete} aria-label="删除此记录">
                    🗑
                </button>
            </div>
        </div>
    )
}
