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
    const previousFocusRef = useRef<HTMLElement | null>(null)
    const titleId = useId()
    const [dragY, setDragY] = useState(0)
    const dragStartRef = useRef<number | null>(null)

    useEffect(() => {
        const dialog = dialogRef.current
        if (!dialog) return

        if (isOpen && !dialog.open) {
            // Save currently focused element to restore on close
            previousFocusRef.current = document.activeElement as HTMLElement | null
            dialog.showModal()

            // Focus first interactive element inside the modal
            requestAnimationFrame(() => {
                const content = contentRef.current
                if (!content) return
                const focusable = content.querySelector<HTMLElement>(
                    'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
                )
                if (focusable) {
                    focusable.focus()
                } else {
                    // Fallback: focus the close button or content
                    const closeBtn = content.querySelector<HTMLElement>('.modal-close')
                    closeBtn?.focus()
                }
            })
        } else if (!isOpen && dialog.open) {
            dialog.close()
            // Restore focus to previous element
            previousFocusRef.current?.focus()
            previousFocusRef.current = null
        }
    }, [isOpen])

    // Focus trap: keep Tab cycling within the modal
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key !== 'Tab') return
        const content = contentRef.current
        if (!content) return

        const focusableElements = content.querySelectorAll<HTMLElement>(
            'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"]), a[href]'
        )
        if (focusableElements.length === 0) return

        const first = focusableElements[0]
        const last = focusableElements[focusableElements.length - 1]
        const active = document.activeElement

        if (e.shiftKey && active === first) {
            e.preventDefault()
            last.focus()
        } else if (!e.shiftKey && active === last) {
            e.preventDefault()
            first.focus()
        }
    }, [])

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
            onKeyDown={handleKeyDown}
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
