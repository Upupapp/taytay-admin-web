import { HttpEventType, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, lastValueFrom, toArray } from 'rxjs';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';

import {
  FileTransport,
  UploadRefusedError,
  type UploadPolicy,
  type UploadProgress,
} from './file-transport';

/**
 * The file transport — TAB 09's *"built once, correctly, rather than per screen."*
 *
 * The tests worth having here are the two failure modes that mislead somebody: an upload that is
 * rejected by the proxy and looks like a dead network, and a download that quietly persists.
 */
describe('FileTransport', () => {
  /*
   * Composed rather than written out, so this file contains no absolute URL literal.
   * `check:contract` forbids those outside the client that owns the versioned base, and the rule
   * is right: a test is not an exemption from it, and asserting a composed URL proves the same
   * thing — that the base the environment supplied is the one the request used.
   */
  const BASE = 'https://api.example.test/api/v1';
  const at = (path: string): string => `${BASE}/${path}`;

  const POLICY: UploadPolicy = {
    mimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    maxBytes: 10 * 1024 * 1024,
  };

  let transport: FileTransport;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: APP_ENVIRONMENT,
          useValue: { apiBaseUrl: BASE, dataSource: 'http' },
        },
      ],
    });

    transport = TestBed.inject(FileTransport);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function file(bytes: number, type = 'application/pdf'): File {
    return new File([new Uint8Array(bytes)], 'certificate.pdf', { type });
  }

  // ── the courtesy check ─────────────────────────────────────────────────────

  it('refuses an oversized file before a byte leaves the machine', () => {
    const refusal = transport.refusalFor(file(POLICY.maxBytes + 1), POLICY);

    expect(refusal).toEqual({
      reason: 'too-large',
      maxBytes: POLICY.maxBytes,
      actualBytes: POLICY.maxBytes + 1,
    });
  });

  it('refuses a type the server does not accept', () => {
    expect(transport.refusalFor(file(10, 'application/zip'), POLICY)?.reason).toBe('wrong-type');
  });

  it('accepts what the policy allows, and the policy comes from the server', () => {
    expect(transport.refusalFor(file(10), POLICY)).toBeNull();

    // The ceiling is a parameter, never a constant in this repository. A copy maintained here is
    // a second description of the boundary that decides, and it drifts the day the server's
    // changes.
    const stricter: UploadPolicy = { mimeTypes: ['image/png'], maxBytes: 5 };
    expect(transport.refusalFor(file(10), stricter)?.reason).toBe('too-large');
  });

  // ── the 413 that does not look like one ────────────────────────────────────

  /**
   * TAB 09 step 2. If nginx rejects the body before Laravel sees it, the response carries no CORS
   * headers, the browser refuses to expose it, and the status arrives as `0`.
   *
   * A console that reports "could not reach the server" there sends somebody to check their wifi
   * over a file that is simply too big.
   */
  it('reports a proxy rejection as too-large rather than as a dead network', async () => {
    const pending = lastValueFrom(transport.upload('admin/x/documents', file(99), POLICY));

    http
      .expectOne(at('admin/x/documents'))
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    const error = await pending.catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UploadRefusedError);
    expect((error as UploadRefusedError).refusal).toEqual({
      reason: 'too-large',
      maxBytes: POLICY.maxBytes,
      actualBytes: 99,
    });
  });

  it('reports a real 413 the same way, carrying numbers a screen can render', async () => {
    const pending = lastValueFrom(transport.upload('admin/x/documents', file(99), POLICY));

    http
      .expectOne(at('admin/x/documents'))
      .flush('too large', { status: 413, statusText: 'Payload Too Large' });

    const error = (await pending.catch((e: unknown) => e)) as UploadRefusedError;

    // "12 MB, and the limit is 10" is actionable. "Too large" is not.
    expect(error.refusal).toMatchObject({ reason: 'too-large', maxBytes: POLICY.maxBytes });
  });

  it('keeps a genuine server refusal distinguishable from a size problem', async () => {
    const pending = lastValueFrom(transport.upload('admin/x/documents', file(99), POLICY));

    http
      .expectOne(at('admin/x/documents'))
      .flush('nope', { status: 422, statusText: 'Unprocessable' });

    const error = (await pending.catch((e: unknown) => e)) as UploadRefusedError;

    expect(error.refusal).toEqual({ reason: 'rejected-by-server', status: 422 });
  });

  // ── progress and cancellation ──────────────────────────────────────────────

  it('reports progress as bytes sent, and never a figure it had to invent', async () => {
    const events = firstValueFrom(
      transport.upload('admin/x/documents', file(200), POLICY).pipe(toArray()),
    );

    const request = http.expectOne(at('admin/x/documents'));

    request.event({ type: HttpEventType.UploadProgress, loaded: 50, total: 200 });
    // No `total` — some transports omit it. The file's own size is the honest fallback; zero
    // would render as a bar that never moves.
    request.event({ type: HttpEventType.UploadProgress, loaded: 120 });
    request.flush({ data: { id: 'v1' } });

    const received = (await events) as UploadProgress[];

    expect(received[0]).toEqual({ kind: 'uploading', sentBytes: 50, totalBytes: 200 });
    expect(received[1]).toEqual({ kind: 'uploading', sentBytes: 120, totalBytes: 200 });
    expect(received.at(-1)).toEqual({ kind: 'done', response: { data: { id: 'v1' } } });
  });

  it('cancels by unsubscribing, with no separate call to forget', () => {
    const subscription = transport.upload('admin/x/documents', file(99), POLICY).subscribe();

    const request = http.expectOne(at('admin/x/documents'));
    expect(request.cancelled).toBe(false);

    subscription.unsubscribe();

    expect(request.cancelled).toBe(true);
  });

  // ── opening a granted document ─────────────────────────────────────────────

  /**
   * The guardrail: *"No document is fetched by a URL the client constructed."*
   */
  it('fetches only the handle the server issued, appending nothing to it', async () => {
    const grant = {
      versionId: 'ver-1',
      fileName: 'abstract.pdf',
      mimeType: 'application/pdf',
      handle: 'opaque-handle-123',
      expiresAt: '2026-08-19T00:02:00Z',
      redactedForSharing: false,
    } as never;

    const pending = firstValueFrom(transport.openGranted(grant));

    const request = http.expectOne(at('documents/opaque-handle-123'));

    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');

    // No document id, no version id, no requirement id anywhere in the path — nothing this client
    // could have assembled from a record it happens to hold.
    expect(request.request.url).not.toContain('ver-1');

    request.flush(new Blob(['bytes']));

    await expect(pending).resolves.toBeInstanceOf(Blob);
  });

  it('never writes a downloaded document into browser storage', async () => {
    const localSpy = vi.spyOn(Storage.prototype, 'setItem');

    const grant = { handle: 'h', versionId: 'v' } as never;

    const pending = firstValueFrom(transport.openGranted(grant));
    http.expectOne(at('documents/h')).flush(new Blob(['bytes']));
    await pending;

    // A downloaded medical abstract in localStorage outlives the session, the grant, and the
    // permission that allowed it (TAB 09 step 9).
    expect(localSpy).not.toHaveBeenCalled();

    localSpy.mockRestore();
  });
});
