import React, { useEffect, useRef } from 'react'
import './Modal.css'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title?: string
    children: React.ReactNode
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
    const dialogRef = useRef<HTMLDialogElement>(null)

    useEffect(() => {
        const dialog = dialogRef.current
        if (!dialog) return

        if (isOpen) {
            dialog.showModal()
        } else {
            dialog.close()
        }
    }, [isOpen])

    return (
        <dialog ref={dialogRef} className="modal" onClose={onClose}>
            <div className="modal-content fade-in">
                {title && (
                    <div className="modal-header">
                        <h2 className="modal-title">{title}</h2>
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
