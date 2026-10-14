/**
 * Textos legales de savetowin.app (instancia alojada). Base: RGPD (UE 2016/679),
 * LOPDGDD (LO 3/2018), LSSI-CE (Ley 34/2002) y TRLGDCU (consumidores).
 * PENDIENTE: datos fiscales del titular (NIF y domicilio) cuando se habilite el pago.
 */

export type LegalSection = { heading: string; paragraphs?: string[]; list?: string[] }
export type LegalDoc = { slug: 'privacy' | 'cookies' | 'notice' | 'terms'; title: string; intro: string; sections: LegalSection[] }

export const UPDATED = '15 de octubre de 2026'
export const CONTACT = 'privacidad@savetowin.app'
const OWNER = 'Eduardo Serrano (Gubia Digital)'
const PENDING_NIF = 'NIF: pendiente de publicar'
const PENDING_ADDRESS = 'Domicilio: pendiente de publicar'

const privacy: LegalDoc = {
  slug: 'privacy',
  title: 'Política de privacidad',
  intro:
    'En saveToWin tus datos financieros son tuyos. Esta política explica qué datos tratamos, para qué, durante cuánto tiempo y qué derechos tienes, conforme al Reglamento General de Protección de Datos (RGPD) y a la Ley Orgánica 3/2018 de Protección de Datos y garantía de los derechos digitales (LOPDGDD).',
  sections: [
    {
      heading: '1. Responsable del tratamiento',
      list: [`Titular: ${OWNER}`, PENDING_NIF, PENDING_ADDRESS, `Correo de contacto para privacidad: ${CONTACT}`],
    },
    {
      heading: '2. Qué datos tratamos',
      list: [
        'Datos de cuenta: tu email, el nombre que quieras indicar (opcional) y tu contraseña, que se guarda cifrada con un algoritmo de un solo sentido (argon2): nadie, tampoco nosotros, puede leerla.',
        'Datos que tú introduces: cuentas y los nombres que pongas a tus tarjetas (nunca números de tarjeta ni credenciales bancarias), movimientos, importes, fechas, notas, categorías, límites, suscripciones, agrupaciones y tu objetivo de ahorro.',
        'Ficheros CSV que importes: se procesan para crear tus movimientos; el fichero no se conserva.',
        'Seguridad de la cuenta: si activas la verificación en dos pasos, el secreto de tu app de autenticación y tus códigos de recuperación (estos últimos, solo como resumen cifrado); y los códigos temporales que te enviamos por correo para confirmar cambios.',
        'Plan contratado: si tu cuenta es gratuita o premium y hasta cuándo.',
        'Datos técnicos imprescindibles para servir la web y protegerla de abusos, como la dirección IP de cada conexión.',
        'No te pedimos datos de categorías especiales (salud, ideología, etc.); te pedimos que tampoco los incluyas en tus notas.',
      ],
    },
    {
      heading: '3. Para qué los usamos y con qué base legal',
      list: [
        'Prestarte el servicio: guardar tus movimientos, calcular tus estadísticas, gráficos, consejos y tu resumen anual, y mostrártelos solo a ti. Base: ejecución del contrato que aceptas al registrarte (art. 6.1.b RGPD).',
        'Enviarte correos operativos: códigos de verificación y avisos de seguridad (por ejemplo, que tu email o tu contraseña han cambiado). Base: ejecución del contrato.',
        'Proteger el servicio y tu cuenta: limitar intentos de acceso y prevenir abusos. Base: interés legítimo en la seguridad (art. 6.1.f RGPD).',
        'Cumplir obligaciones legales cuando correspondan (por ejemplo, fiscales si en el futuro contratas un plan de pago). Base: obligación legal (art. 6.1.c RGPD).',
      ],
      paragraphs: [
        'No vendemos tus datos, no los cedemos a terceros con fines comerciales, no mostramos publicidad y no te enviamos comunicaciones comerciales.',
        'Los consejos y el análisis se generan con reglas automáticas solo para enseñártelos a ti. No tomamos decisiones automatizadas que produzcan efectos jurídicos sobre ti ni elaboramos perfiles con fines publicitarios.',
      ],
    },
    {
      heading: '4. Dónde se guardan y quién más interviene',
      paragraphs: [
        'Tus datos se almacenan en un servidor dedicado e independiente, gestionado por el titular y ubicado en España (Unión Europea). No se alojan en plataformas de terceros.',
        'Para que el servicio funcione intervienen estos proveedores, como encargados del tratamiento y solo en lo necesario:',
      ],
      list: [
        'Cloudflare, Inc. (EE. UU.): red y túnel por los que pasa el tráfico entre tu navegador y nuestro servidor, con protección frente a ataques. Trata los datos en tránsito y datos técnicos de conexión.',
        'Resend (EE. UU.): envío de los correos operativos. Trata tu dirección de email y el contenido de esos correos (por ejemplo, un código de verificación).',
      ],
    },
    {
      heading: '5. Transferencias internacionales',
      paragraphs: [
        'Los proveedores anteriores tienen sede en Estados Unidos. Las transferencias se amparan en el Marco de Privacidad de Datos UE-EE. UU. cuando el proveedor está adherido y, en todo caso, en las cláusulas contractuales tipo aprobadas por la Comisión Europea, que forman parte de sus acuerdos de tratamiento de datos.',
      ],
    },
    {
      heading: '6. Cuánto tiempo los conservamos',
      list: [
        'Tus datos de cuenta y los que introduces: mientras tu cuenta exista. Si bajas al plan gratuito, tus datos se conservan aunque algunos gráficos dejen de mostrarse.',
        'Al eliminar tu cuenta, tus datos se borran de inmediato de la base de datos. Pueden permanecer en las copias de seguridad del servidor durante un máximo de 30 días, hasta que se sobrescriben.',
        'Códigos de verificación por correo: 15 minutos o hasta que se usan.',
        'Datos técnicos para limitar intentos de acceso: se guardan en memoria y se descartan en minutos.',
      ],
    },
    {
      heading: '7. Tus derechos',
      paragraphs: [
        'Puedes ejercer en cualquier momento tus derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad. La mayoría los tienes directamente en la app, desde tu perfil:',
      ],
      list: [
        'Rectificar: cambia tu nombre o tu email.',
        'Portabilidad y acceso: descarga una copia completa de tus datos en formato JSON («Copia de seguridad»).',
        'Supresión: «Eliminar cuenta» borra tu cuenta y todos tus datos.',
        `Para cualquier otra petición, escribe a ${CONTACT}. Te responderemos en el plazo máximo de un mes.`,
        'Si consideras que no hemos atendido bien tus derechos, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).',
      ],
    },
    {
      heading: '8. Seguridad',
      paragraphs: [
        'Aplicamos medidas técnicas y organizativas adecuadas: conexión cifrada (HTTPS), contraseñas cifradas con argon2, sesión en una cookie protegida (httpOnly), verificación en dos pasos opcional, separación estricta de los datos de cada usuario y copias de seguridad. Ningún sistema es infalible: si detectamos una brecha que afecte a tus datos, te lo comunicaremos y lo notificaremos a la autoridad de control cuando la ley lo exija.',
      ],
    },
    {
      heading: '9. Menores',
      paragraphs: ['saveToWin está dirigido a personas mayores de 18 años. Si eres menor de edad, no crees una cuenta.'],
    },
    {
      heading: '10. Cambios en esta política',
      paragraphs: [
        'Si cambiamos esta política de forma relevante, te avisaremos en la app o por correo antes de que el cambio se aplique. La fecha de la última actualización aparece arriba.',
      ],
    },
  ],
}

const cookies: LegalDoc = {
  slug: 'cookies',
  title: 'Política de cookies',
  intro:
    'saveToWin solo usa cookies y almacenamiento local estrictamente necesarios para que la app funcione. No usamos cookies de análisis, de publicidad ni de redes sociales, y no hay scripts de terceros en la web.',
  sections: [
    {
      heading: '1. Qué son',
      paragraphs: [
        'Las cookies son pequeños ficheros que una web guarda en tu navegador. El almacenamiento local es un mecanismo parecido que guarda preferencias en tu dispositivo. Ambos están regulados por el artículo 22.2 de la Ley 34/2002 (LSSI-CE).',
      ],
    },
    {
      heading: '2. Las que usamos',
      list: [
        'stw_token (cookie propia, técnica): mantiene tu sesión iniciada. Caduca a las 24 horas o al cerrar sesión. Es httpOnly (el código de la web no puede leerla) y solo viaja por conexión cifrada.',
        'theme (almacenamiento local): recuerda si prefieres el modo claro u oscuro.',
        'stw.2fa-nag (almacenamiento local): recuerda cuándo pospusiste el aviso de la verificación en dos pasos, para no repetirlo.',
        'savetowin.importMappings y savetowin.categoryRules (almacenamiento local): recuerdan cómo se llaman las columnas del CSV de tu banco y tus reglas de categorización, para que la próxima importación sea de un clic.',
        'Caché de la app (service worker): guarda los ficheros de la web para que cargue más rápido y se pueda instalar en tu móvil. No contiene tus datos financieros.',
        'Cloudflare, nuestro proveedor de red, puede establecer cookies técnicas de seguridad (por ejemplo, __cf_bm) para distinguir el tráfico legítimo de los bots.',
      ],
    },
    {
      heading: '3. ¿Por qué no te pedimos consentimiento?',
      paragraphs: [
        'Todas son estrictamente necesarias para prestar el servicio que solicitas o recuerdan una preferencia que tú eliges, por lo que están exentas de consentimiento según el artículo 22.2 LSSI-CE y la Guía sobre el uso de las cookies de la Agencia Española de Protección de Datos. Si algún día añadimos cookies no necesarias, te pediremos permiso antes.',
      ],
    },
    {
      heading: '4. Cómo borrarlas',
      paragraphs: [
        'Puedes eliminarlas desde la configuración de tu navegador (cookies y datos de sitios). Si borras la cookie de sesión, tendrás que volver a iniciar sesión; si borras el almacenamiento local, se perderán esas preferencias, no tus datos, que siguen guardados en tu cuenta.',
      ],
    },
  ],
}

const notice: LegalDoc = {
  slug: 'notice',
  title: 'Aviso legal',
  intro: 'En cumplimiento del artículo 10 de la Ley 34/2002, de servicios de la sociedad de la información y de comercio electrónico (LSSI-CE), estos son los datos del titular de savetowin.app.',
  sections: [
    {
      heading: '1. Titular',
      list: [`Titular: ${OWNER}`, PENDING_NIF, PENDING_ADDRESS, `Contacto: ${CONTACT}`, 'Sitio web: https://savetowin.app'],
    },
    {
      heading: '2. Objeto',
      paragraphs: [
        'saveToWin es una aplicación web para registrar tus ingresos y gastos, organizarlos y ver estadísticas sobre tu dinero. Su uso implica la aceptación de las Condiciones de uso.',
      ],
    },
    {
      heading: '3. Propiedad intelectual e industrial',
      paragraphs: [
        'Las marcas «saveToWin» y «Gubia Digital», sus logotipos y el diseño de la web pertenecen al titular.',
        'El núcleo de saveToWin es software libre bajo la licencia GNU Affero General Public License v3.0 y su código está publicado en https://github.com/Eduu115/saveToWin. Las funciones Premium de savetowin.app son software propietario del titular y no se distribuyen.',
      ],
    },
    {
      heading: '4. No es asesoramiento financiero',
      paragraphs: [
        'Las estadísticas, gráficos, consejos y resúmenes de saveToWin se calculan de forma automática a partir de los datos que tú introduces y tienen un fin meramente informativo. No constituyen asesoramiento financiero, fiscal ni de inversión.',
      ],
    },
    {
      heading: '5. Responsabilidad',
      paragraphs: [
        'El titular trabaja para que el servicio esté disponible y funcione correctamente, pero no garantiza la ausencia de interrupciones o errores. No responde de los daños derivados de un uso indebido del servicio ni de la exactitud de los datos que introduce cada usuario.',
      ],
    },
    {
      heading: '6. Legislación aplicable',
      paragraphs: [
        'Este aviso se rige por la legislación española. Si actúas como consumidor, serán competentes los juzgados y tribunales de tu domicilio.',
      ],
    },
  ],
}

const terms: LegalDoc = {
  slug: 'terms',
  title: 'Condiciones de uso',
  intro: 'Estas condiciones regulan el uso de saveToWin en savetowin.app. Al crear una cuenta, las aceptas.',
  sections: [
    {
      heading: '1. El servicio',
      paragraphs: [
        'saveToWin te permite registrar movimientos, organizarlos por cuentas y categorías, fijar límites y objetivos, importar los extractos de tu banco en CSV y ver estadísticas sobre tu dinero. No accede a tus bancos ni mueve dinero: solo trabaja con los datos que tú introduces.',
      ],
    },
    {
      heading: '2. Tu cuenta',
      list: [
        'Debes ser mayor de 18 años y dar un email que sea tuyo.',
        'Eres responsable de mantener tu contraseña en secreto. Te recomendamos activar la verificación en dos pasos.',
        'Si detectas un acceso no autorizado, cambia tu contraseña y escríbenos.',
      ],
    },
    {
      heading: '3. Planes',
      list: [
        'Plan gratuito: incluye las funciones principales. Puede limitar la visualización de gráficos y estadísticas a los últimos 60 días; tus datos se conservan siempre.',
        'Premium: añade historial completo, análisis avanzado, agrupaciones, consejos y el resumen anual.',
        'Precios y pago: se publicarán antes de habilitar el pago. Nunca se te cobrará nada sin tu aceptación expresa, y como consumidor conservarás tu derecho de desistimiento en los términos de la ley.',
      ],
    },
    {
      heading: '4. Tus datos y tu contenido',
      paragraphs: [
        'Los datos que introduces son tuyos. Nos das permiso únicamente para guardarlos y procesarlos con el fin de prestarte el servicio, tal y como se describe en la Política de privacidad. Puedes descargarlos o eliminarlos en cualquier momento desde tu perfil.',
      ],
    },
    {
      heading: '5. Uso aceptable',
      list: [
        'No uses el servicio para fines ilegales ni para almacenar datos de terceros sin su permiso.',
        'No intentes acceder a cuentas ajenas, saturar el servicio ni eludir sus medidas de seguridad o los límites de los planes.',
        'Podemos suspender o cerrar cuentas que incumplan estas condiciones, avisándote salvo que la gravedad lo impida.',
      ],
    },
    {
      heading: '6. Disponibilidad y copias de seguridad',
      paragraphs: [
        'Hacemos copias de seguridad periódicas, pero te recomendamos descargar de vez en cuando tu propia copia desde el perfil. El servicio puede interrumpirse puntualmente por mantenimiento o causas ajenas.',
      ],
    },
    {
      heading: '7. No es asesoramiento financiero',
      paragraphs: [
        'Las estadísticas y consejos son orientativos y se basan en tus datos. Las decisiones sobre tu dinero son tuyas.',
      ],
    },
    {
      heading: '8. Responsabilidad',
      paragraphs: [
        'En la medida en que la ley lo permita, el titular no responde de pérdidas derivadas del uso del servicio o de errores en los datos introducidos. Nada de lo anterior limita los derechos que te reconoce la normativa de protección de consumidores y usuarios.',
      ],
    },
    {
      heading: '9. Baja',
      paragraphs: ['Puedes dejar de usar saveToWin cuando quieras: «Eliminar cuenta», en tu perfil, borra tu cuenta y todos tus datos.'],
    },
    {
      heading: '10. Cambios y ley aplicable',
      paragraphs: [
        'Si cambiamos estas condiciones de forma relevante, te avisaremos con antelación en la app o por correo. Se rigen por la legislación española; si eres consumidor, serán competentes los juzgados de tu domicilio.',
      ],
    },
  ],
}

export const LEGAL_DOCS: LegalDoc[] = [privacy, cookies, notice, terms]
