import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  generationRows,
  type FamilyGraph,
  type GraphEdge,
  type GraphNode,
  type InverseKind,
  type Relationship,
  type ResidentId,
} from '@domain/index';

import { RELATIONSHIP_COPY } from './relationship.copy';

export interface EndRelationshipRequest {
  readonly relationshipId: Relationship['id'];
  readonly description: string;
}

/**
 * The relationship graph.
 *
 * **The graph is the list** (`DL-50`). There is no canvas, no SVG and no text
 * alternative bolted beside a picture — those are two artifacts, and the one
 * that stops being maintained is always the text. Instead the primary artifact
 * is a structured list of people, each stating in words who they are to
 * everyone else, and CSS arranges those same list items into generation rows.
 *
 * What that buys, in the order it matters:
 *
 *  - **Nothing is carried by a line or a colour.** "Ana is the parent of Ben"
 *    is a sentence in the DOM. Remove every stylesheet and the meaning is
 *    unchanged, which is the only test of this that is worth anything.
 *  - **Keyboard and screen reader get the real thing**, not a summary of it —
 *    real headings, real lists, real links, in reading order.
 *  - **A second view for checking.** The per-person view answers "who is this
 *    person to everyone else"; the edge view lists every link exactly once,
 *    which is the question somebody proof-reading the record is actually
 *    asking. Both are rendered from the same data.
 */
@Component({
  selector: 'app-relationship-graph',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="graph" aria-labelledby="relationship-graph-heading">
      <header class="graph__header">
        <h2 class="graph__heading" id="relationship-graph-heading">{{ copy.graphHeading }}</h2>
        <p class="graph__summary">{{ copy.graphSummary }}</p>
      </header>

      <fieldset class="graph__views">
        <legend class="graph__views-legend">{{ copy.viewLabel }}</legend>
        <label class="graph__view">
          <input
            type="radio"
            name="relationship-view"
            [checked]="view() === 'people'"
            (change)="view.set('people')"
          />
          <span>{{ copy.listView }}</span>
        </label>
        <label class="graph__view">
          <input
            type="radio"
            name="relationship-view"
            [checked]="view() === 'edges'"
            (change)="view.set('edges')"
          />
          <span>{{ copy.edgeView }}</span>
        </label>
      </fieldset>

      @if (view() === 'people') {
        @if (rows().length === 0) {
          <p class="graph__empty">{{ copy.noRelationships }}</p>
        } @else {
          <!-- One list per generation. The heading names the generation in
               words, so the vertical arrangement is reinforcement and never
               the only way to know where somebody sits. -->
          @for (row of rows(); track rowKey($index)) {
            <section class="graph__row" [attr.aria-label]="generationLabel(row)">
              <h3 class="graph__row-heading">{{ generationLabel(row) }}</h3>
              <ul class="graph__people">
                @for (node of row; track node.view.resident.id) {
                  <li class="graph__person" [class.graph__person--former]="!node.isCurrentMember">
                    <p class="graph__name">
                      <a
                        class="graph__name-link"
                        [routerLink]="['/residents', node.view.resident.id]"
                      >
                        {{ node.view.listedName }}
                      </a>
                      @if (node.role; as role) {
                        <span class="graph__role">{{ copy.roleLabel[role] }}</span>
                      }
                      @if (!node.isCurrentMember) {
                        <span class="graph__former">{{ copy.formerMember }}</span>
                      }
                    </p>

                    @if (node.edges.length > 0) {
                      <ul class="graph__edges">
                        @for (edge of node.edges; track edge.relationshipId) {
                          <li class="graph__edge" [class.graph__edge--ended]="!edge.isCurrent">
                            {{ kindLabel(edge.kind) }}
                            <a [routerLink]="['/residents', edge.otherResidentId]">
                              {{ edge.otherName }}
                            </a>
                            <span class="graph__edge-state">{{ stateOf(edge) }}</span>
                          </li>
                        }
                      </ul>
                    } @else {
                      <p class="graph__no-edges">{{ copy.noEdges }}</p>
                    }
                  </li>
                }
              </ul>
            </section>
          }
        }
      } @else {
        <table class="graph__table">
          <caption class="graph__caption">
            {{
              copy.edgeView
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">Person</th>
              <th scope="col">Is the</th>
              <th scope="col">Of</th>
              <th scope="col">State</th>
            </tr>
          </thead>
          <tbody>
            @for (edge of graph().edges; track edge.id) {
              <tr>
                <th scope="row">{{ nameOf(edge.fromResidentId) }}</th>
                <td>{{ kindLabel(edge.kind) }}</td>
                <td>{{ nameOf(edge.toResidentId) }}</td>
                <td>{{ edgeState(edge) }}</td>
              </tr>
            } @empty {
              <tr>
                <td class="graph__empty-cell" colspan="4">{{ copy.noEdges }}</td>
              </tr>
            }
          </tbody>
        </table>
      }

      @if (canManage()) {
        <div class="graph__actions">
          <button type="button" class="btn btn--subtle" (click)="addRequested.emit()">
            {{ addLabel() }}
          </button>
        </div>
      }
    </section>
  `,
  styleUrl: './relationship-graph.scss',
})
export class RelationshipGraph {
  readonly graph = input.required<FamilyGraph>();
  readonly canManage = input(false);
  readonly addLabel = input('Record a relationship');

  readonly addRequested = output<void>();

  protected readonly copy = RELATIONSHIP_COPY;
  protected readonly view = signal<'people' | 'edges'>('people');

  protected readonly rows = computed(() => generationRows(this.graph()));

  private readonly names = computed(() => {
    const map = new Map<ResidentId, string>();
    for (const node of this.graph().nodes) {
      map.set(node.view.resident.id, node.view.listedName);
    }
    return map;
  });

  protected rowKey(index: number): string {
    return `row-${index}`;
  }

  /**
   * Names the generation in words. Without this the only cue is vertical
   * position, which is exactly the "lines and colour alone" failure the whole
   * component exists to avoid.
   */
  protected generationLabel(row: readonly GraphNode[]): string {
    const level = row[0]?.generation ?? 0;
    switch (level) {
      case 0:
        return this.copy.generationSame;
      case -1:
        return this.copy.generationAbove;
      case 1:
        return this.copy.generationBelow;
      default:
        return level < -1 ? this.copy.generationFurtherAbove : this.copy.generationFurtherBelow;
    }
  }

  protected kindLabel(kind: InverseKind): string {
    return this.copy.kindLabel[kind];
  }

  protected nameOf(residentId: ResidentId): string {
    return this.names().get(residentId) ?? 'Unknown resident';
  }

  /** Current or ended, said in words with its dates. Never a colour alone. */
  protected stateOf(edge: GraphEdge): string {
    if (edge.isCurrent) {
      return edge.since === null
        ? this.copy.currentRelationship
        : `${this.copy.currentRelationship}, ${this.copy.since} ${edge.since}`;
    }
    return edge.until === null
      ? this.copy.formerRelationship
      : `${this.copy.formerRelationship} ${edge.until}`;
  }

  protected edgeState(edge: Relationship): string {
    return edge.until === null
      ? this.copy.currentRelationship
      : `${this.copy.formerRelationship} ${edge.until}`;
  }
}
