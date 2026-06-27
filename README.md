# PokéBirthday

Invitación web personalizada con estética Pokémon, animaciones cinematográficas con GSAP, botones flotantes de RSVP y registro automático en Google Sheets.

Este paquete está reestructurado con formato limpio de **Angular CLI / ng new**:

- `src/app/app.ts`, `app.html`, `app.scss`, `app.config.ts`
- assets públicos en `public/assets`
- builder moderno `@angular/build:application`
- sin `baseUrl` en `tsconfig.json`
- sin `LucideAngularModule.pick(...)`

## Requisitos

Usa una versión de Node compatible con Angular 22:

```bash
nvm install 24.15.0
nvm use 24.15.0
```

También puedes usar Node `22.22.3` o superior dentro de la línea 22 LTS.

## Instalación

```bash
npm install
npm start
```

Abrir:

```text
http://localhost:4200/invitacion/bastian
```

Para probar desde celular en la misma red:

```bash
npm run start:network
```

## Personalización por invitado

La invitación ahora usa una ruta base, no query params.

```text
/invitacion/bastian
/invitacion/familia-ramos
/invitacion/thiago-ramos
```

También se conserva compatibilidad temporal con URLs antiguas como `/?invitado=Bastian`; cuando el invitado escribe su nombre desde el modal, la app actualiza la URL a `/invitacion/<guest-id>` sin recargar la página.

El `Guest ID` se genera automáticamente desde el nombre, sin espacios y sin tildes:

```text
Bastian          -> bastian
Familia Ramos   -> familia-ramos
Thiago Álvarez  -> thiago-alvarez
```

Si la ruta no trae invitado, por ejemplo `/` o `/invitacion`, primero se reproduce la intro cinematográfica y luego la web abre una pantalla para pedir el nombre antes de permitir confirmar asistencia.

## Configurar Google Sheets y WhatsApp

Los botones flotantes **Confirmar** y **No podré** registran la respuesta directamente en Google Sheets. WhatsApp queda como acción opcional después del registro.

Editar:

```text
src/environments/environment.ts
src/environments/environment.prod.ts
```

Ejemplo:

```ts
whatsappNumber: '51999999999',
openWhatsappAfterRegister: false,
googleSheets: {
  webAppUrl: 'https://script.google.com/macros/s/TU_DEPLOYMENT_ID/exec',
  token: 'POKE_BIRTHDAY_2026_RSVP'
}
```

Usa `openWhatsappAfterRegister: true` solo si quieres abrir WhatsApp después de guardar la respuesta en Google Sheets.

El backend de Apps Script está en:

```text
google-apps-script/Code.gs
```

Instrucciones completas:

```text
google-apps-script/README.md
```

## Comandos

```bash
npm start
npm run start:network
npm run build
npm run check
npm run lint:types
```

## Crear una copia realmente desde `ng new`

Este ZIP ya viene listo, pero también incluye un script para recrear el workspace desde Angular CLI y luego aplicar el código de PokéBirthday encima:

```bash
bash tools/recreate-from-ng-new.sh ../poke-birthday-from-ng-new
cd ../poke-birthday-from-ng-new
npm install
npm start
```

Ver más en `NG_NEW.md`.


## Patch aplicado

Esta versión también incluye el patch de corrección para Angular 22:

- Se eliminó `defaultProject` de `angular.json`.
- Se corrigieron rutas públicas de assets a `/assets/...`.
- Los botones flotantes registran RSVP en Google Sheets antes de cualquier acción opcional de WhatsApp.
- Se agregó estado visual de guardado/cargando en los botones.
- El registro usa JSONP para recibir respuesta real de Apps Script y evitar falsos positivos por `no-cors`.
- El `Guest ID` se calcula automáticamente desde el nombre del invitado.
- La URL personalizada usa `/invitacion/<guest-id>` en lugar de query params.
- El botón `Ver detalles` ahora hace scroll interno con `scrollIntoView`, sin cambiar la URL ni recargar la página.
- La intro cinematográfica incluye el asset `public/assets/characters/ash-trainer.png`.

## Si dice registrado pero no aparece en Google Sheets

1. En Apps Script ejecuta `debugConfig` y abre el `spreadsheetUrl` que aparece en el registro.
2. Revisa que `RSVP_TOKEN` en Script Properties sea igual al token de Angular.
3. Prueba manualmente el Web App URL con `?token=...&eventId=test&guestName=Bastian&status=SI_ASISTIRE`.
4. Si cambiaste `Code.gs`, publica una nueva versión de la implementación.


## Rutas de invitación

La base de ruta está en:

```ts
invitationBasePath: 'invitacion'
```

Puedes cambiarla en `src/environments/environment.ts` y `src/environments/environment.prod.ts`.

Ejemplos:

```text
/invitacion/bastian
/invitacion/thiago-ramos
/invitacion/familia-ramos
```

Para hosting estático, configura fallback/rewrite de todas las rutas hacia `index.html`, de modo que `/invitacion/bastian` cargue la app Angular correctamente.


## UX polish aplicado

Este patch agrega una experiencia más guiada para usuarios no técnicos: botón para saltar intro, tarjeta de bienvenida clara, modal de nombre más humano, botones flotantes con estado confirmado/no podré, acciones de ubicación y calendario con mejor microcopy, y prevención de doble registro accidental.
# poke-birthday-app
