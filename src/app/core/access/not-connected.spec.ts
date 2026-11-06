import { TestBed } from '@angular/core/testing';

import { DATA_PORT_HOLDINGS, notConnectedSentence } from '@domain/index';

import { NotConnected } from './not-connected';

describe('notConnectedSentence', () => {
  it('names what the panel holds, in the words the unserved adapters use', () => {
    expect(notConnectedSentence('field-visit')).toContain(
      `does not serve ${DATA_PORT_HOLDINGS['field-visit']},`,
    );
  });

  it('says the console never asked, never that the office has none (DL-112)', () => {
    const sentence = notConnectedSentence('saved-view');
    expect(sentence).toMatch(/^Not connected yet: /);
    expect(sentence).toContain('nothing is read or saved here');
    expect(sentence).toContain('This is not a statement that there are none.');
    expect(sentence).not.toMatch(/no records|none found|empty/i);
  });
});

describe('NotConnected', () => {
  async function render(port: 'family' | 'saved-view'): Promise<HTMLElement> {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(NotConnected);
    fixture.componentRef.setInput('port', port);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the domain’s sentence for its port', async () => {
    const element = await render('family');
    expect(element.textContent?.trim()).toBe(notConnectedSentence('family'));
  });

  it('is a note, not an alert: nothing went wrong while the officer watched', async () => {
    const element = await render('saved-view');
    expect(element.querySelector('p')?.getAttribute('role')).toBe('note');
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });
});
