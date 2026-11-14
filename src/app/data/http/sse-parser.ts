import { Observable, type OperatorFunction } from 'rxjs';

/**
 * One thing a server-sent event stream said: an event (its type and data), or a reconnection
 * delay. Comments (`: ping`) and `id:` lines say nothing this console uses, so they produce
 * nothing.
 */
export type SseFrame =
  | { readonly kind: 'event'; readonly event: string; readonly data: string }
  | { readonly kind: 'retry'; readonly milliseconds: number };

/**
 * The `text/event-stream` format, read as the HTML standard reads it — pure, with no I/O, so it can
 * be fed text cut anywhere (`DL-222`).
 *
 * The network cuts a stream wherever it likes: between `data:` and its value, in the middle of a
 * `\r\n`, or between the two newlines that end an event. So text is buffered until a whole line is
 * held, and a line ending in a lone `\r` waits for the next chunk in case it is the first half of a
 * `\r\n` — read early, it would end an event that has not finished.
 *
 * - A blank line dispatches the event built so far; with no `data:` it dispatches nothing.
 * - `event:` names it (`message` when unnamed); each `data:` adds a line to it.
 * - `retry:` with only digits is a reconnection delay; anything else in it is ignored.
 * - A line starting with `:` is a comment; `id:` and unknown fields are ignored.
 * - One space after the colon is not part of the value.
 */
export class SseParser {
  private pending = '';
  private started = false;
  private eventType = '';
  private dataLines: string[] = [];

  /** Feeds a piece of the stream; answers every frame it completed, in order. */
  push(chunk: string): readonly SseFrame[] {
    let text = this.pending + chunk;
    if (!this.started && text.length > 0) {
      this.started = true;
      // A byte-order mark is allowed once, at the very start of the stream.
      if (text.startsWith('﻿')) {
        text = text.slice(1);
      }
    }

    const frames: SseFrame[] = [];
    let from = 0;

    for (;;) {
      const newline = /\r\n|\r|\n/g;
      newline.lastIndex = from;
      const end = newline.exec(text);
      if (end === null) {
        break;
      }
      // `\r` as the last character held may be half of `\r\n`: wait for the next chunk.
      if (end[0] === '\r' && end.index === text.length - 1) {
        break;
      }
      this.line(text.slice(from, end.index), frames);
      from = end.index + end[0].length;
    }

    this.pending = text.slice(from);
    return frames;
  }

  private line(line: string, frames: SseFrame[]): void {
    if (line === '') {
      if (this.dataLines.length > 0) {
        frames.push({
          kind: 'event',
          event: this.eventType === '' ? 'message' : this.eventType,
          data: this.dataLines.join('\n'),
        });
      }
      this.eventType = '';
      this.dataLines = [];
      return;
    }

    if (line.startsWith(':')) {
      return;
    }

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    const raw = colon === -1 ? '' : line.slice(colon + 1);
    const value = raw.startsWith(' ') ? raw.slice(1) : raw;

    switch (field) {
      case 'event':
        this.eventType = value;
        break;
      case 'data':
        this.dataLines.push(value);
        break;
      case 'retry':
        if (/^\d+$/.test(value)) {
          frames.push({ kind: 'retry', milliseconds: Number(value) });
        }
        break;
      default:
        // `id` and any field the standard does not define: nothing this console reads.
        break;
    }
  }
}

/** Frames out of a stream of text chunks; one parser per subscription. */
export function sseFrames(): OperatorFunction<string, SseFrame> {
  return (source) =>
    new Observable<SseFrame>((subscriber) => {
      const parser = new SseParser();
      return source.subscribe({
        next: (chunk) => {
          for (const frame of parser.push(chunk)) {
            subscriber.next(frame);
          }
        },
        error: (error: unknown) => subscriber.error(error),
        complete: () => subscriber.complete(),
      });
    });
}
