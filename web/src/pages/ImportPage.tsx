import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Euro,
  FileSpreadsheet,
  FileUp,
  FolderOpen,
  Landmark,
  Pencil,
  Type,
  WandSparkles,
  X,
} from 'lucide-react'
import { useCallback, useRef, useState, type DragEvent } from 'react'
import { listAccounts } from '../api/transactions'
import { firstValues, normalizeHeader, uniquifyRoles } from '../import/guess'
import { bumpMappingUse, loadSavedMappings, saveMapping } from '../import/mappingsStore'
import { parseBankCsv, type ParseOverrides } from '../import/parseBankCsv'
import type {
  ColumnRole,
  CsvDelimiter,
  CsvEncoding,
  DateFormat,
  DecimalStyle,
  ParsedCsv,
  SavedMapping,
} from '../import/types'
import { t } from '../i18n/t'

type Step = 'upload' | 'map'

const ROLES: ColumnRole[] = ['date', 'description', 'amount', 'note', 'ignore']

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function delimiterLabel(d: CsvDelimiter): string {
  if (d === ';') return ';'
  if (d === '\t') return 'TAB'
  return ','
}

function roleLabel(role: ColumnRole): string {
  return t(`import.role.${role}`)
}

function RoleIcon({ role }: { role: ColumnRole }) {
  if (role === 'date') return <Calendar className="size-[15px] text-ink-2" strokeWidth={2.2} />
  if (role === 'description') return <Type className="size-[15px] text-ink-2" strokeWidth={2.2} />
  if (role === 'amount') return <Euro className="size-[15px] text-accent" strokeWidth={2.2} />
  if (role === 'note') return <Pencil className="size-[15px] text-ink-2" strokeWidth={2.2} />
  return null
}

function applySavedRoles(parsed: ParsedCsv, saved: SavedMapping): ColumnRole[] {
  return uniquifyRoles(
    parsed.headers.map((h) => {
      const key = normalizeHeader(h)
      const byNorm = Object.entries(saved.rolesByHeader).find(
        ([k]) => normalizeHeader(k) === key,
      )
      return byNorm?.[1] ?? 'ignore'
    }),
  )
}

export function ImportPage() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedCsv | null>(null)
  const [roles, setRoles] = useState<ColumnRole[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [showDetection, setShowDetection] = useState(false)
  const [accountId, setAccountId] = useState('')
  const [remember, setRemember] = useState(true)
  const [mappingName, setMappingName] = useState('')
  const [savedList, setSavedList] = useState(() => loadSavedMappings())
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null)
  const [pendingSaved, setPendingSaved] = useState<SavedMapping | null>(null)
  const [mapReadyHint, setMapReadyHint] = useState(false)

  const accounts = useQuery({ queryKey: ['accounts'], queryFn: listAccounts })

  const runParse = useCallback(
    async (f: File, overrides?: ParseOverrides, saved?: SavedMapping) => {
      setBusy(true)
      setError(null)
      setMapReadyHint(false)
      try {
        const result = await parseBankCsv(f, overrides)
        setFile(f)
        setParsed(result)
        const nextRoles = saved ? applySavedRoles(result, saved) : result.roles
        setRoles(nextRoles)
        setAccountId((prev) => {
          if (prev) return prev
          const first = accounts.data?.items[0]
          return first ? String(first.id) : ''
        })
        if (saved) {
          setActiveSavedId(saved.id)
          setMappingName(saved.name)
          setRemember(true)
          bumpMappingUse(saved.id)
          setSavedList(loadSavedMappings())
          setPendingSaved(null)
        } else {
          setActiveSavedId(null)
          setMappingName((name) => name || f.name.replace(/\.csv$/i, ''))
        }
        setStep('map')
      } catch (e) {
        const code = e instanceof Error ? e.message : 'PARSE_FAILED'
        if (code === 'FILE_TOO_LARGE') setError(t('import.error.tooLarge'))
        else if (code === 'NOT_CSV') setError(t('import.error.notCsv'))
        else if (code === 'NO_DATA') setError(t('import.error.noData'))
        else setError(t('import.error.parse'))
      } finally {
        setBusy(false)
      }
    },
    [accounts.data],
  )

  function onPick(f: File | undefined | null) {
    if (!f) return
    if (pendingSaved) {
      void runParse(
        f,
        {
          delimiter: pendingSaved.delimiter,
          encoding: pendingSaved.encoding,
          skipRows: pendingSaved.skipRows,
        },
        pendingSaved,
      )
      return
    }
    void runParse(f)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    onPick(e.dataTransfer.files[0])
  }

  function setRole(index: number, role: ColumnRole) {
    setRoles((prev) => {
      const next = [...prev]
      next[index] = role
      return uniquifyRoles(next)
    })
    setMapReadyHint(false)
  }

  function cancelImport() {
    setStep('upload')
    setFile(null)
    setParsed(null)
    setRoles([])
    setError(null)
    setShowDetection(false)
    setMapReadyHint(false)
    setActiveSavedId(null)
    setPendingSaved(null)
  }

  function reparseWith(overrides: ParseOverrides) {
    if (!file || !parsed) return
    void runParse(file, {
      delimiter: overrides.delimiter ?? parsed.detection.delimiter,
      encoding: overrides.encoding ?? parsed.detection.encoding,
      skipRows: overrides.skipRows ?? parsed.detection.skipRows,
    })
  }

  function mappingValid(): boolean {
    return roles.includes('date') && roles.includes('amount')
  }

  function onContinuePreview() {
    if (!parsed || !mappingValid()) {
      setError(t('import.error.needDateAmount'))
      return
    }
    if (remember && mappingName.trim()) {
      const rolesByHeader: Record<string, ColumnRole> = {}
      parsed.headers.forEach((h, i) => {
        rolesByHeader[h] = roles[i] ?? 'ignore'
      })
      saveMapping({
        id: activeSavedId ?? undefined,
        name: mappingName.trim(),
        rolesByHeader,
        delimiter: parsed.detection.delimiter,
        encoding: parsed.detection.encoding,
        dateFormat: parsed.detection.dateFormat,
        decimal: parsed.detection.decimal,
        skipRows: parsed.detection.skipRows,
      })
      setSavedList(loadSavedMappings())
    }
    setError(null)
    setMapReadyHint(true)
  }

  if (step === 'map' && parsed) {
    return (
      <div className="flex flex-col gap-4 pb-8">
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={cancelImport}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-surface-2 px-4 text-[12.5px] font-semibold text-ink-2"
          >
            <X className="size-[15px]" strokeWidth={2.2} />
            {t('import.cancel')}
          </button>
        </div>

        <StepRail current={2} />

        <div className="rounded-[20px] border border-line bg-surface px-[22px] py-[18px]">
          <div className="flex flex-wrap items-center gap-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-accent-weak text-accent">
              <FileSpreadsheet className="size-[22px]" strokeWidth={2} />
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-[14.5px] font-bold">{parsed.fileName}</span>
              <span className="text-[11.5px] text-ink-3">
                {parsed.rows.length} {t('import.rows')} · {formatSize(parsed.fileSize)}
              </span>
            </div>
            <div className="hidden h-[38px] w-px bg-line sm:block" />
            <div className="flex flex-wrap gap-2">
              <DetectPill
                label={t('import.detect.separator')}
                value={delimiterLabel(parsed.detection.delimiter)}
              />
              <DetectPill label={t('import.detect.encoding')} value={parsed.detection.encoding} />
              <DetectPill
                label={t('import.detect.dates')}
                value={
                  parsed.detection.dateFormat === 'yyyy-mm-dd'
                    ? 'yyyy-mm-dd'
                    : parsed.detection.dateFormat === 'dd-mm-yyyy'
                      ? 'dd-mm-aaaa'
                      : 'dd/mm/aaaa'
                }
              />
              <DetectPill
                label={t('import.detect.decimal')}
                value={
                  parsed.detection.decimal === 'comma'
                    ? t('import.detect.decimalComma')
                    : t('import.detect.decimalPoint')
                }
              />
              <DetectPill
                label={t('import.detect.skipped')}
                value={String(parsed.detection.skipRows)}
              />
            </div>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setShowDetection((v) => !v)}
              className="whitespace-nowrap text-[12.5px] font-semibold text-accent"
            >
              {t('import.changeDetection')}
            </button>
          </div>

          {showDetection && (
            <div className="mt-4 grid gap-3 border-t border-line-grid pt-4 sm:grid-cols-2 lg:grid-cols-5">
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-2">
                {t('import.detect.separator')}
                <select
                  className="h-11 rounded-[12px] border border-line bg-bg px-3 font-mono text-[13px]"
                  value={parsed.detection.delimiter}
                  onChange={(e) =>
                    reparseWith({ delimiter: e.target.value as CsvDelimiter })
                  }
                >
                  <option value=";">;</option>
                  <option value=",">,</option>
                  <option value={'\t'}>TAB</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-2">
                {t('import.detect.encoding')}
                <select
                  className="h-11 rounded-[12px] border border-line bg-bg px-3 text-[13px]"
                  value={parsed.detection.encoding}
                  onChange={(e) =>
                    reparseWith({ encoding: e.target.value as CsvEncoding })
                  }
                >
                  <option value="UTF-8">UTF-8</option>
                  <option value="ISO-8859-1">ISO-8859-1</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-2">
                {t('import.detect.dates')}
                <select
                  className="h-11 rounded-[12px] border border-line bg-bg px-3 text-[13px]"
                  value={parsed.detection.dateFormat}
                  onChange={(e) => {
                    setParsed({
                      ...parsed,
                      detection: {
                        ...parsed.detection,
                        dateFormat: e.target.value as DateFormat,
                      },
                    })
                  }}
                >
                  <option value="dd/mm/yyyy">dd/mm/aaaa</option>
                  <option value="dd-mm-yyyy">dd-mm-aaaa</option>
                  <option value="yyyy-mm-dd">yyyy-mm-dd</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-2">
                {t('import.detect.decimal')}
                <select
                  className="h-11 rounded-[12px] border border-line bg-bg px-3 text-[13px]"
                  value={parsed.detection.decimal}
                  onChange={(e) => {
                    setParsed({
                      ...parsed,
                      detection: {
                        ...parsed.detection,
                        decimal: e.target.value as DecimalStyle,
                      },
                    })
                  }}
                >
                  <option value="comma">{t('import.detect.decimalComma')}</option>
                  <option value="point">{t('import.detect.decimalPoint')}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-2">
                {t('import.detect.skipped')}
                <input
                  type="number"
                  min={0}
                  max={40}
                  className="h-11 rounded-[12px] border border-line bg-bg px-3 font-mono text-[13px]"
                  value={parsed.detection.skipRows}
                  onChange={(e) => reparseWith({ skipRows: Number(e.target.value) || 0 })}
                />
              </label>
            </div>
          )}
        </div>

        <div className="grid gap-3.5 lg:grid-cols-[1.75fr_1fr]">
          <div className="rounded-[20px] border border-line bg-surface px-[22px] pb-3.5 pt-[18px]">
            <div className="grid grid-cols-[1fr_40px_1fr_1.15fr] items-center gap-3.5 border-b border-line-grid pb-3 text-[10.5px] font-semibold tracking-[0.07em] text-ink-3">
              <span>{t('import.col.file')}</span>
              <span />
              <span>{t('import.col.means')}</span>
              <span>{t('import.col.samples')}</span>
            </div>
            {parsed.headers.map((header, i) => {
              const role = roles[i] ?? 'ignore'
              const ignored = role === 'ignore'
              const isAmount = role === 'amount'
              const samples = firstValues(parsed.rows, i, 3).join(' · ')
              return (
                <div
                  key={`${header}-${i}`}
                  className={[
                    'grid grid-cols-[1fr_40px_1fr_1.15fr] items-center gap-3.5 border-b border-line-grid last:border-0',
                    ignored ? 'opacity-55' : '',
                    isAmount ? 'my-0 rounded-xl bg-accent-weak px-2.5' : '',
                    'min-h-16',
                  ].join(' ')}
                >
                  <span className="truncate font-mono text-[13px] font-semibold">{header || '—'}</span>
                  <span className={`flex justify-center ${isAmount ? 'text-accent' : 'text-ink-3'}`}>
                    <ArrowRight className="size-[17px]" strokeWidth={isAmount ? 2.4 : 2.2} />
                  </span>
                  <label
                    className={[
                      'relative flex h-[42px] items-center gap-2 rounded-xl px-3',
                      isAmount
                        ? 'border-2 border-accent bg-surface'
                        : ignored
                          ? 'border border-dashed border-line bg-bg'
                          : 'border border-line bg-bg',
                    ].join(' ')}
                  >
                    <RoleIcon role={role} />
                    <select
                      className={[
                        'h-full w-full appearance-none bg-transparent pr-5 text-[13px] outline-none',
                        ignored ? 'font-medium text-ink-3' : isAmount ? 'font-bold' : 'font-semibold',
                      ].join(' ')}
                      value={role}
                      onChange={(e) => setRole(i, e.target.value as ColumnRole)}
                      aria-label={t('import.col.means')}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {roleLabel(r)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-3 size-[15px] text-ink-3"
                      strokeWidth={2.2}
                    />
                  </label>
                  <span className="truncate font-mono text-[12px] text-ink-3">{samples || '—'}</span>
                </div>
              )
            })}
          </div>

          <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface px-[22px] py-5">
              <span className="text-[15px] font-bold">{t('import.landsIn')}</span>
              <label className="relative flex h-[52px] items-center gap-2.5 rounded-[14px] border border-line bg-bg px-3.5">
                <span className="flex size-[30px] shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-ink-2">
                  <Landmark className="size-4" strokeWidth={2.2} />
                </span>
                <select
                  className="h-full w-full appearance-none bg-transparent pr-6 text-[13.5px] font-semibold outline-none"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  {(accounts.data?.items ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3.5 size-4 text-ink-3"
                  strokeWidth={2.2}
                />
              </label>
              <span className="text-[12px] leading-snug text-ink-2">{t('import.landsInHint')}</span>
            </div>

            <div className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface px-[22px] py-5">
              <button
                type="button"
                onClick={() => setRemember((v) => !v)}
                className="flex items-center gap-2.5 text-left"
                aria-pressed={remember}
              >
                <span
                  className={[
                    'flex h-[26px] w-11 shrink-0 items-center rounded-full p-[3px]',
                    remember ? 'justify-end bg-accent' : 'justify-start bg-surface-2',
                  ].join(' ')}
                >
                  <span className="size-5 rounded-full bg-surface" />
                </span>
                <span className="text-[13.5px] font-semibold">{t('import.remember')}</span>
              </button>
              {remember && (
                <input
                  className="h-[46px] rounded-[13px] border border-line bg-bg px-3.5 text-[13px] font-medium text-ink-2 outline-none focus-visible:shadow-focus"
                  value={mappingName}
                  onChange={(e) => setMappingName(e.target.value)}
                  placeholder={t('import.mappingName')}
                />
              )}
              <span className="text-[12px] leading-snug text-ink-2">{t('import.rememberHint')}</span>
            </div>

            {error && (
              <p className="text-[13px] font-medium text-danger" role="alert">
                {error}
              </p>
            )}
            {mapReadyHint && (
              <p className="rounded-[14px] border border-[color:var(--savings-border)] bg-savings-weak px-4 py-3 text-[13px] text-savings">
                {t('import.mapReady')}
              </p>
            )}

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="flex h-[52px] flex-1 items-center justify-center rounded-[15px] border border-line bg-surface text-[13.5px] font-semibold text-ink-2"
              >
                {t('import.back')}
              </button>
              <button
                type="button"
                onClick={onContinuePreview}
                disabled={!mappingValid()}
                className="flex h-[52px] flex-[1.6] items-center justify-center gap-2 rounded-[15px] bg-accent text-[13.5px] font-bold text-accent-fg shadow-accent disabled:opacity-40"
              >
                {t('import.previewPrefix')} {parsed.rows.length} {t('import.previewSuffix')}
                <ArrowRight className="size-[17px]" strokeWidth={2.4} />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 pb-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[26px] font-extrabold tracking-tight">{t('import.pageTitle')}</h1>
        <p className="text-[13px] font-medium text-ink-2">{t('import.pageHint')}</p>
      </div>

      <StepRail current={1} />

      <div className="grid gap-3.5 lg:grid-cols-[1.75fr_1fr]">
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={[
            'flex flex-col items-center gap-[18px] rounded-[24px] border-2 border-dashed px-10 py-14 text-center',
            dragOver ? 'border-accent bg-accent-weak' : 'border-line bg-surface',
          ].join(' ')}
        >
          <span className="flex size-20 items-center justify-center rounded-full bg-accent-weak text-accent">
            <FileUp className="size-[34px]" strokeWidth={1.8} />
          </span>
          <div className="flex max-w-[440px] flex-col gap-2">
            <span className="text-xl font-bold tracking-tight">{t('import.dropTitle')}</span>
            <span className="text-sm leading-relaxed text-ink-2">{t('import.dropHint')}</span>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            className="mt-1 inline-flex h-12 items-center gap-2 rounded-full bg-accent px-[22px] text-sm font-bold text-accent-fg shadow-accent"
          >
            <FolderOpen className="size-[17px]" strokeWidth={2.4} />
            {busy ? t('common.loading') : t('import.chooseFile')}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="sr-only"
            onChange={(e) => onPick(e.target.files?.[0])}
          />
          <div className="mt-1.5 flex flex-wrap justify-center gap-1.5">
            <span className="rounded-full bg-surface-2 px-3 py-2 text-[11px] font-semibold text-ink-2">
              .csv
            </span>
            <span className="rounded-full bg-surface-2 px-3 py-2 text-[11px] font-semibold text-ink-3">
              {t('import.xlsSoon')}
            </span>
            <span className="rounded-full bg-surface-2 px-3 py-2 text-[11px] font-semibold text-ink-2">
              {t('import.maxSize')}
            </span>
          </div>
          {error && (
            <p className="text-[13px] font-medium text-danger" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-3.5 rounded-[20px] border border-line bg-surface px-[22px] py-5">
            <span className="text-[15px] font-bold">{t('import.savedMappings')}</span>
            {savedList.length === 0 ? (
              <p className="text-[12.5px] leading-relaxed text-ink-2">{t('import.savedEmpty')}</p>
            ) : (
              savedList.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    if (file) {
                      void runParse(
                        file,
                        {
                          delimiter: m.delimiter,
                          encoding: m.encoding,
                          skipRows: m.skipRows,
                        },
                        m,
                      )
                      return
                    }
                    setPendingSaved((cur) => (cur?.id === m.id ? null : m))
                  }}
                  className={[
                    'flex h-[52px] items-center gap-3 rounded-[14px] px-1 text-left',
                    pendingSaved?.id === m.id ? 'bg-accent-weak' : '',
                  ].join(' ')}
                >
                  <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[11px] bg-surface-2 text-ink-2">
                    <Landmark className="size-[17px]" strokeWidth={2.2} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[13.5px] font-semibold">{m.name}</span>
                    <span className="text-[11px] text-ink-3">
                      {Object.keys(m.rolesByHeader).length} {t('import.columns')} · {m.useCount}{' '}
                      {t('import.usedTimes')}
                    </span>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-ink-3" strokeWidth={2.2} />
                </button>
              ))
            )}
            <p className="text-[12px] leading-relaxed text-ink-2">{t('import.savedHint')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function StepRail({ current }: { current: 1 | 2 | 3 }) {
  const items: { n: 1 | 2 | 3; label: string }[] = [
    { n: 1, label: t('import.step.upload') },
    { n: 2, label: t('import.step.map') },
    { n: 3, label: t('import.step.review') },
  ]
  return (
    <div className="flex flex-wrap items-center gap-4">
      {items.map((item, idx) => {
        const done = item.n < current
        const active = item.n === current
        return (
          <div key={item.n} className="flex items-center gap-4">
            {idx > 0 && (
              <div className={`h-0.5 w-[60px] ${current >= item.n ? 'bg-savings' : 'bg-line'}`} />
            )}
            <div className="flex items-center gap-2.5">
              <span
                className={[
                  'flex size-7 items-center justify-center rounded-full text-[13px] font-bold',
                  done
                    ? 'bg-savings text-white'
                    : active
                      ? 'bg-accent text-accent-fg'
                      : 'bg-surface-2 text-ink-3',
                ].join(' ')}
              >
                {done ? <Check className="size-[15px]" strokeWidth={3} /> : item.n}
              </span>
              <span
                className={[
                  'text-[13px]',
                  active
                    ? 'font-bold'
                    : done
                      ? 'font-semibold text-ink-2'
                      : 'font-semibold text-ink-3',
                ].join(' ')}
              >
                {item.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DetectPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-2.5 text-[11.5px] font-semibold">
      <WandSparkles className="size-[13px] text-accent" strokeWidth={2.4} />
      {label}{' '}
      <b className="font-mono font-bold">{value}</b>
    </span>
  )
}
