# saveToWin — gasto rápido

Extensión para **Chrome** y **Firefox** (Manifest V3). Apunta un gasto en tu
servidor sin abrir la app: importe, categoría, cuenta y fecha.

La contraseña no se guarda. Tras entrar, la extensión conserva un token de
sesión (el mismo JWT de la web, un día). Cambiar la contraseña lo invalida.

## Instalar

1. Descomprime `savetowin-extension.zip` (también en Perfil de la app) o usa esta carpeta.
2. Chrome: `chrome://extensions` → modo desarrollador → **Cargar descomprimida**.
3. Firefox: `about:debugging#/runtime/this-firefox` → **Cargar complemento temporal**.
   En Firefox temporal se quita al cerrar el navegador.
4. Escribe la dirección del servidor (`https://savetowin.app` o `http://localhost:5173`)
   y entra. El navegador pide permiso para hablar con ese origen.
5. Atajo sugerido: Ctrl+Mayús+E (en Mac, Cmd+Mayús+E).

## Vista previa del popup

Abre `popup.html?preview=1` en un navegador para ver el formulario sin instalar
la extensión. No guarda nada.
