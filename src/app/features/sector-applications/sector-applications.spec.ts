import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, type Observable } from 'rxjs';
import { describe, expect, it } from 'vitest';

import {
  asId,
  asIsoDateTime,
  RESIDENT_REPOSITORY,
  SECTOR_APPLICATION_REPOSITORY,
  type AppAccountId,
  type CursorPage,
  type CursorRequest,
  type MediaId,
  type ResidentId,
  type SectorApplication,
  type SectorApplicationDetail,
  type SectorApplicationId,
  type SectorApplicationRepository,
  type SectorApplicationStatus,
  type SectorApproval,
} from '@domain/index';

import { SectorApplicationReview } from './sector-application-review';
import { SectorApplicationsPage } from './sector-applications-page';
import { SECTOR_APPLICATIONS_COPY } from './sector-applications.copy';

const APPLICATION: SectorApplication = {
  id: asId<SectorApplicationId>('application-1'),
  sector: 'pwd',
  status: 'pending',
  submittedAt: asIsoDateTime('2026-11-10T01:00:00.000Z'),
  decidedAt: null,
  decidedBy: null,
  returnReason: null,
  residentId: null,
  proofCount: 1,
  applicant: { account: asId<AppAccountId>('account-1'), name: 'Ana Reyes', barangayName: 'Muzon' },
};

const DETAIL: SectorApplicationDetail = {
  ...APPLICATION,
  proofs: [asId<MediaId>('proof-1')],
  proofWarning: 'A proof is a picture of somebody’s card.',
  linkedResident: null,
  candidates: [{ residentId: asId<ResidentId>('resident-1'), name: 'Reyes, Ana', barangayId: null }],
  detailsWritable: true,
};

class Applications implements SectorApplicationRepository {
  readonly calls: string[] = [];
  approval: SectorApproval | null = null;
  list(
    page: CursorRequest,
    status: SectorApplicationStatus,
  ): Observable<CursorPage<SectorApplication>> {
    this.calls.push(`list:${status}:${page.limit}`);
    return of({ items: [APPLICATION], hasMore: false, nextCursor: null });
  }
  get(): Observable<SectorApplicationDetail | null> {
    this.calls.push('get');
    return of(DETAIL);
  }
  openProof(): Observable<Blob> {
    this.calls.push('openProof');
    return of(new Blob(['x']));
  }
  approve(id: SectorApplicationId, approval: SectorApproval): Observable<SectorApplication> {
    this.calls.push(`approve:${id}`);
    this.approval = approval;
    return of({ ...APPLICATION, status: 'approved' });
  }
  returnToApplicant(id: SectorApplicationId, reason: string): Observable<SectorApplication> {
    this.calls.push(`return:${id}:${reason}`);
    return of({ ...APPLICATION, status: 'returned', returnReason: reason });
  }
}

function configure(): Applications {
  const applications = new Applications();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: SECTOR_APPLICATION_REPOSITORY, useValue: applications },
      // The review's registry search reads the registry; nothing is searched in these tests.
      {
        provide: RESIDENT_REPOSITORY,
        useValue: { list: () => of({ items: [], hasMore: false, nextCursor: null }) },
      },
    ],
  });
  return applications;
}

async function settle(fixture: { detectChanges(): void; whenStable(): Promise<unknown> }): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

const text = (root: HTMLElement): string => root.textContent?.replace(/\s+/g, ' ') ?? '';

function type(root: HTMLElement, selector: string, value: string): void {
  const field = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  if (field !== null) {
    field.value = value;
    field.dispatchEvent(new Event('input'));
  }
}

describe('Sector applications (DL-215)', () => {
  it('lists the waiting applications first', async () => {
    const applications = configure();
    const fixture = TestBed.createComponent(SectorApplicationsPage);
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;

    expect(applications.calls).toEqual(['list:pending:20']);
    expect(text(root)).toContain('Ana Reyes');
    expect(text(root)).toContain(SECTOR_APPLICATIONS_COPY.sectors.pwd);
  });

  it('opens no proof before the warning, and only from its button', async () => {
    const applications = configure();
    const fixture = TestBed.createComponent(SectorApplicationReview);
    fixture.componentRef.setInput('application', APPLICATION);
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;

    const show = [...root.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === SECTOR_APPLICATIONS_COPY.review.open,
    );
    show?.click();
    await settle(fixture);
    expect(applications.calls).not.toContain('openProof');
    expect(document.body.textContent).toContain(DETAIL.proofWarning);
  });

  it('will not approve an unlinked account without a chosen record and a reason for the link', async () => {
    const applications = configure();
    const fixture = TestBed.createComponent(SectorApplicationReview);
    fixture.componentRef.setInput('application', APPLICATION);
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;

    type(root, 'textarea[aria-describedby="application-approve-hint"]', 'Card seen at the counter.');
    root.querySelector<HTMLFormElement>('form[aria-labelledby="application-approve"]')?.dispatchEvent(
      new Event('submit'),
    );
    await settle(fixture);
    expect(text(root)).toContain(SECTOR_APPLICATIONS_COPY.review.chooseRecord);
    expect(applications.calls.some((call) => call.startsWith('approve'))).toBe(false);

    root.querySelector<HTMLInputElement>('input[name="application-record"]')?.click();
    type(root, 'textarea[aria-describedby="application-link-hint"]', 'Same name, birth date and ID.');
    type(root, 'input[aria-describedby="application-id-hint"]', '1234');
    root.querySelector<HTMLFormElement>('form[aria-labelledby="application-approve"]')?.dispatchEvent(
      new Event('submit'),
    );
    await settle(fixture);
    expect(applications.calls).toContain('approve:application-1');
    expect(applications.approval?.link?.residentId).toBe('resident-1');
    expect(applications.approval?.details?.idLastFour).toBe('1234');
  });

  it('returns with the reason the resident will read', async () => {
    const applications = configure();
    const fixture = TestBed.createComponent(SectorApplicationReview);
    fixture.componentRef.setInput('application', APPLICATION);
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;

    type(root, 'textarea[aria-describedby="application-return-hint"]', 'The photo is too dark.');
    root.querySelector<HTMLFormElement>('form[aria-labelledby="application-return"]')?.dispatchEvent(
      new Event('submit'),
    );
    await settle(fixture);
    expect(applications.calls).toContain('return:application-1:The photo is too dark.');
  });
});
