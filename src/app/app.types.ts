export type AttendanceStatus = 'SI_ASISTIRE' | 'NO_PODRE';

export interface RsvpPayload {
  eventId: string;
  guestName: string;
  guestId: string;
  status: AttendanceStatus;
  source: string;
  pageUrl: string;
  userAgent: string;
}

export type RsvpTransport = 'jsonp' | 'disabled';

export interface RsvpRegisterResult {
  submitted: boolean;
  transport: RsvpTransport;
  reason?: string;
  action?: 'created' | 'updated';
  row?: number;
  savedAt?: string;
  spreadsheetUrl?: string;
  sheetName?: string;
}
