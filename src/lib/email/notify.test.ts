import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const sendMock = vi.fn()
vi.mock('./client', () => ({
  getEmailClient: () => ({ emails: { send: sendMock } }),
}))

import { notifyByEmail } from './notify'

describe('notifyByEmail — sandbox de arranque', () => {
  beforeEach(() => {
    sendMock.mockReset()
    sendMock.mockResolvedValue({ error: null })
    process.env.EMAIL_FROM = '1to1 <notificaciones@b-drive.com.mx>'
  })
  afterEach(() => {
    delete process.env.EMAIL_SANDBOX_TO
    delete process.env.EMAIL_FROM
  })

  it('sin EMAIL_SANDBOX_TO envía al destinatario real con el asunto original', async () => {
    const res = await notifyByEmail({ to: ['persona@b-drive.com.mx'], subject: 'Hola', html: '<p>x</p>' })
    expect(res.sent).toBe(true)
    const call = sendMock.mock.calls[0][0]
    expect(call.to).toEqual(['persona@b-drive.com.mx'])
    expect(call.subject).toBe('Hola')
  })

  it('con EMAIL_SANDBOX_TO redirige TODO al sandbox y anota el destinatario original', async () => {
    process.env.EMAIL_SANDBOX_TO = 'acalderonm@b-drive.com.mx'
    const res = await notifyByEmail({
      to: ['lider1@b-drive.com.mx', 'lider2@b-drive.com.mx'],
      subject: 'Cadencia vencida',
      html: '<p>x</p>',
    })
    expect(res.sent).toBe(true)
    const call = sendMock.mock.calls[0][0]
    expect(call.to).toEqual(['acalderonm@b-drive.com.mx'])
    expect(call.subject).toBe('[SANDBOX → lider1@b-drive.com.mx, lider2@b-drive.com.mx] Cadencia vencida')
  })

  it('sin EMAIL_FROM se salta el envío', async () => {
    delete process.env.EMAIL_FROM
    const res = await notifyByEmail({ to: ['a@b-drive.com.mx'], subject: 's', html: 'h' })
    expect(res).toEqual({ sent: false, skipped: true })
    expect(sendMock).not.toHaveBeenCalled()
  })
})
