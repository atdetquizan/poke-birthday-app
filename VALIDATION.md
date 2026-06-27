# Validación aplicada

## Estado del entorno de generación

En este entorno no fue posible ejecutar `npx @angular/cli@22.0.4 new ...` porque la resolución DNS hacia `registry.npmjs.org` falló con `EAI_AGAIN`.

Por eso el paquete se entregó con estructura equivalente a un proyecto generado por Angular CLI y con un script reproducible: `tools/recreate-from-ng-new.sh`.

## Checks estáticos realizados

- `tsconfig.json` no contiene `baseUrl`.
- `angular.json` usa `@angular/build:application`.
- `angular.json` usa `@angular/build:dev-server`.
- `package.json` usa Angular 22 y TypeScript 6.
- `src/app/app.ts` usa `@lucide/angular`, no `lucide-angular`.
- No existe `LucideAngularModule.pick(...)`.
- Los assets se sirven desde `public/assets`, como en una base nueva de Angular CLI.
- La invitación resuelve rutas `/invitacion/<guest-id>` desde `window.location.pathname`.
- El botón `Ver detalles` no usa `href`; ejecuta scroll interno con `scrollIntoView`.

## Validación local recomendada

```bash
node -v
npm install
npm run lint:types
npm run build
npm start
```

Usa Node `24.15.0` o `22.22.3+` dentro de la línea 22.


## Cambios de este patch

- Eliminado `defaultProject` del workspace para evitar `Workspace extension with invalid name`.
- Corregido `src/styles.scss` para usar `/assets/bg/poke-world-blur.webp`.
- Corregidos `src` de imágenes del HTML a `/assets/...`.
- `RsvpService.register()` ahora registra de forma asíncrona en Google Sheets usando Apps Script.
- Los botones flotantes quedan deshabilitados mientras se envía la respuesta y muestran estado de guardado.
- WhatsApp queda controlado por `openWhatsappAfterRegister`.
- Se agregó `invitationBasePath: 'invitacion'` a los environments.
- Las URLs antiguas con `?invitado=` o `?invitacion=` quedan como fallback temporal.

No se ejecutó `npm install` ni `ng build` en este entorno porque no hay dependencias instaladas. Valida localmente con Node compatible.
