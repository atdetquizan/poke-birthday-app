import { CommonModule, DOCUMENT } from '@angular/common';
import { AfterViewInit, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import {
  LucideArrowUpRight,
  LucideCalendar,
  LucideCalendarPlus,
  LucideCar,
  LucideCircleCheck,
  LucideCircleX,
  LucideClock,
  LucideDownload,
  LucideMapPin
} from '@lucide/angular';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { environment } from '../environments/environment';
import { AttendanceStatus, RsvpPayload } from './app.types';
import { RsvpService } from './services/rsvp.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    LucideArrowUpRight,
    LucideCalendar,
    LucideCalendarPlus,
    LucideCar,
    LucideCircleCheck,
    LucideCircleX,
    LucideClock,
    LucideDownload,
    LucideMapPin
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, AfterViewInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly rsvp = inject(RsvpService);

  readonly guestName = signal('');
  readonly guestId = signal('');
  readonly guestNameDraft = signal('');
  readonly guestDisplayName = computed(() => this.guestName() || 'Entrenador invitado');
  readonly previewGuestId = computed(() => this.createGuestId(this.guestNameDraft()));
  readonly needsGuestName = signal(false);
  readonly introFinished = signal(false);
  readonly guestNamePromptVisible = computed(() => this.needsGuestName() && this.introFinished());
  readonly toastVisible = signal(false);
  readonly toastTitle = signal('');
  readonly toastMessage = signal('');
  readonly isSubmitting = signal(false);
  readonly selectedStatus = signal<AttendanceStatus | undefined>(undefined);
  readonly lastSaved = signal(false);
  readonly savedStatus = signal<AttendanceStatus | undefined>(undefined);
  readonly guestNamePromptShake = signal(false);
  readonly pendingGuestNameAction = signal<AttendanceStatus | undefined>(undefined);
  readonly guestNamePromptStatus = computed<AttendanceStatus>(() => this.pendingGuestNameAction() || 'SI_ASISTIRE');
  readonly guestNamePromptIsDecline = computed(() => this.guestNamePromptStatus() === 'NO_PODRE');
  readonly guestNamePromptKicker = computed(() => this.guestNamePromptIsDecline() ? 'Avisar que no asistirás' : 'Confirmar asistencia');
  readonly guestNamePromptTitle = computed(() => this.guestNamePromptIsDecline() ? '¿A nombre de quién avisamos?' : '¿A nombre de quién confirmamos?');
  readonly guestNamePromptDescription = computed(() => this.guestNamePromptIsDecline()
    ? 'Escribe tu nombre y al continuar registraremos que no podrás asistir.'
    : 'Escribe tu nombre y al continuar confirmaremos tu asistencia automáticamente.');
  readonly guestNamePromptSubmitLabel = computed(() => {
    if (this.isSubmitting()) return 'Registrando...';
    return this.guestNamePromptIsDecline() ? 'Continuar y avisar' : 'Continuar y confirmar';
  });
  readonly responseSaved = computed(() => !!this.savedStatus());
  readonly responseStatusLabel = computed(() => {
    const status = this.savedStatus();
    if (status === 'SI_ASISTIRE') return `Confirmado: ${this.guestDisplayName()}`;
    if (status === 'NO_PODRE') return `Respuesta guardada: ${this.guestDisplayName()} no podrá asistir`;
    return '';
  });
  readonly responseSavedTitle = computed(() => {
    const status = this.savedStatus();
    if (status === 'SI_ASISTIRE') return 'Asistencia confirmada';
    if (status === 'NO_PODRE') return 'Respuesta guardada';
    return '';
  });
  readonly responseSavedMessage = computed(() => {
    const status = this.savedStatus();
    if (status === 'SI_ASISTIRE') return `${this.guestDisplayName()}, tu asistencia quedó registrada correctamente.`;
    if (status === 'NO_PODRE') return `${this.guestDisplayName()}, registramos que no podrás asistir.`;
    return '';
  });

  readonly birthdayName = environment.birthdayName;
  readonly birthdayAge = environment.birthdayAge;
  readonly event = environment.event;
  readonly mapUrl = `https://www.google.com/maps/place/Los+Tamarindos+12,+Lima+15048/@-12.1345319,-76.9988394,20.63z/data=!4m10!1m2!2m1!1s*2ADirecci%C3%B3n+para+taxi+app:+Los+Tamarindos+12!3m6!1s0x9105b80f55ad3379:0x8c9ad0db9d6f5735!8m2!3d-12.1345619!4d-76.9986834!15sCiwqRGlyZWNjacOzbiBwYXJhIHRheGkgYXBwOiBMb3MgVGFtYXJpbmRvcyAxMpIBEWNvbXBvdW5kX2J1aWxkaW5n4AEA!16s%2Fg%2F11j37dhcp6!5m1!1e1?entry=ttu&g_ep=EgoyMDI2MDYyNC4wIKXMDSoASAFQAw%3D%3D`;

  private readonly cleanupFns: Array<() => void> = [];
  private toastTimer?: number;
  private introTimeline?: gsap.core.Timeline;

  ngOnInit(): void {
    const guestName = this.resolveGuestFromRoute();

    if (guestName) {
      this.applyGuestName(guestName, this.hasLegacyGuestQuery());
      this.needsGuestName.set(false);
      return;
    }

    this.pendingGuestNameAction.set('SI_ASISTIRE');
    this.needsGuestName.set(true);
    this.updateDocumentMeta('Invitado');
  }

  ngAfterViewInit(): void {
    window.setTimeout(() => this.initAnimations(), 0);
  }

  ngOnDestroy(): void {
    this.introTimeline?.kill();
    this.cleanupFns.forEach((cleanup) => cleanup());
    this.cleanupFns.length = 0;
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    this.document.body.classList.remove('is-ready', 'intro-finished', 'dock-visible', 'gsap-missing');
  }

  skipIntro(): void {
    this.introTimeline?.kill();
    this.revealInvitationInstantly();
  }

  openGuestNamePrompt(status: AttendanceStatus = 'SI_ASISTIRE'): void {
    this.pendingGuestNameAction.set(status);
    this.needsGuestName.set(true);
    this.focusGuestNameInput();
  }

  confirmAttendance(): void {
    void this.submitAttendance('SI_ASISTIRE');
  }

  declineAttendance(): void {
    void this.submitAttendance('NO_PODRE');
  }

  onGuestNameInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.guestNameDraft.set(this.sanitizeDraft(input?.value || ''));
  }

  async saveGuestNameFromPrompt(): Promise<void> {
    const name = this.clean(this.guestNameDraft());

    if (!name) {
      this.showToast('Agrega tu nombre', 'Escribe un nombre para registrar la asistencia.');
      this.shakeGuestNamePanel();
      return;
    }

    const statusToSubmit = this.pendingGuestNameAction() || 'SI_ASISTIRE';
    this.applyGuestName(name, true);
    this.needsGuestName.set(false);
    this.pendingGuestNameAction.set(undefined);

    this.animateGuestNameApplied();
    await this.submitAttendance(statusToSubmit, { skipNamePrompt: true });
  }

  saveGuestNameOnlyFromPrompt(): void {
    const name = this.clean(this.guestNameDraft());

    if (!name) {
      this.showToast('Agrega tu nombre', 'Escribe tu nombre para personalizar la invitación.');
      this.shakeGuestNamePanel();
      return;
    }

    this.applyGuestName(name, true);
    this.needsGuestName.set(false);
    this.pendingGuestNameAction.set(undefined);
    this.animateGuestNameApplied();
    this.showToast('Invitación personalizada', `${name}, ya puedes revisar los detalles y confirmar cuando estés listo.`);
  }


  private animateGuestNameApplied(): void {
    window.setTimeout(() => {
      gsap.fromTo(
        '.guest-card, .welcome-card',
        { scale: 0.96, y: 12 },
        { scale: 1, y: 0, duration: 0.35, ease: 'back.out(1.7)' }
      );
    }, 0);
  }

  private async submitAttendance(status: AttendanceStatus, options: { skipNamePrompt?: boolean } = {}): Promise<void> {
    if (this.isSubmitting()) return;

    const guestName = this.clean(this.guestName());

    if (!guestName) {
      if (!options.skipNamePrompt) {
        this.openGuestNamePrompt(status);
        this.showToast(
          status === 'SI_ASISTIRE' ? 'Completa tu nombre' : 'Completa tu nombre',
          status === 'SI_ASISTIRE'
            ? 'Escribe tu nombre y al continuar confirmaremos tu asistencia.'
            : 'Escribe tu nombre y al continuar registraremos que no podrás asistir.'
        );
        this.shakeGuestNamePanel();
      }
      return;
    }

    const guestId = this.createGuestId(guestName);
    this.guestId.set(guestId);

    const payload: RsvpPayload = {
      eventId: environment.eventId,
      guestName,
      guestId,
      status,
      source: 'angular-gsap-invitation',
      pageUrl: window.location.href,
      userAgent: window.navigator.userAgent
    };

    const isYes = status === 'SI_ASISTIRE';
    const buttonSelector = isYes ? '#dockConfirm' : '#dockDecline';

    this.isSubmitting.set(true);
    this.selectedStatus.set(status);
    this.lastSaved.set(false);

    gsap.fromTo(
      buttonSelector,
      { scale: 1 },
      { scale: 0.96, duration: 0.08, yoyo: true, repeat: 1, ease: 'power1.inOut' }
    );

    const result = await this.rsvp.register(payload);

    this.isSubmitting.set(false);
    this.lastSaved.set(result.submitted);

    if (result.submitted) {
      this.savedStatus.set(status);
      if (isYes) this.fireConfetti();

      this.announceSavedResponse(status, guestName);

      if (environment.openWhatsappAfterRegister) {
        const url = this.rsvp.buildWhatsappUrl(status, guestName);
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } else {
      this.showToast(
        this.getRsvpErrorTitle(result.reason),
        this.getRsvpErrorMessage(result.reason)
      );
    }

    window.setTimeout(() => {
      this.selectedStatus.set(undefined);
      this.lastSaved.set(false);
    }, 1800);
  }


  private announceSavedResponse(status: AttendanceStatus, guestName: string): void {
    const isYes = status === 'SI_ASISTIRE';

    this.showToast(
      isYes ? '¡Confirmado!' : 'Respuesta guardada',
      isYes
        ? `Gracias, ${guestName}. Tu asistencia quedó registrada.`
        : `Gracias, ${guestName}. Registramos que no podrás asistir.`
    );

    window.setTimeout(() => {
      gsap.fromTo(
        '.dock-confirmed',
        { y: 10, opacity: 0, scale: 0.96 },
        { y: 0, opacity: 1, scale: 1, duration: 0.38, ease: 'back.out(1.7)' }
      );
    }, 0);
  }

  private getRsvpErrorTitle(reason?: string): string {
    if (reason === 'MISSING_ENDPOINT') return 'Falta configurar Google Sheets';
    if (reason === 'TOKEN_INVALIDO') return 'Token inválido';
    if (reason === 'DATOS_INCOMPLETOS') return 'Datos incompletos';
    return 'No se pudo registrar';
  }

  private getRsvpErrorMessage(reason?: string): string {
    if (reason === 'MISSING_ENDPOINT') return 'Agrega el Web App URL en environment.googleSheets.webAppUrl.';
    if (reason === 'TOKEN_INVALIDO') return 'El token de Angular no coincide con RSVP_TOKEN en Apps Script.';
    if (reason === 'DATOS_INCOMPLETOS') return 'Falta eventId, invitado o estado de asistencia.';
    return 'La respuesta quedó guardada localmente como pendiente. Revisa Apps Script y vuelve a intentar.';
  }

  scrollToDetails(): void {
    const details = this.document.getElementById('detalles');
    if (!details) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    details.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
  }

  private resolveGuestFromRoute(): string {
    const routeGuest = this.resolveGuestFromPath(window.location.pathname);
    if (routeGuest) return routeGuest;

    const params = new URLSearchParams(window.location.search);
    const legacyGuest = this.clean(params.get('invitado') || params.get('invitacion'));

    return legacyGuest || this.clean(environment.defaultGuestName);
  }

  private hasLegacyGuestQuery(): boolean {
    const params = new URLSearchParams(window.location.search);
    return !!this.clean(params.get('invitado') || params.get('invitacion'));
  }

  private resolveGuestFromPath(pathname: string): string {
    const baseParts = this.getInvitationBaseParts();
    const pathParts = this.safeDecode(pathname)
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean);

    if (!baseParts.length) return '';

    const hasBasePath = baseParts.every((part, index) => pathParts[index]?.toLowerCase() === part.toLowerCase());
    if (!hasBasePath) return '';

    return this.nameFromRouteSegment(pathParts[baseParts.length] || '');
  }

  private nameFromRouteSegment(value: string): string {
    const decoded = this.safeDecode(value || '');
    const normalized = this.clean(decoded.replace(/[-_]+/g, ' '));
    if (!normalized) return '';

    const hasExplicitCase = /[A-ZÁÉÍÓÚÑ]/.test(normalized);
    return hasExplicitCase ? normalized : this.toTitleCase(normalized);
  }

  private toTitleCase(value: string): string {
    return value
      .toLowerCase()
      .split(' ')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private getInvitationBaseParts(): string[] {
    return String(environment.invitationBasePath || 'invitacion')
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean);
  }

  private buildInvitationPath(guestId: string): string {
    const base = this.getInvitationBaseParts().join('/');
    return `/${base}${guestId ? `/${encodeURIComponent(guestId)}` : ''}`;
  }

  private safeDecode(value: string): string {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  private applyGuestName(name: string, syncUrl: boolean): void {
    const cleanName = this.clean(name);
    const generatedGuestId = this.createGuestId(cleanName);

    this.guestName.set(cleanName);
    this.guestNameDraft.set(cleanName);
    this.guestId.set(generatedGuestId);
    this.updateDocumentMeta(cleanName || 'Invitado');

    if (syncUrl && cleanName) {
      const url = new URL(window.location.href);
      url.pathname = this.buildInvitationPath(generatedGuestId);
      url.search = '';
      url.hash = '';
      window.history.replaceState({}, '', url.toString());
    }
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

  private sanitizeDraft(value: string | null): string {
    return String(value || '').replace(/[<>]/g, '').replace(/\s+/g, ' ');
  }

  private clean(value: string | null): string {
    return this.sanitizeDraft(value).trim();
  }

  private updateDocumentMeta(guestName: string): void {
    this.title.setTitle(`Invitación para ${guestName} | Poké-Cumpleaños de ${environment.birthdayName}`);
    this.meta.updateTag({ name: 'description', content: `Invitación personalizada para ${guestName} al Poké-Cumpleaños de ${environment.birthdayName}.` });
    this.meta.updateTag({ property: 'og:title', content: `${guestName}, estás invitado al Poké-Cumpleaños` });
    this.meta.updateTag({ property: 'og:description', content: 'Confirma tu asistencia a la aventura.' });
  }

  private showToast(title: string, message: string): void {
    this.toastTitle.set(title);
    this.toastMessage.set(message);
    this.toastVisible.set(true);

    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastVisible.set(false), 3200);
  }

  private shakeGuestNamePanel(): void {
    this.guestNamePromptShake.set(false);
    window.requestAnimationFrame(() => {
      this.guestNamePromptShake.set(true);
      window.setTimeout(() => this.guestNamePromptShake.set(false), 520);
    });
  }

  private focusGuestNameInput(): void {
    if (!this.needsGuestName()) return;

    window.setTimeout(() => {
      this.document.querySelector<HTMLInputElement>('.guest-name-field input')?.focus();
    }, 120);
  }

  private splitText(): void {
    this.document.querySelectorAll<HTMLElement>('.split-me').forEach((node) => {
      if (node.dataset['splitted'] === 'true') return;
      const text = node.textContent || '';
      node.setAttribute('aria-label', text);
      node.textContent = '';

      [...text].forEach((char) => {
        const span = this.document.createElement('span');
        span.className = 'split-char';
        span.setAttribute('aria-hidden', 'true');
        span.innerHTML = char === ' ' ? '&nbsp;' : char;
        node.appendChild(span);
      });

      node.dataset['splitted'] = 'true';
    });
  }

  private finishIntroWithoutMotion(): void {
    this.revealInvitationInstantly();
    this.document.getElementById('trailerIntro')?.remove();
  }

  private revealInvitationInstantly(): void {
    this.splitText();
    this.document.body.classList.add('is-ready', 'intro-finished', 'dock-visible');
    this.introFinished.set(true);

    gsap.set('#trailerIntro', { autoAlpha: 0, display: 'none' });
    gsap.set('.page-bg, .hero-reveal, .split-char, .pokemon-wordmark, .reveal-card, .sticker, .sticker-ball, .mission-section.reveal-item, .details-section .reveal-item, .detail-card .icon-box, .action-link, .action-link .link-icon, .mobile-dock.floating-rsvp .dock-btn, .dock-btn .btn-icon', { clearProps: 'all' });
    gsap.set('.wordmark-underline', { strokeDashoffset: 0 });

    this.focusGuestNameInput();
  }

  private initAnimations(): void {
    this.splitText();
    this.document.body.classList.add('is-ready');

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      this.finishIntroWithoutMotion();
      return;
    }

    gsap.registerPlugin(ScrollTrigger);
    gsap.config({ nullTargetWarn: false });

    const dockBtnSet = { y: 18, scale: 0.94, filter: 'brightness(.82) blur(5px)' };

    gsap.set('.trailer-copy > *, .trailer-hud > *', { y: 46, opacity: 0, filter: 'blur(10px)' });
    gsap.set('.trailer-skip', { y: -12, opacity: 0 });
    gsap.set('.trailer-energy i', { scaleX: 0, opacity: 0, transformOrigin: '0% 50%' });
    gsap.set('.trailer-character', { x: 260, y: 42, scale: 0.72, rotation: 7, opacity: 0, filter: 'blur(12px)' });
    gsap.set('.trailer-ash-shadow', { scaleX: 0.42, opacity: 0 });
    gsap.set('.trailer-throw-ball', { x: 132, y: 118, scale: 0.22, rotation: -260, opacity: 0, filter: 'blur(6px)' });
    gsap.set('.trailer-burst', { scale: 0.2, opacity: 0, rotation: -20 });
    gsap.set('.line-a', { xPercent: -115 });
    gsap.set('.line-b', { xPercent: 115 });
    gsap.set('.page-bg', { scale: 1.18, filter: 'brightness(.46) saturate(1.35)' });
    gsap.set('.split-char', { y: 90, rotateX: -60, opacity: 0, transformOrigin: '50% 100%', transformPerspective: 900 });
    gsap.set('.pokemon-wordmark', { y: 96, scale: 0.56, rotationX: -28, rotation: -8, opacity: 0, filter: 'blur(12px)', transformOrigin: '50% 60%', transformPerspective: 900 });
    gsap.set('.wordmark-shine', { x: -360, opacity: 0.12 });
    gsap.set('.wordmark-underline', { strokeDasharray: 1, strokeDashoffset: 1 });
    gsap.set('.hero-reveal', { y: 38, opacity: 0, filter: 'blur(8px)' });
    gsap.set('.reveal-card', { y: 126, scale: 0.62, rotationY: -18, rotation: -12, opacity: 0, filter: 'blur(16px)', transformPerspective: 900, transformOrigin: '50% 70%' });
    gsap.set('.sticker-bulbasaur', { x: -90, y: 40, scale: 0.28, rotation: -28, opacity: 0, filter: 'blur(10px)' });
    gsap.set('.sticker-pika', { x: -90, y: 40, scale: 0.28, rotation: -28, opacity: 0, filter: 'blur(10px)' });
    gsap.set('.sticker-squirtle', { x: 84, y: -42, scale: 0.28, rotation: 24, opacity: 0, filter: 'blur(10px)' });
    gsap.set('.sticker-charmander', { x: 92, y: 58, scale: 0.28, rotation: 26, opacity: 0, filter: 'blur(10px)' });
    gsap.set('.sticker-ball', { scale: 0.3, opacity: 0, rotation: 0, filter: 'blur(8px)' });
    gsap.set('.mission-section.reveal-item, .details-section .reveal-item', { y: 64, opacity: 0, filter: 'blur(12px)', rotateX: -10, transformOrigin: '50% 100%' });
    gsap.set('.detail-card .icon-box', { scale: 0.35, rotation: -18, opacity: 0 });
    gsap.set('.action-link', { y: 22, opacity: 0, scale: 0.94, filter: 'blur(8px)', transformOrigin: '50% 100%' });
    gsap.set('.action-link .link-icon', { scale: 0.72, rotation: -10 });
    gsap.set('.dock-btn .btn-icon', { scale: 0.7, rotation: -14, opacity: 0.7 });
    gsap.set('.mobile-dock.floating-rsvp .dock-btn', dockBtnSet);

    const intro = this.introTimeline = gsap.timeline({
      defaults: { ease: 'expo.out' },
      onComplete: () => {
        this.document.body.classList.add('intro-finished');
        this.introFinished.set(true);
        this.focusGuestNameInput();
      }
    });

    intro
      .to('.line-a', { xPercent: 115, duration: 0.82, ease: 'power4.inOut' }, 0.05)
      .to('.line-b', { xPercent: -115, duration: 0.82, ease: 'power4.inOut' }, 0.05)
      .to('.trailer-skip', { y: 0, opacity: 1, duration: 0.34, ease: 'power2.out' }, 0.08)
      .to('.trailer-energy i', { scaleX: 1, opacity: 0.72, duration: 0.72, stagger: 0.06, ease: 'power3.out' }, 0.12)
      .to('.trailer-character', { x: 0, y: 0, scale: 1, rotation: -2, opacity: 1, filter: 'blur(0px)', duration: 0.92, ease: 'back.out(1.45)' }, 0.12)
      .to('.trailer-ash-shadow', { scaleX: 1, opacity: 0.62, duration: 0.62, ease: 'power2.out' }, 0.2)
      .to('.trailer-throw-ball', { x: -210, y: -82, scale: 0.62, rotation: 540, opacity: 1, filter: 'blur(0px)', duration: 0.68, ease: 'power3.out' }, 0.42)
      .to('.trailer-throw-ball', { opacity: 0, scale: 0.18, duration: 0.2, ease: 'power2.in' }, 0.98)
      .to('.trailer-burst', { scale: 1, opacity: 0.82, rotation: 16, duration: 0.32, ease: 'power2.out' }, 0.82)
      .to('.trailer-burst', { scale: 1.35, opacity: 0, duration: 0.42, ease: 'power2.out' }, 1.02)
      .to('.trailer-hud > *', { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.5, stagger: 0.06 }, 0.18)
      .to('.trailer-kicker', { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.58 }, 0.26)
      .to('.trailer-copy strong', { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.8 }, 0.42)
      .to('.trailer-flash', { opacity: 0.88, duration: 0.07, ease: 'none' }, 1.15)
      .to('.trailer-flash', { opacity: 0, duration: 0.22, ease: 'power2.out' }, 1.22)
      .to('.trailer-bars span:first-child', { yPercent: -120, duration: 0.78, ease: 'power4.inOut' }, 1.1)
      .to('.trailer-bars span:last-child', { yPercent: 120, duration: 0.78, ease: 'power4.inOut' }, 1.1)
      .to('#trailerIntro', { autoAlpha: 0, duration: 0.5, ease: 'power2.out' }, 1.34)
      .to('.page-bg', { scale: 1.04, filter: 'brightness(1) saturate(1.06)', duration: 1.65 }, 1.2)
      .to('.hero-reveal', { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.78, stagger: 0.12 }, 1.45)
      .to('.split-char', { y: 0, rotateX: 0, opacity: 1, duration: 0.82, stagger: 0.018 }, 1.55)
      .to('.pokemon-wordmark', { y: 0, scale: 1, rotationX: 0, rotation: -2, opacity: 1, filter: 'blur(0px)', duration: 1.12, ease: 'expo.out' }, 1.78)
      .to('.wordmark-underline', { strokeDashoffset: 0, duration: 0.72, ease: 'power2.out' }, 2.1)
      .to('.pokemon-wordmark', { scale: 1.06, duration: 0.16, yoyo: true, repeat: 1, ease: 'power1.inOut' }, 2.48)
      .to('.reveal-card', { y: 0, scale: 1, rotationY: 0, rotation: -1.2, opacity: 1, filter: 'blur(0px)', duration: 1.05, ease: 'back.out(1.16)' }, 2.0)
      .to('.trainer-card', { x: 5, duration: 0.055, repeat: 5, yoyo: true, ease: 'none' }, 2.85)
      .to('.sticker-ball', { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.62, ease: 'back.out(1.9)', stagger: 0.08 }, 2.5)
      .to('.sticker-bulbasaur', { x: 0, y: 0, scale: 1, rotation: -10, opacity: 1, filter: 'blur(0px)', duration: 0.72, ease: 'back.out(1.9)' }, 2.68)
      .to('.sticker-pika', { x: 0, y: 0, scale: 1, rotation: -10, opacity: 1, filter: 'blur(0px)', duration: 0.72, ease: 'back.out(1.9)' }, 2.68)
      .to('.sticker-squirtle', { x: 0, y: 0, scale: 1, rotation: 8, opacity: 1, filter: 'blur(0px)', duration: 0.72, ease: 'back.out(1.9)' }, 2.78)
      .to('.sticker-charmander', { x: 0, y: 0, scale: 1, rotation: 6, opacity: 1, filter: 'blur(0px)', duration: 0.72, ease: 'back.out(1.9)' }, 2.88)
      .to('.wordmark-shine', { x: 1320, opacity: 0.62, duration: 0.98, ease: 'power2.inOut' }, 2.88)
      .to('.shine', { xPercent: 245, duration: 1.05, ease: 'power2.inOut' }, 2.96)
      .add(() => this.document.body.classList.add('dock-visible'), 2.92)
      .fromTo('.mobile-dock.floating-rsvp .dock-btn', dockBtnSet, { y: 0, scale: 1, filter: 'brightness(1) blur(0px)', duration: 0.44, stagger: 0.08, ease: 'back.out(1.9)', clearProps: 'filter' }, 3.08)
      .to('.dock-btn .btn-icon', { scale: 1, rotation: 0, opacity: 1, duration: 0.38, stagger: 0.07, ease: 'back.out(1.8)' }, 3.2);

    gsap.to('.shine', { xPercent: 245, duration: 1.25, repeat: -1, repeatDelay: 4.8, ease: 'power2.inOut' });
    gsap.to('.wordmark-shine', {
      x: 1320,
      opacity: 0.6,
      duration: 1.15,
      repeat: -1,
      repeatDelay: 4.2,
      ease: 'power2.inOut',
      onRepeat: () => gsap.set('.wordmark-shine', { x: -360, opacity: 0.12 })
    });

    this.document.querySelectorAll<HTMLElement>('.floaty').forEach((el, i) => {
      gsap.to(el, {
        y: i % 2 ? '-=14' : '+=14',
        rotation: i % 2 ? '+=5' : '-=5',
        duration: 2.6 + i * 0.24,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        delay: 3.25 + i * 0.08
      });
    });

    gsap.to('.dock-btn.yes', {
      scale: 1.025,
      duration: 0.9,
      repeat: -1,
      yoyo: true,
      repeatDelay: 2.8,
      ease: 'sine.inOut'
    });

    gsap.to('.dock-btn.yes .btn-icon', {
      rotation: 6,
      scale: 1.08,
      duration: 0.72,
      repeat: -1,
      yoyo: true,
      repeatDelay: 2.4,
      ease: 'sine.inOut'
    });

    gsap.to('.action-link-map .link-icon, .action-link-calendar .link-icon', {
      y: -3,
      duration: 1.05,
      repeat: -1,
      yoyo: true,
      stagger: 0.14,
      repeatDelay: 1.6,
      ease: 'sine.inOut'
    });

    gsap.to('.action-link-map', {
      boxShadow: '0 24px 52px rgba(35, 213, 255, .22), inset 0 1px 0 rgba(255,255,255,.24)',
      duration: 1.2,
      repeat: -1,
      yoyo: true,
      repeatDelay: 2.2,
      ease: 'sine.inOut'
    });

    this.initScrollAnimations();
    this.initTrainerTilt();
  }

  private initScrollAnimations(): void {
    gsap.to('.page-bg', {
      yPercent: 4,
      scale: 1.08,
      ease: 'none',
      scrollTrigger: { trigger: this.document.body, start: 'top top', end: 'bottom bottom', scrub: true }
    });

    gsap.fromTo('.mission-section.reveal-item', {
      y: 72,
      opacity: 0,
      filter: 'blur(12px)',
      rotateX: -10
    }, {
      y: 0,
      opacity: 1,
      filter: 'blur(0px)',
      rotateX: 0,
      duration: 0.92,
      ease: 'expo.out',
      scrollTrigger: { trigger: '.mission-section', start: 'top 84%', once: true }
    });

    gsap.utils.toArray<HTMLElement>('.section-heading.reveal-item').forEach((el) => {
      gsap.fromTo(el, { y: 54, opacity: 0, filter: 'blur(10px)', rotateX: -8 }, {
        y: 0,
        opacity: 1,
        filter: 'blur(0px)',
        rotateX: 0,
        duration: 0.86,
        ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 86%', once: true }
      });
    });

    gsap.utils.toArray<HTMLElement>('.details-grid .detail-card').forEach((card, index) => {
      gsap.fromTo(card, {
        y: 74,
        opacity: 0,
        filter: 'blur(12px)',
        rotateX: -16,
        scale: 0.92
      }, {
        y: 0,
        opacity: 1,
        filter: 'blur(0px)',
        rotateX: 0,
        scale: 1,
        duration: 0.9,
        delay: index * 0.06,
        ease: 'expo.out',
        scrollTrigger: { trigger: card, start: 'top 88%', once: true }
      });

      const icon = card.querySelector('.icon-box');
      if (icon) {
        gsap.fromTo(icon, { scale: 0.35, rotation: -18, opacity: 0 }, {
          scale: 1,
          rotation: 0,
          opacity: 1,
          duration: 0.7,
          delay: index * 0.06 + 0.12,
          ease: 'back.out(1.7)',
          scrollTrigger: { trigger: card, start: 'top 88%', once: true }
        });
      }
    });

    gsap.fromTo('.action-card.reveal-item', {
      y: 74,
      opacity: 0,
      filter: 'blur(12px)',
      rotateX: -14,
      scale: 0.94
    }, {
      y: 0,
      opacity: 1,
      filter: 'blur(0px)',
      rotateX: 0,
      scale: 1,
      duration: 0.95,
      ease: 'expo.out',
      scrollTrigger: { trigger: '.action-card', start: 'top 88%', once: true },
      onComplete: () => {
        gsap.to('.action-link', { y: 0, opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.58, stagger: 0.1, ease: 'back.out(1.25)' });
        gsap.to('.action-link .link-icon', { scale: 1, rotation: 0, duration: 0.5, stagger: 0.1, ease: 'back.out(1.8)' });
      }
    });
  }

  private initTrainerTilt(): void {
    const stage = this.document.querySelector<HTMLElement>('.stage-wrap');
    const card = this.document.querySelector<HTMLElement>('.trainer-card');
    if (!stage || !card) return;

    const move = (event: Event) => {
      const point = typeof TouchEvent !== 'undefined' && event instanceof TouchEvent ? event.touches[0] : event as MouseEvent;
      if (!point) return;
      const rect = stage.getBoundingClientRect();
      const x = (point.clientX - rect.left) / rect.width - 0.5;
      const y = (point.clientY - rect.top) / rect.height - 0.5;
      gsap.to(card, { rotationY: x * 7, rotationX: -y * 6, rotation: -1.2, duration: 0.45, ease: 'power2.out' });
      gsap.to('.sticker', { x: x * 10, duration: 0.55, ease: 'power2.out' });
    };

    const reset = () => {
      gsap.to(card, { rotationY: 0, rotationX: 0, rotation: -1.2, duration: 0.55, ease: 'power2.out' });
      gsap.to('.sticker', { x: 0, duration: 0.55, ease: 'power2.out' });
    };

    stage.addEventListener('mousemove', move);
    stage.addEventListener('touchmove', move, { passive: true });
    stage.addEventListener('mouseleave', reset);
    stage.addEventListener('touchend', reset);

    this.cleanupFns.push(() => {
      stage.removeEventListener('mousemove', move);
      stage.removeEventListener('touchmove', move);
      stage.removeEventListener('mouseleave', reset);
      stage.removeEventListener('touchend', reset);
    });
  }

  private fireConfetti(): void {
    const layer = this.document.getElementById('confettiLayer');
    if (!layer) return;

    const colors = ['#ffd72d', '#ff9c1a', '#f72f2f', '#1a8dff', '#7fe6ff', '#58ff9a'];
    const count = 54;
    const pieces: HTMLElement[] = [];

    for (let i = 0; i < count; i += 1) {
      const piece = this.document.createElement('span');
      piece.className = 'confetti-piece';
      piece.style.left = `${50 + (Math.random() * 26 - 13)}vw`;
      piece.style.top = '46vh';
      piece.style.background = colors[i % colors.length];
      piece.style.transform = `rotate(${Math.random() * 180}deg)`;
      layer.appendChild(piece);
      pieces.push(piece);
    }

    gsap.to(pieces, {
      x: () => (Math.random() - 0.5) * window.innerWidth * 0.92,
      y: () => -140 - Math.random() * 220,
      rotation: () => Math.random() * 720,
      duration: 0.72,
      ease: 'power2.out',
      stagger: 0.006,
      onComplete: () => {
        gsap.to(pieces, {
          y: () => window.innerHeight * (0.38 + Math.random() * 0.52),
          opacity: 0,
          rotation: () => Math.random() * 1080,
          duration: 1.2,
          ease: 'power2.in',
          stagger: 0.003,
          onComplete: () => pieces.forEach((piece) => piece.remove())
        });
      }
    });
  }
}
