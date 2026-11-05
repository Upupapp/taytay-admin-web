import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { PageHeader } from '@shared/ui/page-header/page-header';

import { BannersSection } from './banners-section';
import { HOME_SCREEN_COPY } from './home-screen.copy';
import { LinksSection } from './links-section';
import { PreviewSection } from './preview-section';

/**
 * The residents' app home screen (`DL-170`): its banners and quick links, and what the app is given
 * now beside them.
 *
 * **Residents see this**, and the title block says so first: this is the first screen every resident
 * opens. A save in either list reads the preview again, so what is shown as "now" is the server's
 * answer after the change rather than the form's idea of it.
 */
@Component({
  selector: 'app-home-screen-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BannersSection, LinksSection, PageHeader, PreviewSection],
  templateUrl: './home-screen-page.html',
  styleUrl: './home-screen.scss',
})
export class HomeScreenPage {
  protected readonly copy = HOME_SCREEN_COPY.page;
  protected readonly previewGeneration = signal(0);

  protected refreshPreview(): void {
    this.previewGeneration.update((n) => n + 1);
  }
}
