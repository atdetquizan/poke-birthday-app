const DEFAULT_SHEET_NAME = 'RSVP';
const DEFAULT_TOKEN = 'CAMBIA_ESTE_TOKEN';
const HEADERS = [
  'Fecha registro',
  'Fecha actualizacion',
  'Event ID',
  'Invitado',
  'Guest ID',
  'Estado',
  'Origen',
  'Pagina',
  'User Agent'
];

function setup() {
  const props = PropertiesService.getScriptProperties();
  let spreadsheetId = props.getProperty('SPREADSHEET_ID');

  if (!spreadsheetId) {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    const spreadsheet = active || SpreadsheetApp.create('RSVP PokeBirthday');
    spreadsheetId = spreadsheet.getId();
    props.setProperty('SPREADSHEET_ID', spreadsheetId);
  }

  if (!props.getProperty('RSVP_TOKEN')) {
    props.setProperty('RSVP_TOKEN', DEFAULT_TOKEN);
  }

  const sheet = getSheet_();
  ensureHeaders_(sheet);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, HEADERS.length);

  const info = getDebugInfo_();
  Logger.log(JSON.stringify(info, null, 2));
  return `Setup listo. Abre ${info.spreadsheetUrl}. Sheet=${info.sheetName}. Revisa RSVP_TOKEN antes de publicar.`;
}

function debugConfig() {
  const info = getDebugInfo_();
  Logger.log(JSON.stringify(info, null, 2));
  return info;
}

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const result = handleRequest_(params);

  if (params.callback) {
    return jsonp_(result, params.callback);
  }

  return json_(result);
}

function doPost(e) {
  let payload = {};

  try {
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }
  } catch (error) {
    payload = e && e.parameter ? e.parameter : {};
  }

  return json_(handleRequest_(payload));
}

function handleRequest_(params) {
  const props = PropertiesService.getScriptProperties();
  const expectedToken = props.getProperty('RSVP_TOKEN') || DEFAULT_TOKEN;

  if (expectedToken && params.token !== expectedToken) {
    return { ok: false, error: 'TOKEN_INVALIDO' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSheet_();
    ensureHeaders_(sheet);

    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    const eventId = truncate_(params.eventId, 120);
    const guestName = truncate_(params.guestName, 160);
    const guestId = truncate_(params.guestId || createGuestId_(guestName), 120);
    const status = normalizeStatus_(params.status);

    if (!eventId || !guestName || !status) {
      return { ok: false, error: 'DATOS_INCOMPLETOS' };
    }

    const rowData = [
      now,
      now,
      eventId,
      guestName,
      guestId,
      status,
      truncate_(params.source, 120),
      truncate_(params.pageUrl, 500),
      truncate_(params.userAgent, 500)
    ];

    const existingRow = findExistingRow_(sheet, eventId, guestId, guestName);
    const spreadsheet = sheet.getParent();

    if (existingRow > 0) {
      const createdAt = sheet.getRange(existingRow, 1).getValue() || now;
      rowData[0] = createdAt;
      sheet.getRange(existingRow, 1, 1, HEADERS.length).setValues([rowData]);
      SpreadsheetApp.flush();
      return {
        ok: true,
        action: 'updated',
        savedAt: now,
        row: existingRow,
        spreadsheetId: spreadsheet.getId(),
        spreadsheetUrl: spreadsheet.getUrl(),
        sheetName: sheet.getName()
      };
    }

    sheet.appendRow(rowData);
    SpreadsheetApp.flush();
    return {
      ok: true,
      action: 'created',
      savedAt: now,
      row: sheet.getLastRow(),
      spreadsheetId: spreadsheet.getId(),
      spreadsheetUrl: spreadsheet.getUrl(),
      sheetName: sheet.getName()
    };
  } catch (error) {
    return { ok: false, error: String(error) };
  } finally {
    lock.releaseLock();
  }
}

function findExistingRow_(sheet, eventId, guestId, guestName) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();

  for (let index = 0; index < values.length; index += 1) {
    const row = values[index];
    const rowEventId = String(row[2] || '').trim();
    const rowGuestName = String(row[3] || '').trim().toLowerCase();
    const rowGuestId = String(row[4] || '').trim();

    const sameEvent = rowEventId === eventId;
    const sameGuestById = guestId && rowGuestId === guestId;
    const sameGuestByName = !guestId && rowGuestName === guestName.toLowerCase();

    if (sameEvent && (sameGuestById || sameGuestByName)) {
      return index + 2;
    }
  }

  return -1;
}

function getSheet_() {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty('SPREADSHEET_ID');
  const sheetName = props.getProperty('SHEET_NAME') || DEFAULT_SHEET_NAME;

  const spreadsheet = spreadsheetId
    ? SpreadsheetApp.openById(spreadsheetId)
    : SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error('No hay Spreadsheet activo. Ejecuta setup() o configura SPREADSHEET_ID.');
  }

  return spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
}

function getDebugInfo_() {
  const props = PropertiesService.getScriptProperties();
  const sheet = getSheet_();
  const spreadsheet = sheet.getParent();

  return {
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl(),
    sheetName: sheet.getName(),
    sheetLastRow: sheet.getLastRow(),
    tokenConfigured: Boolean(props.getProperty('RSVP_TOKEN')),
    tokenIsDefault: (props.getProperty('RSVP_TOKEN') || DEFAULT_TOKEN) === DEFAULT_TOKEN,
    sheetNameProperty: props.getProperty('SHEET_NAME') || DEFAULT_SHEET_NAME
  };
}

function repairSheetLayout() {
  const sheet = getSheet_();
  ensureHeaders_(sheet);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, HEADERS.length);

  const info = getDebugInfo_();
  Logger.log(JSON.stringify(info, null, 2));
  return `Layout corregido. Estado debe quedar en columna F. Abre ${info.spreadsheetUrl}.`;
}

function ensureHeaders_(sheet) {
  const currentHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0]
    .map((cell) => String(cell || '').trim());
  const expectedHeaders = HEADERS.map((header) => String(header || '').trim());
  const needsUpdate = currentHeaders.some((value, index) => value !== expectedHeaders[index]);

  if (needsUpdate) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }

  sheet.getRange(1, 1, 1, HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#0b1f3a')
    .setFontColor('#ffffff');
}

function normalizeStatus_(value) {
  const status = String(value || '').trim().toUpperCase();
  if (status === 'SI_ASISTIRE' || status === 'NO_PODRE') return status;
  return '';
}

function createGuestId_(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function truncate_(value, maxLength) {
  return String(value || '').slice(0, maxLength);
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonp_(data, callback) {
  const safeCallback = String(callback || '').replace(/[^a-zA-Z0-9_$\.]/g, '');

  if (!safeCallback) {
    return json_({ ok: false, error: 'CALLBACK_INVALIDO' });
  }

  return ContentService
    .createTextOutput(`${safeCallback}(${JSON.stringify(data)});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
