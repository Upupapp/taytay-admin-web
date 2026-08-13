import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import {
  paginate,
  type AssistanceProgram,
  type Page,
  type PageRequest,
  type ProgramFilter,
  type ProgramId,
  type ProgramRepository,
} from '@domain/index';

import { MOCK_PROGRAMS } from './seed/programs.seed';
import { MockLatency } from './mock-latency';
import { matchesSearch, sortItems } from './mock-query';

@Injectable()
export class MockProgramRepository implements ProgramRepository {
  private readonly latency = inject(MockLatency);

  list(filter: ProgramFilter, page: PageRequest): Observable<Page<AssistanceProgram>> {
    const filtered = MOCK_PROGRAMS.filter((program) => {
      if (filter.category && program.category !== filter.category) {
        return false;
      }
      if (filter.status && program.status !== filter.status) {
        return false;
      }
      return matchesSearch([program.name, program.code, program.description], filter.search);
    });

    const sorted = sortItems(filtered, (program) => program.name, page.sort?.direction ?? 'asc');
    return this.latency.respond(paginate(sorted, page));
  }

  getById(id: ProgramId): Observable<AssistanceProgram | null> {
    return this.latency.respond(MOCK_PROGRAMS.find((program) => program.id === id) ?? null);
  }

  listActive(): Observable<readonly AssistanceProgram[]> {
    return this.latency.respond(MOCK_PROGRAMS.filter((program) => program.status === 'active'));
  }
}
