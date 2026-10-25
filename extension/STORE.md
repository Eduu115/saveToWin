# Publicar en Chrome Web Store y Firefox Add-ons

La extensión **no** debe instalarse como «complemento temporal» en Firefox:
eso se borra al reiniciar. El camino estable es la ficha de tienda (o un XPI
firmado por Mozilla).

## Paquete

```bash
node scripts/render-mark.mjs   # iconos, si faltan
node scripts/pack-extension.mjs
```

Salida: `extension/dist/savetowin-extension.zip` (archivos en la raíz del zip).
También se copia a `web/public/savetowin-extension.zip` para el enlace del Perfil.

## Chrome Web Store

1. Cuenta de desarrollador: https://chrome.google.com/webstore/devconsole  
   (pago único ~5 USD).
2. **Nuevo elemento** → subir `savetowin-extension.zip`.
3. Ficha (español):
   - **Nombre:** saveToWin — gasto rápido
   - **Resumen:** Apunta un gasto en tu saveToWin sin abrir la app.
   - **Descripción:** ver `store/listing.es.txt`.
   - **Categoría:** Productividad.
   - **Icono:** `icons/icon-128.png`.
   - **Capturas:** 1280×800 o 640×400 (popup sobre fondo neutro).
4. **Privacidad:** la extensión pide permiso al servidor que indiques al entrar;
   no vende datos. Política: la de tu instancia (`savetowin.app` o la tuya).
5. Enviar a revisión. La primera vez suele tardar unos días.

## Firefox Add-ons (AMO)

1. Cuenta: https://addons.mozilla.org/developers/
2. Opción A — ficha pública:
   ```bash
   npx web-ext build -s extension -a extension/dist
   # Sube el zip de web-ext en «Enviar un nuevo complemento»
   ```
3. Opción B — solo firmado (sin listado público), para repartir el `.xpi`:
   ```bash
   npx web-ext sign -s extension --channel=unlisted \
     --api-key=… --api-secret=…
   ```
   Las claves salen de https://addons.mozilla.org/developers/addon/api/key/

Firefox **no** acepta extensiones sin firmar de forma permanente. El modo
«Cargar complemento temporal» es solo para desarrollo.

## Servidor casero

Al entrar, la extensión pide permiso solo para la URL que escribas
(`https://savetowin.app`, `https://tu-casa…`, etc.). No hace falta una ficha
distinta por instancia: el mismo complemento sirve para todas.

## Qué no hacer

- No uses `about:debugging` → «temporal» como instalación diaria.
- No subas el zip con una carpeta `extension/` dentro: Chrome espera
  `manifest.json` en la raíz (el script `pack-extension` lo deja bien).
