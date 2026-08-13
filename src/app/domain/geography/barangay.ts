import { asId, type BarangayId } from '../shared/ids';

export interface Barangay {
  readonly id: BarangayId;
  readonly name: string;
  /**
   * Philippine Standard Geographic Code. Left `null` until the authoritative
   * PSA PSGC dataset is loaded — a wrong code is worse than an absent one
   * because downstream DSWD reporting keys off it.
   */
  readonly psgcCode: string | null;
}

/**
 * Taytay, Rizal is composed of five barangays. This list is a domain constant,
 * not mock data: it does not change between the mock and HTTP adapters.
 */
export const TAYTAY_BARANGAYS: readonly Barangay[] = [
  { id: asId<BarangayId>('brgy-dolores'), name: 'Dolores', psgcCode: null },
  { id: asId<BarangayId>('brgy-muzon'), name: 'Muzon', psgcCode: null },
  { id: asId<BarangayId>('brgy-san-isidro'), name: 'San Isidro', psgcCode: null },
  { id: asId<BarangayId>('brgy-san-juan'), name: 'San Juan', psgcCode: null },
  { id: asId<BarangayId>('brgy-santa-ana'), name: 'Santa Ana', psgcCode: null },
];

export const MUNICIPALITY_NAME = 'Taytay';
export const PROVINCE_NAME = 'Rizal';

export function findBarangay(id: BarangayId): Barangay | undefined {
  return TAYTAY_BARANGAYS.find((barangay) => barangay.id === id);
}

export function barangayName(id: BarangayId): string {
  return findBarangay(id)?.name ?? 'Unknown barangay';
}
