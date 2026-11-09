import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, type Observable } from 'rxjs';
import { describe, expect, it } from 'vitest';

import {
  asId,
  asIsoDateTime,
  BALITA_EFFECTS,
  BALITA_REPOSITORY,
  OFFICE_REPOSITORY,
  type BalitaArticle,
  type BalitaArticleId,
  type BalitaCategory,
  type BalitaChanges,
  type BalitaDraft,
  type BalitaRepository,
  type CursorPage,
  type CursorRequest,
  type OfficeId,
} from '@domain/index';

import { BalitaPage } from './balita-page';
import { BALITA_COPY } from './balita.copy';

const MSWDO = asId<OfficeId>('office-mswdo');

function article(key: string, status: BalitaArticle['status'], pinned = false): BalitaArticle {
  return {
    id: asId<BalitaArticleId>(key),
    title: `Article ${key}`,
    body: 'Words',
    category: 'advisory',
    officeId: MSWDO,
    status,
    publishedAt: status === 'published' ? asIsoDateTime('2026-11-02T01:00:00.000Z') : null,
    pinned,
    hasCover: false,
    updatedAt: asIsoDateTime('2026-11-02T01:00:00.000Z'),
  };
}

/** Records every call, so a test can say what was — and was not — asked of the data layer. */
class RecordingNews implements BalitaRepository {
  readonly calls: string[] = [];
  readonly drafts: BalitaDraft[] = [];
  readonly changes: BalitaChanges[] = [];

  list(page: CursorRequest): Observable<CursorPage<BalitaArticle>> {
    this.calls.push(`list:${page.cursor ?? 'first'}`);
    return of({
      items: [article('a', 'published', true), article('b', 'published')],
      hasMore: true,
      nextCursor: 'next',
    });
  }
  get(id: BalitaArticleId): Observable<BalitaArticle | null> {
    this.calls.push(`get:${id}`);
    return of(id === 'draft-1' ? article('draft-1', 'draft') : null);
  }
  categories(): Observable<readonly BalitaCategory[]> {
    return of([{ slug: 'advisory', label: 'Advisory' }]);
  }
  create(draft: BalitaDraft): Observable<BalitaArticle> {
    this.calls.push('create');
    this.drafts.push(draft);
    return of({ ...article('new-1', draft.status), title: draft.title });
  }
  update(id: BalitaArticleId, changes: BalitaChanges): Observable<BalitaArticle> {
    this.calls.push(`update:${id}`);
    this.changes.push(changes);
    return of(article(id, changes.status ?? 'published'));
  }
  pin(id: BalitaArticleId): Observable<BalitaArticle> {
    this.calls.push(`pin:${id}`);
    return of(article(id, 'published', true));
  }
  unpin(id: BalitaArticleId): Observable<BalitaArticle> {
    this.calls.push(`unpin:${id}`);
    return of(article(id, 'published'));
  }
  openCover(): Observable<Blob> {
    return of(new Blob(['x']));
  }
}

function configure(): RecordingNews {
  const news = new RecordingNews();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: BALITA_REPOSITORY, useValue: news },
      {
        provide: OFFICE_REPOSITORY,
        useValue: {
          list: () =>
            of([{ id: MSWDO, name: 'Social Welfare Office', slug: 'mswdo', shortName: 'MSWDO' }]),
        },
      },
    ],
  });
  return news;
}

async function settle<T>(fixture: ComponentFixture<T>): Promise<HTMLElement> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function button(root: ParentNode, name: string): HTMLButtonElement | null {
  return (
    [...root.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => candidate.textContent?.trim() === name,
    ) ?? null
  );
}

function type(root: ParentNode, selector: string, value: string): void {
  const field = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  if (field === null) throw new Error(`no ${selector}`);
  field.value = value;
  field.dispatchEvent(new Event('input'));
}

const COPY = BALITA_COPY;

describe('BalitaPage (DL-171)', () => {
  it('says residents read it in the app, that it is the one news channel, and that more are available', async () => {
    const news = configure();
    const element = await settle(TestBed.createComponent(BalitaPage));

    expect(element.querySelector('app-page-header')?.textContent).toContain(
      'Residents read these in the Taytay app’s Balita',
    );
    expect(element.textContent).toContain('the one news channel this console publishes to');
    expect(news.calls).toEqual(['list:first']);
    expect(element.textContent).toContain('Showing 2 articles. More are available.');
    expect(element.textContent).toContain('(Pinned)');
    expect(element.textContent).not.toMatch(/page \d+ of/i);
  });

  it('says what publishing does above the publish button, and sends nothing before it', async () => {
    const news = configure();
    const fixture = TestBed.createComponent(BalitaPage);
    const element = await settle(fixture);
    button(element, COPY.page.write)?.click();
    await settle(fixture);

    const publish = button(document.body, COPY.editor.publish);
    const act = publish?.closest('.balita__act');
    for (const effect of BALITA_EFFECTS.publish) {
      expect(act?.textContent).toContain(effect);
    }
    expect(document.body.textContent).toContain('The API keeps no description of the cover');
    expect(news.calls).toEqual(['list:first']);

    type(document.body, '#balita-title', 'Water interruption');
    type(document.body, '#balita-body', 'No water on Tuesday.');
    await settle(fixture);
    publish?.click();
    await settle(fixture);

    expect(news.drafts).toEqual([
      {
        title: 'Water interruption',
        body: 'No water on Tuesday.',
        category: null,
        officeId: null,
        status: 'published',
      },
    ]);
    expect(document.body.textContent).toContain(COPY.editor.outcome.published);
  });

  it('keeps a draft on the page, with its ID, because the API lists none', async () => {
    configure();
    const fixture = TestBed.createComponent(BalitaPage);
    const element = await settle(fixture);
    button(element, COPY.page.write)?.click();
    await settle(fixture);
    type(document.body, '#balita-title', 'A draft');
    type(document.body, '#balita-body', 'Words');
    await settle(fixture);
    button(document.body, COPY.editor.saveDraft)?.click();
    await settle(fixture);

    const drafts = element.querySelector('.balita__drafts')?.textContent ?? '';
    expect(drafts).toContain('A draft');
    expect(drafts).toContain(COPY.drafts.id('new-1'));
    expect(element.textContent).toContain(COPY.drafts.lead);
  });

  it('opens a draft by its ID, and says plainly when there is none to open', async () => {
    const news = configure();
    const fixture = TestBed.createComponent(BalitaPage);
    const element = await settle(fixture);

    type(element, '#balita-lookup', 'nothing-here');
    await settle(fixture);
    element.querySelector('form.balita__lookup')?.dispatchEvent(new Event('submit'));
    await settle(fixture);
    expect(element.textContent).toContain(COPY.byId.notFound);

    type(element, '#balita-lookup', 'draft-1');
    await settle(fixture);
    element.querySelector('form.balita__lookup')?.dispatchEvent(new Event('submit'));
    await settle(fixture);
    expect(news.calls).toContain('get:draft-1');
    expect(document.body.textContent).toContain('“Article draft-1”');
  });

  it('takes a published article off the app only from its own button, below what it does', async () => {
    const news = configure();
    const fixture = TestBed.createComponent(BalitaPage);
    const element = await settle(fixture);
    element.querySelector<HTMLButtonElement>('tbody tr button')?.click();
    await settle(fixture);

    const off = button(document.body, COPY.editor.unpublish);
    for (const effect of BALITA_EFFECTS.unpublish) {
      expect(off?.closest('.balita__act')?.textContent).toContain(effect);
    }
    off?.click();
    await settle(fixture);
    expect(news.changes).toEqual([{ status: 'draft' }]);
    expect(element.querySelector('.balita__drafts')?.textContent).toContain('Article a');
  });
});
