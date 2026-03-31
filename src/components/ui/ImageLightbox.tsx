import { useState, useRef, useEffect, useCallback } from 'react'
import './ImageLightbox.css'

interface ImageLightboxProps {
    src: string | null
    alt?: string
    onClose: () => void
}

export function ImageLightbox({ src, alt = '图片预览', onClose }: ImageLightboxProps) {
    const [scale, setScale] = useState(1)
    const [offset, setOffset] = useState({ x: 0, y: 0 })
    const [dragging, setDragging] = useState(false)
    const pinchStartDistanceRef = useRef<number | null>(null)
    const lastTapAtRef = useRef(0)
    const dragStartRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null)
    const lightboxRef = useRef<HTMLDivElement>(null)

    const resetView = useCallback(() => {
        setScale(1)
        setOffset({ x: 0, y: 0 })
        setDragging(false)
        pinchStartDistanceRef.current = null
        dragStartRef.current = null
    }, [])

    const updateScale = useCallback((nextScale: number) => {
        const clamped = Math.min(3, Math.max(1, nextScale))
        setScale(clamped)
        if (clamped === 1) {
            setOffset({ x: 0, y: 0 })
        }
    }, [])

    const close = useCallback(() => {
        resetView()
        onClose()
    }, [onClose, resetView])

    // Keyboard & focus trap
    useEffect(() => {
        if (!src) return
        lightboxRef.current?.focus()

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault()
                close()
            }
            if (e.key === 'Tab') {
                const focusable = lightboxRef.current?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
                if (!focusable || focusable.length === 0) return
                const first = focusable[0]
                const last = focusable[focusable.length - 1]
                const active = document.activeElement
                if (e.shiftKey && active === first) {
                    e.preventDefault()
                    last.focus()
                } else if (!e.shiftKey && active === last) {
                    e.preventDefault()
                    first.focus()
                }
            }
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [src, close])

    if (!src) return null

    const getPinchDistance = (touches: React.TouchList) => {
        const dx = touches[0].clientX - touches[1].clientX
        const dy = touches[0].clientY - touches[1].clientY
        return Math.hypot(dx, dy)
    }

    const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        if (e.touches.length === 1) {
            const now = Date.now()
            if (now - lastTapAtRef.current < 260) {
                updateScale(scale > 1 ? 1 : 2)
            }
            lastTapAtRef.current = now
        }
        if (e.touches.length === 2) {
            pinchStartDistanceRef.current = getPinchDistance(e.touches)
        }
    }

    const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        if (e.touches.length !== 2 || pinchStartDistanceRef.current === null) return
        const distance = getPinchDistance(e.touches)
        const ratio = distance / pinchStartDistanceRef.current
        setScale((prev) => Math.min(3, Math.max(1, prev * ratio)))
        pinchStartDistanceRef.current = distance
    }

    const onTouchEnd = () => {
        pinchStartDistanceRef.current = null
    }

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (scale <= 1) return
        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            originX: offset.x,
            originY: offset.y,
        }
        setDragging(true)
    }

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragStartRef.current || scale <= 1) return
        setOffset({
            x: dragStartRef.current.originX + (e.clientX - dragStartRef.current.x),
            y: dragStartRef.current.originY + (e.clientY - dragStartRef.current.y),
        })
    }

    const onPointerUp = () => {
        dragStartRef.current = null
        setDragging(false)
    }

    const onDoubleClick = () => {
        updateScale(scale > 1 ? 1 : 2)
    }

    return (
        <div
            className="lightbox-overlay"
            onClick={close}
            ref={lightboxRef}
            role="dialog"
            aria-modal="true"
            aria-label={alt}
            tabIndex={-1}
        >
            <div className="lightbox-toolbar" onClick={(e) => e.stopPropagation()}>
                <button className="lightbox-btn" onClick={() => updateScale(scale - 0.2)}>-</button>
                <span className="lightbox-scale">{Math.round(scale * 100)}%</span>
                <button className="lightbox-btn" onClick={() => updateScale(scale + 0.2)}>+</button>
                <button className="lightbox-btn" onClick={() => updateScale(1)}>重置</button>
                <button className="lightbox-btn" onClick={close}>关闭</button>
            </div>
            <div
                className="lightbox-stage"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onDoubleClick={onDoubleClick}
            >
                <img
                    src={src}
                    alt={alt}
                    className="lightbox-image"
                    style={{
                        transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                        cursor: scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'zoom-in',
                    }}
                />
            </div>
        </div>
    )
}
