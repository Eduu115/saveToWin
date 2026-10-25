# saveToWin — gasto rápido

Extensión **Chrome** y **Firefox** (Manifest V3). Apunta un gasto en tu
servidor sin abrir la app: importe, categoría, cuenta y fecha.

La contraseña no se guarda. Tras entrar, conserva un token de sesión (el mismo
JWT de la web, un día). Cambiar la contraseña lo invalida.

## Instalación estable = tienda

Para uso diario hay que publicarla (o firmarla) en:

- [Chrome Web Store](https://chrome.google.com/webstore/devconsole)
- [Firefox Add-ons](https://addons.mozilla.org/developers/)

Guía completa: **[STORE.md](./STORE.md)**. Empaquetar:

```bash
node scripts/pack-extension.mjs
```

El «complemento temporal» de Firefox (`about:debugging`) **se borra al
reiniciar**. Solo sirve para probar mientras desarrollas.

## Probar en local (desarrollo)

1. `node scripts/pack-extension.mjs` y descomprime el zip, o usa esta carpeta.
2. Chrome: `chrome://extensions` → modo desarrollador → **Cargar descomprimida**.
3. Firefox: `about:debugging` → Este Firefox → **Cargar complemento temporal**.
4. Servidor: `https://savetowin.app` o `http://localhost:5173`.
5. Atajo sugerido: Ctrl+Mayús+E (Mac: Cmd+Mayús+E).

## Vista previa del popup

Abre `popup.html?preview=1` en un navegador. No guarda nada.
