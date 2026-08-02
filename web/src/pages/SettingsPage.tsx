import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { downloadBackup, restoreBackup, type BackupPayload } from '../api/backup'
import { ApiClientError } from '../api/client'
import { t } from '../i18n/t'

export function SettingsPage() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const exportMut = useMutation({
    mutationFn: downloadBackup,
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const day = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `savetowin-backup-${day}.json`
      a.click()
      URL.revokeObjectURL(url)
      setMessage(t('settings.exportOk'))
      setError(null)
    },
    onError: () => setError(t('common.error')),
  })

  const restoreMut = useMutation({
    mutationFn: restoreBackup,
    onSuccess: async (res) => {
      await qc.invalidateQueries()
      setMessage(
        `${t('settings.restoreOk')} ${res.transactions} ${t('settings.tx')}, ${res.budgets} ${t('settings.budgets')}.`,
      )
      setError(null)
    },
    onError: (err) => {
      setError(
        err instanceof ApiClientError
          ? err.body?.error.message ?? t('settings.restoreFail')
          : t('settings.restoreFail'),
      )
    },
  })

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setMessage(null)
    try {
      const text = await file.text()
      const json = JSON.parse(text) as BackupPayload
      if (json.version !== 1) {
        setError(t('settings.badVersion'))
        return
      }
      if (!window.confirm(t('settings.restoreConfirm'))) return
      restoreMut.mutate(json)
    } catch {
      setError(t('settings.badFile'))
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[26px] font-extrabold tracking-tight">{t('settings.title')}</h1>
        <p className="text-[13px] text-ink-2">{t('settings.hint')}</p>
      </div>

      <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-raised">
        <h2 className="text-[15px] font-bold">{t('settings.backup')}</h2>
        <p className="text-[13px] leading-relaxed text-ink-2">{t('settings.backupHint')}</p>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            disabled={exportMut.isPending}
            onClick={() => exportMut.mutate()}
            className="inline-flex h-tap items-center gap-2 rounded-pill bg-accent px-4 text-sm font-bold text-accent-fg shadow-accent focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-50"
          >
            <Download className="size-4" strokeWidth={2.2} />
            {t('settings.export')}
          </button>
          <button
            type="button"
            disabled={restoreMut.isPending}
            onClick={() => fileRef.current?.click()}
            className="inline-flex h-tap items-center gap-2 rounded-pill border border-line bg-surface px-4 text-sm font-semibold text-ink-2 focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-50"
          >
            <Upload className="size-4" strokeWidth={2.2} />
            {t('settings.restore')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </div>
        {message && (
          <p className="text-[13px] font-medium text-savings" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="text-[13px] font-medium text-danger" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  )
}
