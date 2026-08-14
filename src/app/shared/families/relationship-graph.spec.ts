import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import {
  asId,
  asIsoDate,
  asIsoDateTime,
  discloseResident,
  type FamilyGraph,
  type GraphEdge,
  type GraphNode,
  type Permission,
  type Relationship,
  type RelationshipId,
  type Resident,
  type ResidentId,
  type StaffUserId,
} from '@domain/index';

import { RelationshipGraph } from './relationship-graph';

const ACTOR = asId<StaffUserId>('staff-test');

function resident(id: string, first: string, last: string): Resident {
  return {
    id: asId<ResidentId>(id),
    householdId: null,
    name: { first, middle: null, last, suffix: null },
    sex: 'female',
    birthDate: asIsoDate('1980-01-01'),
    civilStatus: 'married',
    address: { barangayId: asId('brgy-san-juan'), purokOrSitio: null, streetAddress: '1 Street' },
    contact: { mobile: null, email: null },
    sectors: [],
    philsysLastFour: null,
    monthlyIncome: null,
    isActive: true,
    audit: {
      createdAt: asIsoDateTime('2026-01-01T00:00:00.000Z'),
      createdBy: ACTOR,
      updatedAt: asIsoDateTime('2026-01-01T00:00:00.000Z'),
      updatedBy: ACTOR,
    },
  };
}

const cleared = (permission: Permission) => permission === 'resident.view';

function node(
  id: string,
  first: string,
  last: string,
  generation: number,
  edges: readonly GraphEdge[],
  isCurrentMember = true,
): GraphNode {
  return {
    view: discloseResident(resident(id, first, last), cleared),
    role: generation === 0 ? 'head' : 'child',
    isCurrentMember,
    generation,
    edges,
  };
}

function edge(
  id: string,
  kind: GraphEdge['kind'],
  otherResidentId: string,
  otherName: string,
  isCurrent = true,
): GraphEdge {
  return {
    relationshipId: asId<RelationshipId>(id),
    kind,
    otherResidentId: asId<ResidentId>(otherResidentId),
    otherName,
    isCurrent,
    since: asIsoDate('2016-01-05'),
    until: isCurrent ? null : asIsoDate('2025-02-23'),
  };
}

function relationship(id: string, from: string, to: string, until: string | null): Relationship {
  return {
    id: asId<RelationshipId>(id),
    fromResidentId: asId<ResidentId>(from),
    toResidentId: asId<ResidentId>(to),
    kind: 'parent-of',
    since: asIsoDate('2016-01-05'),
    until: until === null ? null : asIsoDate(until),
    audit: {
      createdAt: asIsoDateTime('2026-01-01T00:00:00.000Z'),
      createdBy: ACTOR,
      updatedAt: asIsoDateTime('2026-01-01T00:00:00.000Z'),
      updatedBy: ACTOR,
    },
  };
}

const GRAPH: FamilyGraph = {
  nodes: [
    node('res-a', 'Ana', 'Cruz', 0, [
      edge('rel-1', 'parent-of', 'res-b', 'Cruz, Ben'),
      edge('rel-2', 'spouse-of', 'res-c', 'Cruz, Carla'),
    ]),
    node('res-c', 'Carla', 'Cruz', 0, [edge('rel-2', 'spouse-of', 'res-a', 'Cruz, Ana')]),
    node('res-b', 'Ben', 'Cruz', 1, [edge('rel-1', 'child-of', 'res-a', 'Cruz, Ana')]),
  ],
  edges: [relationship('rel-1', 'res-a', 'res-b', null)],
};

async function render(graph: FamilyGraph = GRAPH, inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(RelationshipGraph);
  fixture.componentRef.setInput('graph', graph);
  for (const [key, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(key, value);
  }
  await fixture.whenStable();
  return fixture;
}

const html = (fixture: ComponentFixture<RelationshipGraph>) => fixture.nativeElement as HTMLElement;

/*
 * The test of this component is whether the graph survives having its
 * stylesheet deleted. Everything below asks that in a different way.
 */

describe('the graph carries its meaning in text, not in lines or colour', () => {
  it('states every relationship as a sentence in the DOM', async () => {
    const element = html(await render());
    const text = element.textContent ?? '';
    expect(text).toContain('parent of');
    expect(text).toContain('Cruz, Ben');
    expect(text).toContain('spouse of');
  });

  it('reads the same relationship from the other person as "child of"', async () => {
    const element = html(await render());
    const rows = Array.from(element.querySelectorAll('.graph__person')).map(
      (person) => person.textContent ?? '',
    );
    expect(rows.some((row) => row.includes('Cruz, Ben') && row.includes('child of'))).toBe(true);
  });

  it('names each generation in words, not only by position', async () => {
    const element = html(await render());
    const headings = Array.from(element.querySelectorAll('.graph__row-heading')).map((h) =>
      h.textContent?.trim(),
    );
    expect(headings).toContain('Same generation');
    expect(headings).toContain('Younger generation');
  });

  it('says whether a relationship is current or ended, in words', async () => {
    const graph: FamilyGraph = {
      nodes: [
        node('res-a', 'Ana', 'Cruz', 0, [
          edge('rel-9', 'guardian-of', 'res-b', 'Cruz, Ben', false),
        ]),
      ],
      edges: [relationship('rel-9', 'res-a', 'res-b', '2025-02-23')],
    };
    const element = html(await render(graph));
    expect(element.querySelector('.graph__edge-state')?.textContent).toContain('Ended');
    expect(element.querySelector('.graph__edge-state')?.textContent).toContain('2025-02-23');
  });

  it('labels a former member in words as well as by styling', async () => {
    const graph: FamilyGraph = {
      nodes: [node('res-a', 'Ana', 'Cruz', 0, [], false)],
      edges: [],
    };
    const element = html(await render(graph));
    expect(element.querySelector('.graph__former')?.textContent).toContain('Former member');
  });

  it('uses real headings, lists and links rather than a drawing', async () => {
    // A keyboard and a screen reader get the real structure, not a summary of
    // a picture. There is deliberately no canvas and no svg.
    const element = html(await render());
    expect(element.querySelectorAll('h3.graph__row-heading').length).toBeGreaterThan(0);
    expect(element.querySelectorAll('ul.graph__people').length).toBeGreaterThan(0);
    expect(element.querySelectorAll('a').length).toBeGreaterThan(0);
    expect(element.querySelector('canvas')).toBeNull();
    expect(element.querySelector('svg')).toBeNull();
  });

  it('carries a plain-language summary of what the layout does and does not mean', async () => {
    const element = html(await render());
    expect(element.querySelector('.graph__summary')?.textContent).toContain(
      'adds nothing the text does not already say',
    );
  });
});

describe('the second view lists every link exactly once', () => {
  async function switchToEdges(): Promise<ComponentFixture<RelationshipGraph>> {
    const fixture = await render();
    const radios = html(fixture).querySelectorAll<HTMLInputElement>('input[type="radio"]');
    radios[1]?.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    return fixture;
  }

  it('renders a real table with scoped headers', async () => {
    const element = html(await switchToEdges());
    expect(element.querySelector('table.graph__table')).not.toBeNull();
    expect(element.querySelectorAll('thead th')).toHaveLength(4);
    for (const header of element.querySelectorAll('thead th')) {
      expect(header.getAttribute('scope')).toBe('col');
    }
  });

  it('states each link once, with both names and its state', async () => {
    const element = html(await switchToEdges());
    const row = element.querySelector('tbody tr')?.textContent ?? '';
    expect(row).toContain('Cruz, Ana');
    expect(row).toContain('parent of');
    expect(row).toContain('Cruz, Ben');
    expect(row).toContain('Current');
  });

  it('says so when nothing links anyone yet', async () => {
    const fixture = await render({ nodes: [], edges: [] });
    expect(html(fixture).querySelector('.graph__empty')?.textContent).toContain(
      'No relationships have been recorded',
    );
  });
});

describe('managing relationships is offered only to those who may', () => {
  it('offers nothing by default', async () => {
    const element = html(await render());
    expect(element.querySelector('.graph__actions')).toBeNull();
  });

  it('emits rather than saving, because a reason is needed first', async () => {
    const fixture = await render(GRAPH, { canManage: true });
    let asked = false;
    fixture.componentInstance.addRequested.subscribe(() => {
      asked = true;
    });
    html(fixture).querySelector<HTMLButtonElement>('.graph__actions button')?.click();
    await fixture.whenStable();
    expect(asked).toBe(true);
  });
});
