import { describe, expect, it } from 'vitest';

import { asId, type OfficeId } from '@domain/index';

import NEWS from '../fixtures/news.json';
import { toBalitaArticle, toBalitaCategory, toWireNewsPatch, toWireNewsWrite } from './balita.mapper';

describe('Balita mappers (DL-171)', () => {
  it('reads an article, whether it has a cover, and never the cover’s address or share link', () => {
    const article = toBalitaArticle(NEWS.data);
    expect(article).toEqual({
      id: '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c41',
      title: 'Fixture advisory',
      body: 'A fixture article. No resident reads it.',
      category: 'advisory',
      officeId: '0c1d2e3f-4a5b-4c6d-8e7f-a0b1c2d3e4f5',
      status: 'published',
      publishedAt: '2026-11-02T01:00:00.000Z',
      pinned: true,
      hasCover: true,
      updatedAt: '2026-11-03T01:00:00.000Z',
    });
    expect(JSON.stringify(article)).not.toContain('example.invalid');
  });

  it('refuses an article it cannot read, rather than showing part of it', () => {
    expect(toBalitaArticle({ ...NEWS.data, status: 'scheduled' })).toBeNull();
    expect(toBalitaArticle({ ...NEWS.data, title: '' })).toBeNull();
  });

  it('drops a category the API’s write would not take', () => {
    expect(toBalitaCategory({ slug: 'advisory', label: 'Advisory' })).toEqual({
      slug: 'advisory',
      label: 'Advisory',
    });
    expect(toBalitaCategory({ slug: 'gossip', label: 'Gossip' })).toBeNull();
  });

  it('writes the words trimmed, leaves out what is not chosen, and sends only what changed', () => {
    const office = asId<OfficeId>('office-1');
    expect(
      toWireNewsWrite(
        { title: ' T ', body: ' B ', category: null, officeId: office, status: 'published' },
        null,
      ),
    ).toEqual({
      title: 'T',
      body: 'B',
      category: undefined,
      office_id: 'office-1',
      status: 'published',
      cover: undefined,
    });
    expect(toWireNewsPatch({ status: 'draft' }, null)).toEqual({
      title: undefined,
      body: undefined,
      category: undefined,
      status: 'draft',
      cover: undefined,
    });
  });
});
