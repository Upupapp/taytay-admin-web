import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { EmptyState, type EmptyStateVariant } from './empty-state';

async function render(inputs: Record<string, unknown> = {}): Promise<ComponentFixture<EmptyState>> {
  const fixture = TestBed.createComponent(EmptyState);
  fixture.componentRef.setInput('heading', 'No residents yet');
  for (const [key, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(key, value);
  }
  await fixture.whenStable();
  return fixture;
}

describe('EmptyState', () => {
  it('renders the heading', async () => {
    const element = (await render()).nativeElement as HTMLElement;
    expect(element.querySelector('.empty__heading')?.textContent).toContain('No residents yet');
  });

  it('omits the message and action when not supplied', async () => {
    const element = (await render()).nativeElement as HTMLElement;
    expect(element.querySelector('.empty__message')).toBeNull();
    expect(element.querySelector('button')).toBeNull();
  });

  it('distinguishes the variants visually', async () => {
    const variants: readonly EmptyStateVariant[] = ['empty', 'no-results', 'error', 'forbidden'];
    for (const variant of variants) {
      const element = (await render({ variant })).nativeElement as HTMLElement;
      expect(element.querySelector(`.empty--${variant}`)).not.toBeNull();
    }
  });

  it('emits when the action is chosen', async () => {
    const fixture = await render({ actionLabel: 'Clear filters' });
    let emitted = 0;
    fixture.componentInstance.actionSelected.subscribe(() => (emitted += 1));

    const button = (fixture.nativeElement as HTMLElement).querySelector('button');
    (button as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(emitted).toBe(1);
  });

  it('hides its decorative glyph from assistive technology', async () => {
    const element = (await render()).nativeElement as HTMLElement;
    expect(element.querySelector('.empty__glyph')?.getAttribute('aria-hidden')).toBe('true');
  });
});
