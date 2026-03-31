import React, { useEffect, useId, useRef, useState, useCallback } from 'react'
import './Modal.css'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title?: string
    children: React.ReactNode
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
    const dialogRef = useRef<HTMLDialogElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)
    const titleId = useId()
    const [dragY, setDragY] = useState(0)
    const dragStartRef = useRef<number | null>(null)

    useEffect(() => {
        const dialog = dialogRef.current
        if (!dialog) return

        if (isOpen && !dialog.open) {
            dialog.showModal()
            setDragY(0)
        } else if (!isOpen && dialog.open) {
            dialog.close()
        }
    }, [isOpen])

    const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
        if (e.target === dialogRef.current) {
            onClose()
        }
    }

    const handleCancel = (e: React.SyntheticEvent<HTMLDialogElement, Event>) => {
        e.preventDefault()
        onClose()
    }

    const onDragStart = useCallback((clientY: number) => {
        const content = contentRef.current
        if (content && content.scrollTop > 0) return
        dragStartRef.current = clientY
    }, [])

    const onDragMove = useCallback((clientY: number) => {
        if (dragStartRef.current === null) return
        const delta = clientY - dragStartRef.current
        if (delta > 0) {
            setDragY(delta)
        }
    }, [])

    const onDragEnd = useCallback(() => {
        if (dragY > 100) {
            onClose()
        }
        setDragY(0)
        dragStartRef.current = null
    }, [dragY, onClose])

    return (
        <dialog
            ref={dialogRef}
            className="modal"
            onClick={handleDialogClick}
            onCancel={handleCancel}
            aria-labelledby={title ? titleId : undefined}
        >
            <div
                ref={contentRef}
                className="modal-content fade-in"
                style={dragY > 0 ? { transform: `translateY(${dragY}px)`, opacity: Math.max(0.5, 1 - dragY / 300) } : undefined}
                onTouchStart={(e) => onDragStart(e.touches[0].clientY)}
                onTouchMove={(e) => onDragMove(e.touches[0].clientY)}
                onTouchEnd={onDragEnd}
            >
                <div className="modal-drag-handle" aria-hidden="true" />
                {title && (
                    <div className="modal-header">
                        <h2 className="modal-title" id={titleId}>{title}</h2>
                        <button className="modal-close" onClick={onClose} aria-label="关闭">
                            ✕
                        </button>
                    </div>
                )}
                <div className="modal-body">{children}</div>
            </div>
        </dialog>
    )
}
