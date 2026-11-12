import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

/**
 * The file picker for a data file — a list the office imports (`DL-214`) — as `ImageFileField` is
 * for a picture: one shared field, so no feature carries a file input of its own
 * (`check:directory`), and every file is refused here first when the API would refuse it.
 *
 * **Choosing sends nothing.** The field checks the file's extension and size against what it is
 * given, says plainly when it refuses (and that nothing was sent), and hands the accepted `File` up;
 * only the page's own button sends it. The limits are said before the picker, because the picker is
 * a button that acts.
 */
@Component({
  selector: 'app-data-file-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field">
      <label class="field__label" [for]="inputId()">{{ label() }}</label>
      <p class="field__hint" [id]="inputId() + '-limits'">{{ limits() }}</p>
      <input
        #picker
        type="file"
        class="field__input"
        [id]="inputId()"
        [attr.aria-describedby]="inputId() + '-limits ' + inputId() + '-hint'"
        [accept]="extensions().join(',')"
        [disabled]="disabled()"
        (change)="choose(picker)"
      />
      <p class="field__hint" [id]="inputId() + '-hint'">{{ hint() }}</p>
      @if (refusal(); as message) {
        <p class="field__error" role="alert">{{ message }}</p>
      }
    </div>
  `,
})
export class DataFileField {
  readonly label = input.required<string>();
  /** Unique on the page: the label, the sentences and the input are tied together by it. */
  readonly inputId = input.required<string>();
  /** What the API accepts, said before the picker. */
  readonly limits = input.required<string>();
  readonly hint = input('');
  /** Lower-case, with the dot: `.csv`, `.xlsx`. */
  readonly extensions = input.required<readonly string[]>();
  readonly maxBytes = input.required<number>();
  readonly wrongKind = input.required<string>();
  readonly tooBig = input.required<string>();
  readonly disabled = input(false);

  /** The accepted file, or `null` when the choice was cleared or refused. */
  readonly chosen = output<File | null>();

  protected readonly refusal = signal('');

  protected choose(picker: HTMLInputElement): void {
    const file = picker.files?.item(0) ?? null;
    this.refusal.set('');
    if (file === null) {
      this.chosen.emit(null);
      return;
    }
    const name = file.name.toLowerCase();
    const refusal = !this.extensions().some((extension) => name.endsWith(extension))
      ? this.wrongKind()
      : file.size > this.maxBytes()
        ? this.tooBig()
        : '';
    if (refusal !== '') {
      picker.value = '';
      this.refusal.set(refusal);
      this.chosen.emit(null);
      return;
    }
    this.chosen.emit(file);
  }
}
