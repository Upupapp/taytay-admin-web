import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError, type Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  asId,
  asIsoDate,
  VERIFICATION_REPOSITORY,
  type AppAccountId,
  type ConfirmedIdentity,
  type CursorPage,
  type CursorRequest,
  type MediaId,
  type VerificationFilter,
  type VerificationImageKind,
  type VerificationRepository,
  type VerificationRequest,
  type VerificationRequestId,
  type VerificationStatus,
} from '@domain/index';

import { VerificationQueuePage } from './verification-queue-page';
import { VerificationReview } from './verification-review';
import { VERIFICATION_COPY } from './verification.copy';

function request(n: number, status: VerificationStatus = 'pending'): VerificationRequest {
  return {
    id: asId<VerificationRequestId>(`vr-${n}`),
    accountId: asId<AppAccountId>(`account-${n}`),
    idType: 'philid',
    images: {
      idFront: asId<MediaId>(`media-${n}-front`),
      idBack: n % 2 === 0 ? null : asId<MediaId>(`media-${n}-back`),
      selfie: asId<MediaId>(`media-${n}-selfie`),
    },
    status,
    submittedAt: `2026-11-0${n}T00:00:00.000Z` as VerificationRequest['submittedAt'],
    reviewedAt: null,
    residentMessage: null,
    reviewNote: null,
    account: status === 'pending' ? { name: `Sample Person ${n}`, birthDate: null } : null,
  };
}

/** Records every call, so a test can say what was — and was not — asked of the data layer. */
class RecordingVerifications implements VerificationRepository {
  readonly listed: { filter: VerificationFilter; page: CursorRequest }[] = [];
  readonly opened: VerificationImageKind[] = [];
  readonly decisions: {
    to: 'approved' | 'rejected';
    words: string;
    confirmed?: ConfirmedIdentity;
  }[] = [];
  /** What a decision fails with, or `null` to record it. */
  failWith: unknown = null;

  list(
    filter: VerificationFilter,
    page: CursorRequest,
  ): Observable<CursorPage<VerificationRequest>> {
    this.listed.push({ filter, page });
    return of(
      page.cursor
        ? { items: [request(3)], hasMore: false, nextCursor: null }
        : { items: [request(1), request(2)], hasMore: true, nextCursor: 'cursor-2' },
    );
  }

  approve(
    id: VerificationRequestId,
    note: string,
    confirmed: ConfirmedIdentity,
  ): Observable<VerificationRequest> {
    return this.decide(id, 'approved', note, confirmed);
  }

  reject(id: VerificationRequestId, reason: string): Observable<VerificationRequest> {
    return this.decide(id, 'rejected', reason);
  }

  openImage(_request: VerificationRequest, kind: VerificationImageKind): Observable<Blob> {
    this.opened.push(kind);
    return of(new Blob(['image bytes'], { type: 'image/png' }));
  }

  private decide(
    id: VerificationRequestId,
    to: 'approved' | 'rejected',
    words: string,
    confirmed?: ConfirmedIdentity,
  ): Observable<VerificationRequest> {
    if (this.failWith !== null) {
      const failure = this.failWith;
      return throwError(() => failure);
    }
    this.decisions.push(confirmed === undefined ? { to, words } : { to, words, confirmed });
    return of({ ...request(1), id, status: to, reviewNote: words });
  }
}

const created: string[] = [];
const revoked: string[] = [];

beforeEach(() => {
  created.length = 0;
  revoked.length = 0;
  // jsdom has no object URLs; these stand in and record what the review makes and gives back.
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => {
      const url = `blob:test/${created.length + 1}`;
      created.push(url);
      return url;
    }),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn((url: string) => revoked.push(url)),
  });
});

afterEach(() => {
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
});

function configure(): RecordingVerifications {
  const repository = new RecordingVerifications();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: VERIFICATION_REPOSITORY, useValue: repository }],
  });
  return repository;
}

function buttonNamed(root: ParentNode, name: string): HTMLButtonElement | null {
  return (
    [...root.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === name,
    ) ?? null
  );
}

async function settle<T>(fixture: ComponentFixture<T>): Promise<HTMLElement> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

/* ── the queue ───────────────────────────────────────────────────────────── */

describe('VerificationQueuePage', () => {
  it('lists no account’s name: it is shown in a review, beside the ID (DL-197)', async () => {
    configure();
    const fixture = TestBed.createComponent(VerificationQueuePage);
    const element = await settle(fixture);

    expect(element.querySelector('table')).not.toBeNull();
    expect(element.textContent).not.toContain('Sample Person');
  });

  it('opens on what is waiting, one cursor page at a time', async () => {
    const repository = configure();
    const fixture = TestBed.createComponent(VerificationQueuePage);
    const element = await settle(fixture);

    expect(repository.listed[0]).toEqual({
      filter: { status: 'pending' },
      page: { limit: 20, cursor: null },
    });
    expect(element.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(element.textContent).toContain('Showing 2 requests. More are available.');
  });

  it('says more are available, never "page 1 of N" — the server sends no total', async () => {
    configure();
    const element = await settle(TestBed.createComponent(VerificationQueuePage));

    expect(element.textContent).not.toMatch(/page \d+ of|of \d+ requests/i);
  });

  it('appends the next page from its cursor, then says that is all', async () => {
    const repository = configure();
    const fixture = TestBed.createComponent(VerificationQueuePage);
    const element = await settle(fixture);

    buttonNamed(element, VERIFICATION_COPY.queue.showMore)?.click();
    await settle(fixture);

    expect(repository.listed[1]?.page).toEqual({ limit: 20, cursor: 'cursor-2' });
    expect(element.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(element.textContent).toContain('Showing 3 requests. That is all of them.');
    expect(buttonNamed(element, VERIFICATION_COPY.queue.showMore)).toBeNull();
  });

  it('keeps its filter in the address, with the waiting queue as the plain one', async () => {
    configure();
    const fixture = TestBed.createComponent(VerificationQueuePage);
    const element = await settle(fixture);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    const select = element.querySelector<HTMLSelectElement>('#verification-status');
    if (select === null) throw new Error('no filter');
    select.value = 'approved';
    select.dispatchEvent(new Event('change'));

    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { status: 'approved' } }),
    );
  });

  it('opens a review beside the list, named for when the request was sent', async () => {
    configure();
    const fixture = TestBed.createComponent(VerificationQueuePage);
    const element = await settle(fixture);

    const review = element.querySelector<HTMLButtonElement>('tbody button');
    expect(review?.getAttribute('aria-label')).toMatch(/^Review the request sent /);
    review?.click();
    await settle(fixture);

    expect(document.body.querySelector('app-verification-review')).not.toBeNull();
  });
});

/* ── the review ──────────────────────────────────────────────────────────── */

describe('VerificationReview', () => {
  function review(subject: VerificationRequest = request(1)) {
    const repository = configure();
    const fixture = TestBed.createComponent(VerificationReview);
    fixture.componentRef.setInput('request', subject);
    const emitted: VerificationRequest[] = [];
    fixture.componentInstance.decided.subscribe((decided) => emitted.push(decided));
    return { repository, fixture, emitted };
  }

  it('loads no image until the reviewer asks, and warns before it does', async () => {
    const { repository, fixture } = review();
    const element = await settle(fixture);

    expect(repository.opened).toEqual([]);
    expect(element.querySelector('img')).toBeNull();

    buttonNamed(element, VERIFICATION_COPY.review.openImages)?.click();
    await settle(fixture);

    expect(repository.opened).toEqual([]);
    expect(document.body.textContent).toContain(VERIFICATION_COPY.review.warningHeading);
    expect(document.body.textContent).toContain('government ID and a photograph of their face');
  });

  it('fetches nothing when the warning is cancelled', async () => {
    const { repository, fixture } = review();
    const element = await settle(fixture);

    buttonNamed(element, VERIFICATION_COPY.review.openImages)?.click();
    await settle(fixture);
    buttonNamed(document.body, VERIFICATION_COPY.review.warningCancel)?.click();
    await settle(fixture);

    expect(repository.opened).toEqual([]);
    expect(element.querySelector('img')).toBeNull();
  });

  it('shows every image the request carries from object URLs it made, once warned', async () => {
    const { repository, fixture } = review(request(1));
    const element = await settle(fixture);

    buttonNamed(element, VERIFICATION_COPY.review.openImages)?.click();
    await settle(fixture);
    buttonNamed(document.body, VERIFICATION_COPY.review.warningProceed)?.click();
    await settle(fixture);

    expect(repository.opened).toEqual(['id-front', 'id-back', 'selfie']);
    const images = [...element.querySelectorAll('img')];
    expect(images.map((image) => image.getAttribute('src'))).toEqual(created);
    expect(images.map((image) => image.getAttribute('alt'))).toEqual([
      'Front of the ID',
      'Back of the ID',
      'Selfie',
    ]);
    expect(element.textContent).not.toContain(VERIFICATION_COPY.review.notOpened);
  });

  it('revokes every object URL when the images are hidden', async () => {
    const { fixture } = review(request(2));
    const element = await settle(fixture);

    buttonNamed(element, VERIFICATION_COPY.review.openImages)?.click();
    await settle(fixture);
    buttonNamed(document.body, VERIFICATION_COPY.review.warningProceed)?.click();
    await settle(fixture);
    expect(created).toHaveLength(2);

    buttonNamed(element, VERIFICATION_COPY.review.hideImages)?.click();
    await settle(fixture);

    expect(revoked).toEqual(created);
    expect(element.querySelector('img')).toBeNull();
  });

  it('revokes them when the review closes, and when another request takes its place', async () => {
    const { fixture } = review(request(2));
    const element = await settle(fixture);
    buttonNamed(element, VERIFICATION_COPY.review.openImages)?.click();
    await settle(fixture);
    buttonNamed(document.body, VERIFICATION_COPY.review.warningProceed)?.click();
    await settle(fixture);

    fixture.componentRef.setInput('request', request(4));
    await settle(fixture);
    expect(revoked).toEqual(created);
    expect(element.querySelector('img')).toBeNull();

    buttonNamed(element, VERIFICATION_COPY.review.openImages)?.click();
    await settle(fixture);
    buttonNamed(document.body, VERIFICATION_COPY.review.warningProceed)?.click();
    await settle(fixture);
    fixture.destroy();

    expect(revoked).toEqual(created);
    expect(created).toHaveLength(4);
  });

  it('says what a rejection does, and who reads the reason, before the button', async () => {
    const { fixture } = review();
    const element = await settle(fixture);

    const select = element.querySelector<HTMLSelectElement>('.transition__select');
    if (select === null) throw new Error('no decision control');
    select.value = 'rejected';
    select.dispatchEvent(new Event('change'));
    const after = await settle(fixture);

    const consequences = after.querySelector('.transition__consequences');
    const confirm = buttonNamed(after, VERIFICATION_COPY.review.confirm);
    expect(consequences?.textContent).toContain('The resident reads your reason in the app');
    expect(
      consequences !== null &&
        confirm !== null &&
        consequences.compareDocumentPosition(confirm) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(confirm?.getAttribute('aria-describedby')).toBe(consequences?.id);
    expect(after.querySelector('label[for="verification-decision-reason"]')?.textContent).toContain(
      'Reason the resident will read',
    );
    expect(after.textContent).toContain(VERIFICATION_COPY.review.notOpened);
  });

  it('says an approval verifies the account and issues a digital ID, before the button', async () => {
    const { fixture } = review();
    const element = await settle(fixture);

    const select = element.querySelector<HTMLSelectElement>('.transition__select');
    if (select === null) throw new Error('no decision control');
    select.value = 'approved';
    select.dispatchEvent(new Event('change'));
    const after = await settle(fixture);

    const said = after.querySelector('.transition__consequences')?.textContent ?? '';
    expect(said).toContain('marked verified');
    expect(said).toContain('digital ID is issued');
    expect(after.querySelector('label[for="verification-decision-reason"]')?.textContent).toContain(
      'the resident does not see this',
    );
  });

  it('refuses a rejection without words, then records it and says so in a live region', async () => {
    const { repository, fixture, emitted } = review();
    const element = await settle(fixture);

    const select = element.querySelector<HTMLSelectElement>('.transition__select');
    const reason = element.querySelector<HTMLTextAreaElement>('.transition__reason');
    if (select === null || reason === null) throw new Error('no decision control');
    select.value = 'rejected';
    select.dispatchEvent(new Event('change'));
    await settle(fixture);

    expect(buttonNamed(element, VERIFICATION_COPY.review.confirm)?.disabled).toBe(true);
    expect(reason.getAttribute('maxlength')).toBe('1000');

    reason.value = '  The licence has expired. Please send a current ID.  ';
    reason.dispatchEvent(new Event('input'));
    await settle(fixture);
    buttonNamed(element, VERIFICATION_COPY.review.confirm)?.click();
    await settle(fixture);

    expect(repository.decisions).toEqual([
      { to: 'rejected', words: 'The licence has expired. Please send a current ID.' },
    ]);
    expect(emitted.map((decided) => decided.status)).toEqual(['rejected']);
    expect(element.querySelector('[role="status"][aria-live="polite"]')?.textContent?.trim()).toBe(
      VERIFICATION_COPY.review.outcomeRejected,
    );
  });

  it('says plainly when a decision was not recorded', async () => {
    const { repository, fixture, emitted } = review();
    repository.failWith = new Error('That verification request is no longer pending.');
    const element = await settle(fixture);

    const select = element.querySelector<HTMLSelectElement>('.transition__select');
    const reason = element.querySelector<HTMLTextAreaElement>('.transition__reason');
    if (select === null || reason === null) throw new Error('no decision control');
    select.value = 'approved';
    select.dispatchEvent(new Event('change'));
    reason.value = 'Selfie matches the ID photo.';
    reason.dispatchEvent(new Event('input'));
    await settle(fixture);
    tick(element);
    await settle(fixture);
    buttonNamed(element, VERIFICATION_COPY.review.confirm)?.click();
    await settle(fixture);

    expect(emitted).toEqual([]);
    expect(element.querySelector('[aria-live="polite"]')?.textContent).toContain(
      'The decision was not recorded. That verification request is no longer pending.',
    );
  });

  it('says what the server said when the interceptor hands back its refusal', async () => {
    const { repository, fixture } = review();
    // The HTTP error interceptor rethrows an ApiFailure — an object with a message, not an Error.
    repository.failWith = {
      status: 409,
      code: 'CONFLICT',
      message: 'That verification request is no longer pending.',
    };
    const element = await settle(fixture);

    const select = element.querySelector<HTMLSelectElement>('.transition__select');
    const reason = element.querySelector<HTMLTextAreaElement>('.transition__reason');
    if (select === null || reason === null) throw new Error('no decision control');
    select.value = 'rejected';
    select.dispatchEvent(new Event('change'));
    reason.value = 'The photo is too blurred to read the name.';
    reason.dispatchEvent(new Event('input'));
    await settle(fixture);
    buttonNamed(element, VERIFICATION_COPY.review.confirm)?.click();
    await settle(fixture);

    expect(element.querySelector('[aria-live="polite"]')?.textContent).toContain(
      'The decision was not recorded. That verification request is no longer pending.',
    );
  });

  it('offers no decision on a request already decided', async () => {
    const { fixture } = review({ ...request(1, 'approved'), reviewNote: 'Matches.' });
    const element = await settle(fixture);

    expect(element.querySelector('.transition__select')).toBeNull();
    expect(element.textContent).toContain(VERIFICATION_COPY.review.alreadyDecided);
    expect(element.textContent).not.toContain(VERIFICATION_COPY.review.accountHeading);
  });

  describe('the name the account gives (DL-197)', () => {
    async function chooseApproval<T>(fixture: ComponentFixture<T>): Promise<HTMLElement> {
      const element = await settle(fixture);
      const select = element.querySelector<HTMLSelectElement>('.transition__select');
      const reason = element.querySelector<HTMLTextAreaElement>('.transition__reason');
      if (select === null || reason === null) throw new Error('no decision control');
      select.value = 'approved';
      select.dispatchEvent(new Event('change'));
      reason.value = 'Selfie matches the ID photo.';
      reason.dispatchEvent(new Event('input'));
      return settle(fixture);
    }

    it('is shown beside the images, and says the app asks for no birth date', async () => {
      const { fixture } = review();
      const element = await settle(fixture);

      const section = element.querySelector('[aria-labelledby="review-account"]');
      expect(section?.textContent).toContain('Sample Person 1');
      expect(section?.textContent).toContain(VERIFICATION_COPY.review.noBirthDate);
    });

    it('is approved only once the reviewer ticks that the ID shows it, and goes back as read', async () => {
      const { repository, fixture, emitted } = review();
      const element = await chooseApproval(fixture);

      const statement = element.querySelector('label.check');
      expect(statement?.textContent).toContain('The ID shows the name “Sample Person 1”.');
      expect(buttonNamed(element, VERIFICATION_COPY.review.confirm)?.disabled).toBe(true);

      tick(element);
      await settle(fixture);
      expect(buttonNamed(element, VERIFICATION_COPY.review.confirm)?.disabled).toBe(false);
      buttonNamed(element, VERIFICATION_COPY.review.confirm)?.click();
      await settle(fixture);

      expect(repository.decisions).toEqual([
        {
          to: 'approved',
          words: 'Selfie matches the ID photo.',
          confirmed: { name: 'Sample Person 1', birthDate: null },
        },
      ]);
      expect(emitted.map((decided) => decided.status)).toEqual(['approved']);
    });

    it('names the birth date in the statement when the account gives one', async () => {
      const { fixture } = review({
        ...request(1),
        account: { name: 'Ana Cruz', birthDate: asIsoDate('1990-05-01') },
      });
      const element = await chooseApproval(fixture);

      expect(element.querySelector('label.check')?.textContent).toContain(
        'The ID shows the name “Ana Cruz” and the birth date 1 May 1990.',
      );
    });

    it('is unticked when another request takes its place', async () => {
      const { fixture } = review();
      const element = await chooseApproval(fixture);
      tick(element);
      await settle(fixture);

      fixture.componentRef.setInput('request', request(3));
      const after = await settle(fixture);

      const box = after.querySelector<HTMLInputElement>('label.check input[type="checkbox"]');
      expect(after.querySelector('label.check')?.textContent).toContain('Sample Person 3');
      expect(box?.checked).toBe(false);
      expect(buttonNamed(after, VERIFICATION_COPY.review.confirm)?.disabled).toBe(true);
    });

    it('leaves only a rejection when the account gives no name, and says why', async () => {
      const { fixture } = review({ ...request(1), account: { name: null, birthDate: null } });
      const element = await settle(fixture);

      const options = [
        ...element.querySelectorAll<HTMLOptionElement>('.transition__select option'),
      ].map((option) => option.value);
      expect(options).toEqual(['', 'rejected']);
      expect(element.textContent).toContain(VERIFICATION_COPY.review.noName);
    });
  });
});

/** Ticks the statement an approval asks for. */
function tick(root: ParentNode): void {
  const box = root.querySelector<HTMLInputElement>('label.check input[type="checkbox"]');
  if (box === null) throw new Error('no statement to tick');
  box.checked = true;
  box.dispatchEvent(new Event('change'));
}
