import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'

describe('Modal', () => {
    it('closes when backdrop is clicked', () => {
        const onClose = vi.fn()

        render(
            <Modal isOpen onClose={onClose} title="测试弹窗">
                <div>内容</div>
            </Modal>
        )

        const dialog = document.querySelector('dialog.modal')
        expect(dialog).toBeInTheDocument()
        if (!dialog) {
            throw new Error('Dialog should exist')
        }

        fireEvent.click(dialog)
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('closes when close button is clicked', () => {
        const onClose = vi.fn()

        render(
            <Modal isOpen onClose={onClose} title="测试弹窗">
                <div>内容</div>
            </Modal>
        )

        fireEvent.click(screen.getByLabelText('关闭'))
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('renders title and content', () => {
        render(
            <Modal isOpen onClose={() => { }} title="记录喂食">
                <div>喵喵</div>
            </Modal>
        )

        expect(screen.getByText('记录喂食')).toBeInTheDocument()
        expect(screen.getByText('喵喵')).toBeInTheDocument()
    })
})
