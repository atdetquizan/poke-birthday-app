import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { AttendanceStatus, RsvpPayload, RsvpRegisterResult } from '../app.types';

interface AppsScriptRsvpResponse {
  ok?: boolean;
  error?: string;
  action?: 'created' | 'updated';
  savedAt?: string;
  row?: number;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  sheetName?: string;
}

@Injectable({ providedIn: 'root' })
export class RsvpService {
  async register(payload: RsvpPayload): Promise<RsvpRegisterResult> {
    const endpoint = environment.googleSheets.webAppUrl.trim();

    if (!endpoint) {
      this.storePending(payload, 'MISSING_ENDPOINT');
      return { submitted: false, transport: 'disabled', reason: 'MISSING_ENDPOINT' };
    }

    const request = {
      token: environment.googleSheets.token,
      eventId: payload.eventId,
      guestName: payload.guestName,
      guestId: payload.guestId || this.createGuestId(payload.guestName),
      status: payload.status,
      source: payload.source,
      pageUrl: payload.pageUrl,
      userAgent: payload.userAgent,
      createdAt: new Date().toISOString()
    };

    try {
      const response = await this.sendWithJsonp(endpoint, request);

      if (response.ok) {
        return {
          submitted: true,
          transport: 'jsonp',
          action: response.action,
          row: response.row,
          savedAt: response.savedAt,
          spreadsheetUrl: response.spreadsheetUrl,
          sheetName: response.sheetName
        };
      }

      const reason = response.error || 'APP_SCRIPT_ERROR';
      this.storePending(payload, reason);
      return { submitted: false, transport: 'jsonp', reason };
    } catch (error) {
      const reason = error instanceof DOMException && error.name === 'TimeoutError'
        ? 'TIMEOUT'
        : error instanceof Error
          ? error.message
          : 'NETWORK_ERROR';

      this.storePending(payload, reason);
      return { submitted: false, transport: 'jsonp', reason };
    }
  }

  buildWhatsappUrl(status: AttendanceStatus, guestName: string): string {
    const template = status === 'SI_ASISTIRE' ? environment.messages.yes : environment.messages.no;
    const message = template.replace('{invitado}', guestName);
    const encoded = encodeURIComponent(message);
    const number = environment.whatsappNumber.replace(/\D/g, '');

    return number ? `https://wa.me/${number}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  }

  private createGuestId(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);
  }

  private sendWithJsonp(endpoint: string, payload: Record<string, string>): Promise<AppsScriptRsvpResponse> {
    return new Promise((resolve, reject) => {
      const callbackName = `__pokeBirthdayRsvp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new DOMException('Google Sheets no respondio a tiempo.', 'TimeoutError'));
      }, 8000);

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        delete (window as unknown as Record<string, unknown>)[callbackName];
        script.remove();
      };

      (window as unknown as Record<string, (response: AppsScriptRsvpResponse) => void>)[callbackName] = (response) => {
        cleanup();
        resolve(response);
      };

      const url = new URL(endpoint);
      url.searchParams.set('callback', callbackName);

      Object.entries(payload).forEach(([key, value]) => {
        url.searchParams.set(key, value ?? '');
      });

      script.onerror = () => {
        cleanup();
        reject(new Error('No se pudo conectar con Google Apps Script.'));
      };

      script.async = true;
      script.src = url.toString();
      document.head.appendChild(script);
    });
  }

  private storePending(payload: RsvpPayload, reason: string): void {
    try {
      const key = 'pokeBirthdayPendingRsvp';
      const raw = window.localStorage.getItem(key);
      const pending = raw ? JSON.parse(raw) as unknown[] : [];
      pending.push({ ...payload, reason, createdAt: new Date().toISOString() });
      window.localStorage.setItem(key, JSON.stringify(pending.slice(-10)));
    } catch {
      // No bloqueamos la experiencia si localStorage no esta disponible.
    }
  }
}
