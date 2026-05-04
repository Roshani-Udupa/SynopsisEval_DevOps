import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Alert, Badge, Button, Input, Modal, Spinner } from '../../../src/components/ui'

describe('shared UI components', () => {
  it('renders input label, error, and hint states', () => {
    const { rerender } = render(<Input label="Email" error="Required" hint="Use your portal email" />)

    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Required')).toBeInTheDocument()
    expect(screen.queryByText('Use your portal email')).not.toBeInTheDocument()

    rerender(<Input label="Email" hint="Use your portal email" />)
    expect(screen.getByText('Use your portal email')).toBeInTheDocument()
  })

  it('renders button loading and disabled states', () => {
    render(
      <Button loading disabled>
        Save
      </Button>
    )

    const button = screen.getByRole('button', { name: /save/i })
    expect(button).toBeDisabled()
  })

  it('renders badge and alert variants', () => {
    render(
      <>
        <Badge status="approved" />
        <Alert type="warning">Check the data</Alert>
      </>
    )

    expect(screen.getByText('Approved')).toBeInTheDocument()
    expect(screen.getByText('Check the data')).toBeInTheDocument()
  })

  it('renders spinner and modal close behavior', () => {
    const onClose = vi.fn()

    render(
      <>
        <Spinner size="lg" />
        <Modal open title="Confirm action" onClose={onClose}>
          <p>Modal body</p>
        </Modal>
      </>
    )

    expect(screen.getByText('Confirm action')).toBeInTheDocument()
    fireEvent.click(screen.getByText('✕'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})