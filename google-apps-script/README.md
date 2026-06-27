# Registro de asistencia en Google Sheets

Este backend liviano guarda las respuestas de la invitación en Google Sheets usando Google Apps Script.

## 1. Crear o abrir Google Sheet

Opción A, recomendada: abre una hoja de Google Sheets existente y ve a **Extensiones > Apps Script**. Así el registro quedará en esa misma hoja.

Opción B: crea un proyecto nuevo de Apps Script. La función `setup()` creará una hoja llamada `RSVP PokeBirthday` si no encuentra una hoja activa. En ese caso debes abrir el spreadsheet creado con el `SPREADSHEET_ID` de las propiedades del script.

## 2. Pegar el código

Copia el contenido de `Code.gs` en el editor de Apps Script.

## 3. Configurar propiedades del script

En Apps Script ve a **Configuración del proyecto > Propiedades de la secuencia de comandos** y agrega:

- `SPREADSHEET_ID`: ID de tu Google Sheet.
- `SHEET_NAME`: `RSVP`, opcional.
- `RSVP_TOKEN`: token privado, por ejemplo `POKE_BIRTHDAY_2026_RSVP`.

El mismo token debe ir en Angular:

```ts
// src/environments/environment.ts
googleSheets: {
  webAppUrl: 'URL_DE_TU_WEB_APP',
  token: 'POKE_BIRTHDAY_2026_RSVP'
}
```

Importante: si ejecutaste `setup()` antes de cambiar `DEFAULT_TOKEN`, la propiedad `RSVP_TOKEN` puede haberse quedado como `CAMBIA_ESTE_TOKEN`. Cámbiala manualmente en las propiedades del script.

## 4. Ejecutar setup y verificar destino

Selecciona la función `setup` y presiona **Ejecutar**.

Después selecciona `debugConfig` y presiona **Ejecutar**. En **Registro de ejecución** verás algo como:

```json
{
  "spreadsheetId": "...",
  "spreadsheetUrl": "https://docs.google.com/spreadsheets/d/.../edit",
  "sheetName": "RSVP",
  "sheetLastRow": 1,
  "tokenConfigured": true
}
```

Abre ese `spreadsheetUrl`. Ese es el archivo real donde se guardarán las respuestas.

## 5. Publicar como Web App

En Apps Script:

1. **Implementar > Nueva implementación**.
2. Tipo: **Aplicación web**.
3. Ejecutar como: **Yo**.
4. Acceso: **Cualquier persona**.
5. Copia el Web App URL que termina en `/exec` y pégalo en `googleSheets.webAppUrl`.

Cada vez que cambies `Code.gs`, debes hacer **Administrar implementaciones > Editar > Nueva versión > Implementar**.

## 6. Probar manualmente el endpoint

Abre esta URL cambiando `TU_WEB_APP_URL` y el token:

```text
TU_WEB_APP_URL?token=POKE_BIRTHDAY_2026_RSVP&eventId=test&guestName=Bastian&status=SI_ASISTIRE&source=manual
```

Debe responder JSON con `ok: true` y debe aparecer una fila en la hoja `RSVP`.

## 7. Probar desde Angular

Abre la invitación con:

```text
http://localhost:4200/invitacion/bastian
```

Presiona **Confirmar** o **No podré**. El script crea o actualiza una fila en la hoja `RSVP` usando `eventId + guestId` o `eventId + invitado` como clave.

Nota: Angular usa JSONP contra `doGet` para poder recibir una respuesta real de Apps Script desde el navegador. Si el token está mal o faltan datos, el front mostrará el error en lugar de mostrar un falso éxito.
