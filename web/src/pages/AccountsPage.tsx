import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeftRight,
  Banknote,
  CreditCard,
  Landmark,
  type LucideIcon,
  Pencil,
  PiggyBank,
  Plus,
  Smartphone,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react'
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
import { CategoriesSection } from '../ui/CategoriesSection'

const field =
  'h-field w-full rounded-field border border-line bg-surface px-3 text-ink focus-visible:shadow-focus focus-visible:outline-none'

/** Directions 10b — icono por cuenta sembrada; las propias usan landmark. */
const ACCOUNT_ICONS: Record<string, LucideIcon> = {
  Current: Landmark,
  Savings: PiggyBank,
  Transfer: ArrowLeftRight,
  Bizum: Smartphone,
  'Bank card': CreditCard,
  'Prepaid card': WalletCards,
  'e-cash card': Banknote,
}

const iconBtn =
  'inline-flex size-tap items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink focus-visible:shadow-focus focus-visible:outline-none'

export function AccountsPage() {
  const qc = useQueryClient()
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: listAccounts })
  const cards = useQuery({ queryKey: ['cards'], queryFn: () => listCards() })

  // null = cerrado · 'new' = alta · id = edición de esa cuenta
  const [formFor, setFormFor] = useState<null | 'new' | number>(null)
  const [name, setName] = useState('')
  const [entity, setEntity] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [cardDrafts, setCardDrafts] = useState<Record<number, string>>({})

  const activeAccounts = (accounts.data?.items ?? [])
    .filter((a) => !a.archived)
    .sort((a, b) => a.id - b.id)
  const cardsByAccount = new Map<number, Card[]>()
  for (const card of cards.data?.items ?? []) {
    if (card.archived) continue
    const list = cardsByAccount.get(card.accountId) ?? []
    list.push(card)
    cardsByAccount.set(card.accountId, list)
  }

  const saveAccount = useMutation({
    mutationFn: async () => {
      const body = { name: name.trim(), entity: entity.trim() || null }
      if (typeof formFor === 'number') return updateAccount(formFor, body)
      return createAccount(body)
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['accounts'] })
      closeForm()
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

  function openForm(target: 'new' | Account) {
    setFormFor(target === 'new' ? 'new' : target.id)
    setName(target === 'new' ? '' : target.name)
    setEntity(target === 'new' ? '' : target.entity ?? '')
    setFormError(null)
  }

  function closeForm() {
    setFormFor(null)
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

  function submitCard(accountId: number) {
    const n = (cardDrafts[accountId] ?? '').trim()
    if (n) addCard.mutate({ accountId, cardName: n })
  }

  const accountForm = (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label>
        <span className="mb-1 block text-[12.5px] font-medium text-ink-2">
          {t('accounts.name')}
        </span>
        <input
          className={field}
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('accounts.namePlaceholder')}
        />
      </label>
      <label>
        <span className="mb-1 block text-[12.5px] font-medium text-ink-2">
          {t('accounts.entity')}
        </span>
        <input
          className={field}
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          placeholder={t('accounts.entityPlaceholder')}
        />
      </label>
      {formError && <p className="text-sm text-danger">{formError}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saveAccount.isPending}
          className="inline-flex h-tap flex-1 items-center justify-center rounded-pill bg-accent px-4 text-sm font-bold text-accent-fg focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-50"
        >
          {formFor === 'new' ? t('accounts.add') : t('accounts.save')}
        </button>
        <button
          type="button"
          onClick={closeForm}
          className="inline-flex h-tap items-center rounded-pill bg-surface-2 px-4 text-sm text-ink-2 focus-visible:shadow-focus focus-visible:outline-none"
        >
          {t('accounts.cancel')}
        </button>
      </div>
    </form>
  )

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight">{t('accounts.title')}</h1>
        <p className="mt-1 text-[13px] text-ink-2">{t('accounts.hint')}</p>
      </div>

      {accounts.isPending && <p className="text-ink-2">{t('common.loading')}</p>}
      {accounts.isError && <p className="text-danger">{t('common.error')}</p>}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {activeAccounts.map((a) => {
          const Icon = ACCOUNT_ICONS[a.key] ?? Landmark
          const accountCards = cardsByAccount.get(a.id) ?? []
          const isEditing = formFor === a.id
          return (
            <li
              key={a.id}
              className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-raised"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 flex-none items-center justify-center rounded-tile bg-surface-2 text-ink-2">
                  <Icon size={19} strokeWidth={2} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{a.name}</p>
                  <p className="truncate text-[12px] text-ink-2">
                    {a.entity?.trim() || t('accounts.noEntity')}
                  </p>
                </div>
                {!isEditing && (
                  <div className="-mr-2 flex">
                    <button
                      type="button"
                      aria-label={`${t('accounts.edit')} ${a.name}`}
                      onClick={() => openForm(a)}
                      className={iconBtn}
                    >
                      <Pencil size={15} strokeWidth={2.2} aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={`${t('accounts.archive')} ${a.name}`}
                      onClick={() => {
                        if (window.confirm(t('accounts.archiveConfirm'))) {
                          removeAccount.mutate(a.id)
                        }
                      }}
                      className={`${iconBtn} hover:bg-danger-weak hover:text-danger`}
                    >
                      <Trash2 size={15} strokeWidth={2.2} aria-hidden />
                    </button>
                  </div>
                )}
              </div>

              {isEditing ? (
                <>
                  {accountForm}
                  {accountCards.length > 0 && (
                    <div className="flex flex-col gap-2 border-t border-line pt-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-ink-2">
                        {t('accounts.cards')}
                      </p>
                      {accountCards.map((card) => (
                        <div key={card.id} className="flex items-center gap-2">
                          <input
                            className={field}
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
                            aria-label={`${t('accounts.archiveCard')} ${card.name}`}
                            onClick={() => removeCard.mutate(card.id)}
                            className={`${iconBtn} flex-none hover:bg-danger-weak hover:text-danger`}
                          >
                            <Trash2 size={14} strokeWidth={2.2} aria-hidden />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
                  {accountCards.map((card) => (
                    <span
                      key={card.id}
                      className="inline-flex h-8 items-center gap-1.5 rounded-pill bg-surface-2 pl-2.5 pr-1 text-[12.5px] font-medium"
                    >
                      <CreditCard size={13} strokeWidth={2.2} className="text-ink-2" aria-hidden />
                      {card.name}
                      <button
                        type="button"
                        aria-label={`${t('accounts.archiveCard')} ${card.name}`}
                        onClick={() => removeCard.mutate(card.id)}
                        className="inline-flex size-6 items-center justify-center rounded-full text-ink-3 hover:bg-danger-weak hover:text-danger focus-visible:shadow-focus focus-visible:outline-none"
                      >
                        <X size={12} strokeWidth={2.4} aria-hidden />
                      </button>
                    </span>
                  ))}
                  <span className="inline-flex h-8 min-w-0 flex-1 items-center gap-1 rounded-pill border border-dashed border-line pl-2.5 pr-1">
                    <Plus size={13} strokeWidth={2.2} className="flex-none text-ink-3" aria-hidden />
                    <input
                      className="h-full min-w-0 flex-1 bg-transparent text-[12.5px] placeholder:text-ink-3 focus-visible:outline-none"
                      value={cardDrafts[a.id] ?? ''}
                      aria-label={`${t('accounts.cardName')} · ${a.name}`}
                      placeholder={t('accounts.addCardPlaceholder')}
                      onChange={(e) =>
                        setCardDrafts((d) => ({ ...d, [a.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          submitCard(a.id)
                        }
                      }}
                    />
                    {(cardDrafts[a.id] ?? '').trim() && (
                      <button
                        type="button"
                        disabled={addCard.isPending}
                        onClick={() => submitCard(a.id)}
                        className="inline-flex h-6 items-center rounded-pill bg-accent px-2.5 text-[11.5px] font-bold text-accent-fg focus-visible:shadow-focus focus-visible:outline-none"
                      >
                        {t('accounts.addCard')}
                      </button>
                    )}
                  </span>
                </div>
              )}
            </li>
          )
        })}

        <li>
          {formFor === 'new' ? (
            <div className="rounded-card border border-line bg-surface p-4 shadow-raised">
              <p className="mb-3 font-semibold">{t('accounts.add')}</p>
              {accountForm}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openForm('new')}
              className="flex h-full min-h-[132px] w-full items-center justify-center gap-3 rounded-card border border-dashed border-line text-ink-2 hover:border-ink-3 hover:bg-surface hover:text-ink focus-visible:shadow-focus focus-visible:outline-none"
            >
              <span className="flex size-10 items-center justify-center rounded-tile bg-surface-2">
                <Plus size={19} strokeWidth={2} aria-hidden />
              </span>
              <span className="font-semibold">{t('accounts.add')}</span>
            </button>
          )}
        </li>
      </ul>

      <CategoriesSection />
    </div>
  )
}
