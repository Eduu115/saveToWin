/* saveToWin — popup de gasto rápido.
   ponytail: el token es el JWT de la sesión (1 día). Un token propio revocable
   en Perfil sería el siguiente paso si hace falta cerrar solo la extensión. */
'use strict'

const app = document.getElementById('app')
const subtitle = document.getElementById('subtitle')
const preview = new URLSearchParams(location.search).has('preview')
const ext = globalThis.chrome?.storage ? globalThis.chrome : globalThis.browser

const state = {
  screen: 'login',
  serverUrl: '',
  email: '',
  token: '',
  challenge: '',
  userEmail: '',
  categories: [],
  accounts: [],
  categoryId: '',
  accountId: '',
  error: '',
  info: '',
  busy: false,
  draftAmount: '',
  draftNote: '',
  draftDate: '',
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) continue
    if (key === 'class') node.className = value
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value)
    } else node.setAttribute(key, String(value))
  }
  for (const child of children) {
    node.append(child instanceof Node ? child : document.createTextNode(String(child)))
  }
  return node
}

function field(label, control) {
  return el('label', {}, [label, control])
}

function showMessage() {
  if (state.error) return el('p', { class: 'msg error', role: 'alert' }, [state.error])
  if (state.info) return el('p', { class: 'msg ok', role: 'status' }, [state.info])
  return null
}

function todayIso() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Importe es-ES → céntimos. "12,5" → 1250. Vacío o cero → null. */
function parseCents(input) {
  let s = input.trim().replace(/\u00a0/g, '').replace(/\s/g, '').replace(/€/g, '')
  if (!s || !/^[\d.]+(,\d{1,2})?$/.test(s)) return null
  const [intRaw, decRaw = ''] = s.split(',')
  if (intRaw.includes('.') && !/^\d{1,3}(\.\d{3})+$/.test(intRaw)) return null
  const euros = Number(intRaw.replace(/\./g, ''))
  const cents = Number((decRaw + '00').slice(0, 2))
  const total = euros * 100 + cents
  if (!Number.isSafeInteger(total) || total <= 0) return null
  return total
}

function formatCents(cents) {
  const whole = Math.floor(cents / 100)
  const frac = String(cents % 100).padStart(2, '0')
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${grouped},${frac} €`
}

function normalizeServer(raw) {
  let s = raw.trim().replace(/\/+$/, '')
  if (!s) throw new Error('Escribe la dirección de tu saveToWin.')
  if (!/^https?:\/\//i.test(s)) {
    const host = s.split('/')[0]
    const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)
    s = `${local ? 'http' : 'https'}://${s}`
  }
  const url = new URL(s)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('La dirección tiene que ser http o https.')
  }
  return url.origin
}

async function api(path, { method = 'GET', body, token } = {}) {
  const headers = {
    'content-type': 'application/json',
    'x-savetowin-client': 'extension',
  }
  if (token) headers.authorization = `Bearer ${token}`
  let res
  try {
    res = await fetch(`${state.serverUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('No se alcanza el servidor. Revisa la dirección.')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const err = new Error(data?.error?.message || 'No se pudo completar.')
    err.status = res.status
    throw err
  }
  return data
}

async function ensurePermission(origin) {
  if (!ext?.permissions) {
    throw new Error('Ábreme como extensión de Chrome o Firefox.')
  }
  const origins = [`${origin}/*`]
  const has = await ext.permissions.contains({ origins })
  if (has) return
  const ok = await ext.permissions.request({ origins })
  if (!ok) throw new Error('Hay que permitir el acceso a ese servidor.')
}

async function loadSession() {
  if (!ext?.storage) return
  const saved = await ext.storage.local.get([
    'stwServer',
    'stwToken',
    'stwEmail',
    'stwCategoryId',
    'stwAccountId',
  ])
  state.serverUrl = saved.stwServer || ''
  state.email = saved.stwEmail || ''
  state.token = saved.stwToken || ''
  state.categoryId = saved.stwCategoryId ? String(saved.stwCategoryId) : ''
  state.accountId = saved.stwAccountId ? String(saved.stwAccountId) : ''
  if (!state.token || !state.serverUrl) return
  const origin = `${new URL(state.serverUrl).origin}/*`
  const allowed = await ext.permissions.contains({ origins: [origin] })
  if (!allowed) {
    state.token = ''
    return
  }
  try {
    const me = await api('/api/auth/me', { token: state.token })
    if (!me?.user) {
      state.token = ''
      return
    }
    state.userEmail = me.user.email
    await loadCatalog()
    state.screen = 'form'
  } catch {
    state.token = ''
  }
}

async function loadCatalog() {
  const [categories, accounts] = await Promise.all([
    api('/api/categories', { token: state.token }),
    api('/api/accounts', { token: state.token }),
  ])
  state.categories = (categories.items || [])
    .filter((c) => !c.archived && c.type === 'expense')
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
  state.accounts = (accounts.items || []).filter((a) => !a.archived)
  if (!state.categories.some((c) => String(c.id) === state.categoryId)) {
    state.categoryId = state.categories[0] ? String(state.categories[0].id) : ''
  }
  if (!state.accounts.some((a) => String(a.id) === state.accountId)) {
    state.accountId = state.accounts[0] ? String(state.accounts[0].id) : ''
  }
}

function render() {
  subtitle.textContent =
    state.screen === 'form' && state.userEmail ? state.userEmail : 'Gasto rápido'
  app.replaceChildren()
  const msg = showMessage()
  if (msg) app.append(msg)
  if (state.screen === 'login') app.append(renderLogin())
  else if (state.screen === '2fa') app.append(renderTwoFactor())
  else app.append(renderForm())
  app.querySelector('[data-focus]')?.focus()
}

function renderLogin() {
  const server = el('input', {
    type: 'url',
    required: 'true',
    placeholder: 'https://savetowin.app',
    value: state.serverUrl,
    autocomplete: 'url',
    'data-focus': 'true',
  })
  const email = el('input', {
    type: 'email',
    required: 'true',
    autocomplete: 'username',
    value: state.email,
  })
  const password = el('input', { type: 'password', required: 'true', autocomplete: 'current-password' })
  const submit = el('button', { class: 'primary', type: 'submit' }, [
    state.busy ? 'Entrando…' : 'Entrar',
  ])
  const form = el('form', {}, [
    field('Servidor', server),
    field('Email', email),
    field('Contraseña', password),
    submit,
  ])
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    void login(server.value, email.value, password.value)
  })
  return form
}

async function login(serverRaw, email, password) {
  state.busy = true
  state.error = ''
  state.info = ''
  render()
  try {
    const origin = normalizeServer(serverRaw)
    if (!preview) await ensurePermission(origin)
    state.serverUrl = origin
    state.email = email.trim()
    if (preview) throw new Error('Vista previa: instálame para entrar de verdad.')
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: { email: state.email, password },
    })
    if (data.twoFactorRequired) {
      state.challenge = data.challenge
      state.screen = '2fa'
      return
    }
    await persistSession(data.token, data.user.email)
  } catch (err) {
    state.error = err instanceof Error ? err.message : 'No se pudo entrar.'
  } finally {
    state.busy = false
    render()
  }
}

function renderTwoFactor() {
  const code = el('input', {
    inputmode: 'numeric',
    autocomplete: 'one-time-code',
    required: 'true',
    placeholder: '123456',
  })
  const form = el('form', {}, [
    field('Código de la app o de recuperación', code),
    el('button', { class: 'primary', type: 'submit' }, [state.busy ? 'Comprobando…' : 'Verificar']),
    el('button', { class: 'ghost', type: 'button', onClick: backToLogin }, ['Volver']),
  ])
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    void confirmTwoFactor(code.value)
  })
  return form
}

function backToLogin() {
  state.screen = 'login'
  state.challenge = ''
  state.error = ''
  render()
}

async function confirmTwoFactor(code) {
  state.busy = true
  state.error = ''
  render()
  try {
    const data = await api('/api/auth/login/2fa', {
      method: 'POST',
      body: { challenge: state.challenge, code: code.trim() },
    })
    await persistSession(data.token, data.user.email)
  } catch (err) {
    state.error = err instanceof Error ? err.message : 'Código no válido.'
  } finally {
    state.busy = false
    render()
  }
}

async function persistSession(token, email) {
  if (!token) throw new Error('El servidor no ha devuelto sesión.')
  state.token = token
  state.userEmail = email
  if (ext?.storage) {
    await ext.storage.local.set({
      stwServer: state.serverUrl,
      stwToken: token,
      stwEmail: state.email,
    })
  }
  await loadCatalog()
  state.screen = 'form'
  state.info = ''
}

function renderForm() {
  if (state.categories.length === 0 || state.accounts.length === 0) {
    return el('p', { class: 'msg error', role: 'alert' }, [
      'No hay categorías o cuentas activas en esta cuenta.',
    ])
  }
  const amount = el('input', {
    class: 'amount',
    inputmode: 'decimal',
    placeholder: '0,00',
    autocomplete: 'off',
    required: 'true',
    'data-focus': 'true',
    value: state.draftAmount,
  })
  const note = el('input', {
    type: 'text',
    maxlength: '140',
    placeholder: 'Café, taxi…',
    value: state.draftNote,
  })
  const category = el(
    'select',
    {},
    state.categories.map((c) => {
      const opt = el('option', { value: c.id }, [c.label])
      if (String(c.id) === state.categoryId) opt.selected = true
      return opt
    }),
  )
  const account = el(
    'select',
    {},
    state.accounts.map((a) => {
      const opt = el('option', { value: a.id }, [a.name])
      if (String(a.id) === state.accountId) opt.selected = true
      return opt
    }),
  )
  const date = el('input', {
    type: 'date',
    required: 'true',
    value: state.draftDate || todayIso(),
  })
  const form = el('form', {}, [
    field('Importe', amount),
    field('Nota', note),
    field('Categoría', category),
    field('Cuenta', account),
    field('Fecha', date),
    el('button', { class: 'primary', type: 'submit' }, [state.busy ? 'Guardando…' : 'Apuntar gasto']),
    el('button', { class: 'ghost', type: 'button', onClick: logout }, ['Cerrar sesión']),
  ])
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    state.draftAmount = amount.value
    state.draftNote = note.value
    state.draftDate = date.value
    void saveExpense({
      amount: amount.value,
      note: note.value,
      categoryId: category.value,
      accountId: account.value,
      date: date.value,
    })
  })
  return form
}

async function saveExpense(input) {
  const cents = parseCents(input.amount)
  if (cents == null) {
    state.error = 'Escribe un importe, por ejemplo 12,50.'
    state.info = ''
    render()
    return
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    state.error = 'La fecha no es válida.'
    render()
    return
  }
  state.busy = true
  state.error = ''
  state.info = ''
  render()
  try {
    if (preview) {
      state.draftAmount = ''
      state.draftNote = ''
      state.info = `Vista previa: ${formatCents(cents)} no se ha guardado.`
      return
    }
    await api('/api/transactions', {
      method: 'POST',
      token: state.token,
      body: {
        date: input.date,
        amount: cents,
        type: 'expense',
        categoryId: Number(input.categoryId),
        accountId: Number(input.accountId),
        note: input.note.trim() || null,
      },
    })
    state.categoryId = input.categoryId
    state.accountId = input.accountId
    state.draftAmount = ''
    state.draftNote = ''
    if (ext?.storage) {
      await ext.storage.local.set({
        stwCategoryId: Number(input.categoryId),
        stwAccountId: Number(input.accountId),
      })
    }
    state.info = `Apuntado · ${formatCents(cents)}`
  } catch (err) {
    if (err && err.status === 401) {
      state.token = ''
      state.screen = 'login'
      state.error = 'La sesión ha caducado. Vuelve a entrar.'
      if (ext?.storage) await ext.storage.local.remove('stwToken')
    } else {
      state.error = err instanceof Error ? err.message : 'No se pudo guardar.'
    }
  } finally {
    state.busy = false
    render()
  }
}

async function logout() {
  state.token = ''
  state.userEmail = ''
  state.screen = 'login'
  state.info = ''
  state.error = ''
  if (ext?.storage) await ext.storage.local.remove('stwToken')
  render()
}

if (preview) {
  state.screen = 'form'
  state.userEmail = 'vista previa'
  state.categories = [
    { id: 1, label: 'Supermercado' },
    { id: 2, label: 'Comer fuera' },
    { id: 3, label: 'Transporte' },
  ]
  state.accounts = [{ id: 1, name: 'Cuenta corriente' }]
  state.categoryId = '1'
  state.accountId = '1'
  render()
} else {
  render()
  void loadSession().then(render)
}
