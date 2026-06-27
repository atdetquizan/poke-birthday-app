# Base creada con Angular CLI / ng new

Comando recomendado para crear el workspace limpio:

```bash
npx -y @angular/cli@22.0.4 new poke-birthday \
  --standalone \
  --style scss \
  --routing false \
  --ssr false \
  --skip-tests \
  --skip-git \
  --package-manager npm \
  --defaults
```

Luego se reemplaza el código generado por Angular CLI con los archivos de esta invitación:

```text
src/app/app.ts
src/app/app.html
src/app/app.scss
src/app/app.config.ts
src/app/services/rsvp.service.ts
src/environments/*
public/assets/*
google-apps-script/*
```

También puedes usar el script incluido:

```bash
bash tools/recreate-from-ng-new.sh ../poke-birthday-from-ng-new
```

## Por qué esta versión evita los errores anteriores

- No usa `baseUrl`, por lo tanto evita el error `TS5101` de TypeScript 6.
- Usa `@angular/build:application` y `@angular/build:dev-server`.
- Usa `@lucide/angular` con iconos standalone:

```ts
imports: [LucideCalendar, LucideCircleCheck]
```

```html
<svg lucideCalendar></svg>
<svg lucideCircleCheck></svg>
```

- No usa `LucideAngularModule.pick(...)` dentro de `imports` del componente.
- Mantiene `--routing false` porque la ruta personalizada `/invitacion/<guest-id>` se resuelve con History API y lectura de `window.location.pathname`; así evitamos agregar dependencias extra y el botón `Ver detalles` solo hace scroll interno.
