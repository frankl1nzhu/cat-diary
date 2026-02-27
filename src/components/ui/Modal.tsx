import React, { useEffect, useId, useRef } from 'react'
import './Modal.css'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title?: string
    children: React.ReactNode
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
    const dialogRef = useRef<HTMLDialogElement>(null)
    const titleId = useId()

    useEffect(() => {
        const dialog = dialogRef.current
        if (!dialog) return

        if (isOpen && !dialog.open) {
            dialog.showModal()
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

    return (
        <dialog
            ref={dialogRef}
            className="modal"
            onClick={handleDialogClick}
            onCancel={handleCancel}
            aria-labelledby={title ? titleId : undefined}
        >
            <div className="modal-content fade-in">
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
