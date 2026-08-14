import { asId, type SavedView, type SavedViewId } from '@domain/index';

import { stamp } from './seed-utils';

/**
 * Office-wide starting views.
 *
 * Each one is a question the MSWDO already asks weekly, expressed as the exact
 * query parameters the resident list reads. Nothing here is a private
 * preference: personal views are created at runtime and belong to their owner.
 */
export const MOCK_SAVED_VIEWS: readonly SavedView[] = [
  {
    id: asId<SavedViewId>('view-0001'),
    resource: 'residents',
    name: 'Senior citizens',
    params: { ageGroup: 'senior' },
    isShared: true,
    ownerId: null,
    audit: stamp(300),
  },
  {
    id: asId<SavedViewId>('view-0002'),
    resource: 'residents',
    name: 'Solo parents',
    params: { sector: 'solo-parent' },
    isShared: true,
    ownerId: null,
    audit: stamp(300),
  },
  {
    id: asId<SavedViewId>('view-0003'),
    resource: 'residents',
    name: 'Persons with disability, Dolores',
    params: { sector: 'pwd', barangay: 'brgy-dolores' },
    isShared: true,
    ownerId: null,
    audit: stamp(180),
  },
  {
    id: asId<SavedViewId>('view-0004'),
    resource: 'residents',
    name: 'Out-of-school youth',
    params: { sector: 'out-of-school-youth', ageGroup: 'youth' },
    isShared: true,
    ownerId: null,
    audit: stamp(90),
  },
];
