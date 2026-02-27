import { useRef, useState } from 'react'
import './SwipeableRow.css'

interface SwipeableRowProps {
    onDelete: () => void
    children: React.ReactNode
}

export function SwipeableRow({ onDelete, children }: SwipeableRowProps) {
    const startXRef = useRef<number | null>(null)
    const [offsetX, setOffsetX] = useState(0)
    const [open, setOpen] = useState(false)

    const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        startXRef.current = e.touches[0].clientX
    }

    const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        if (startXRef.current === null) return
        const currentX = e.touches[0].clientX
        const delta = currentX - startXRef.current
        if (delta < 0) {
            setOffsetX(Math.max(delta, -88))
        }
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

    return (
        <div className="swipe-row" onClick={open ? close : undefined}>
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
            </div>
        </div>
    )
}
