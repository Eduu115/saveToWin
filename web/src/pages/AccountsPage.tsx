import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Landmark, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import {
  archiveAccount,
  archiveCard,
  createAccount,
  createCard,
  listAccounts,
  listCards,
  updateAccount,
  updateCard,
} from '../api/accounts'
import { ApiClientError } from '../api/client'
import type { Account, Card } from '../domain'
import { t } from '../i18n/t'

const field =
  'h-field w-full rounded-field border border-line bg-surface px-3 text-ink focus-visible:shadow-focus focus-visible:outline-none'

export function AccountsPage() {
  const qc = useQueryClient()
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: listAccounts })
  const cards = useQuery({ queryKey: ['cards'], queryFn: () => listCards() })

  const [name, setName] = useState('')
  const [entity, setEntity] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Account | null>(null)
  const [cardDrafts, setCardDrafts] = useState<Record<number, string>>({})

  const activeAccounts = (accounts.data?.items ?? []).filter((a) => !a.archived)
  const cardsByAccount = new Map<number, Card[]>()
  for (const card of cards.data?.items ?? []) {
    if (card.archived) continue
    const list = cardsByAccount.get(card.accountId) ?? []
    list.push(card)
    cardsByAccount.set(card.accountId, list)
  }

  const saveAccount = useMutation({
    mutationFn: async () => {
      if (editing) {
        return updateAccount(editing.id, {
          name: name.trim(),
          entity: entity.trim() || null,
        })
      }
      return createAccount({
        name: name.trim(),
        entity: entity.trim() || null,
      })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['accounts'] })
      setName('')
      setEntity('')
      setEditing(null)
      setFormError(null)
    },
    onError: (err) => {
      setFormError(
        err instanceof ApiClientError
          ? err.body?.error.message ?? t('common.error')
          : t('common.error'),
      )
    },
  })

  const removeAccount = useMutation({
    mutationFn: (id: number) => archiveAccount(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['accounts'] })
    },
  })

  const addCard = useMutation({
    mutationFn: ({ accountId, cardName }: { accountId: number; cardName: string }) =>
      createCard({ accountId, name: cardName }),
    onSuccess: async (_row, vars) => {
      await qc.invalidateQueries({ queryKey: ['cards'] })
      setCardDrafts((d) => ({ ...d, [vars.accountId]: '' }))
    },
  })

  const renameCard = useMutation({
    mutationFn: ({ id, cardName }: { id: number; cardName: string }) =>
      updateCard(id, { name: cardName }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['cards'] })
    },
  })

  const removeCard = useMutation({
    mutationFn: (id: number) => archiveCard(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['cards'] })
    },
  })

  function startEdit(a: Account) {
    setEditing(a)
    setName(a.name)
    setEntity(a.entity ?? '')
    setFormError(null)
  }

  function cancelEdit() {
    setEditing(null)
    setName('')
    setEntity('')
    setFormError(null)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setFormError(t('accounts.nameRequired'))
      return
    }
    saveAccount.mutate()
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[26px] font-extrabold tracking-tight">{t('accounts.title')}</h1>
        <p className="text-[13px] text-ink-2">{t('accounts.hint')}</p>
      </div>

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5 shadow-raised"
      >
        <h2 className="text-[15px] font-bold">
          {editing ? t('accounts.edit') : t('accounts.add')}
        </h2>
        <label>
          <span className="mb-1 block text-sm text-ink-2">{t('accounts.name')}</span>
          <input
            className={field}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('accounts.namePlaceholder')}
          />
        </label>
        <label>
          <span className="mb-1 block text-sm text-ink-2">{t('accounts.entity')}</span>
          <input
            className={field}
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            placeholder={t('accounts.entityPlaceholder')}
          />
        </label>
        {formError && <p className="text-sm text-danger">{formError}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saveAccount.isPending}
            className="inline-flex h-tap items-center gap-2 rounded-pill bg-accent px-4 text-sm font-bold text-accent-fg focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-50"
          >
            <Plus size={15} strokeWidth={2.2} aria-hidden />
            {editing ? t('accounts.save') : t('accounts.add')}
          </button>
          {editing && (
            <button
              type="button"
              onClick={cancelEdit}
              className="inline-flex h-tap items-center rounded-pill bg-surface-2 px-4 text-sm text-ink-2 focus-visible:shadow-focus focus-visible:outline-none"
            >
              {t('accounts.cancel')}
            </button>
          )}
        </div>
      </form>

      {accounts.isPending && <p className="text-ink-2">{t('common.loading')}</p>}
      {accounts.isError && <p className="text-danger">{t('common.error')}</p>}

      {activeAccounts.length === 0 && accounts.data && (
        <p className="text-ink-2">{t('accounts.empty')}</p>
      )}

      <ul className="flex flex-col gap-3">
        {activeAccounts.map((a) => {
          const accountCards = cardsByAccount.get(a.id) ?? []
          return (
            <li
              key={a.id}
              className="rounded-card border border-line bg-surface p-4 shadow-raised"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-[34px] shrink-0 items-center justify-center rounded-icon bg-surface-2 text-ink-2">
                  <Landmark size={17} strokeWidth={2.2} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{a.name}</p>
                      <p className="text-[12px] text-ink-2">
                        {a.entity?.trim() || t('accounts.noEntity')}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(a)}
                        className="inline-flex h-tap items-center rounded-pill px-3 text-sm text-ink-2 hover:bg-surface-2 focus-visible:shadow-focus focus-visible:outline-none"
                      >
                        {t('accounts.edit')}
                      </button>
                      <button
                        type="button"
                        aria-label={t('accounts.archive')}
                        onClick={() => {
                          if (window.confirm(t('accounts.archiveConfirm'))) {
                            removeAccount.mutate(a.id)
                          }
                        }}
                        className="inline-flex size-tap items-center justify-center rounded-full text-danger hover:bg-danger-weak focus-visible:shadow-focus focus-visible:outline-none"
                      >
                        <Trash2 size={15} strokeWidth={2.2} aria-hidden />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-line pt-3">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-2">
                      {t('accounts.cards')}
                    </p>
                    <ul className="flex flex-col gap-2">
                      {accountCards.map((card) => (
                        <li
                          key={card.id}
                          className="flex items-center gap-2 rounded-[13px] border border-line bg-surface-2/60 px-3 py-2"
                        >
                          <CreditCard
                            size={15}
                            strokeWidth={2.2}
                            className="shrink-0 text-ink-2"
                            aria-hidden
                          />
                          <input
                            className="h-9 min-w-0 flex-1 rounded-field border-0 bg-transparent px-1 text-sm focus-visible:shadow-focus focus-visible:outline-none"
                            defaultValue={card.name}
                            aria-label={t('accounts.cardName')}
                            onBlur={(e) => {
                              const next = e.target.value.trim()
                              if (next && next !== card.name) {
                                renameCard.mutate({ id: card.id, cardName: next })
                              } else {
                                e.target.value = card.name
                              }
                            }}
                          />
                          <button
                            type="button"
                            aria-label={t('accounts.archiveCard')}
                            onClick={() => removeCard.mutate(card.id)}
                            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-danger-weak hover:text-danger focus-visible:shadow-focus focus-visible:outline-none"
                          >
                            <Trash2 size={14} strokeWidth={2.2} aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex gap-2">
                      <input
                        className={field}
                        value={cardDrafts[a.id] ?? ''}
                        onChange={(e) =>
                          setCardDrafts((d) => ({ ...d, [a.id]: e.target.value }))
                        }
                        placeholder={t('accounts.cardPlaceholder')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const n = (cardDrafts[a.id] ?? '').trim()
                            if (n) addCard.mutate({ accountId: a.id, cardName: n })
                          }
                        }}
                      />
                      <button
                        type="button"
                        disabled={!(cardDrafts[a.id] ?? '').trim() || addCard.isPending}
                        onClick={() => {
                          const n = (cardDrafts[a.id] ?? '').trim()
                          if (n) addCard.mutate({ accountId: a.id, cardName: n })
                        }}
                        className="inline-flex h-tap shrink-0 items-center gap-1 rounded-pill bg-surface-2 px-3 text-sm font-semibold text-ink-2 focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-40"
                      >
                        <Plus size={14} strokeWidth={2.2} aria-hidden />
                        {t('accounts.addCard')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
