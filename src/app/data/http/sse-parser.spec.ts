import { firstValueFrom, from, toArray } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { changeFeedEvents, toChangeFeedEvent } from './mappers/change-feed.mapper';
import { SseParser, sseFrames, type SseFrame } from './sse-parser';

/** The stream `GET changes` sends (LIVE_CONTRACT.md), as one string. */
const STREAM =
  'retry: 5000\n' +
  ': connected\n' +
  '\n' +
  'event: ready\n' +
  'data: {"topics":["news","notifications"]}\n' +
  '\n' +
  'event: change\n' +
  'data: {"topics":["verification","notifications"]}\n' +
  '\n' +
  ': ping\n' +
  '\n' +
  'event: resync\n' +
  'data: {}\n' +
  '\n' +
  'event: expired\n' +
  'data: {}\n' +
  '\n';

const EXPECTED: readonly SseFrame[] = [
  { kind: 'retry', milliseconds: 5000 },
  { kind: 'event', event: 'ready', data: '{"topics":["news","notifications"]}' },
  { kind: 'event', event: 'change', data: '{"topics":["verification","notifications"]}' },
  { kind: 'event', event: 'resync', data: '{}' },
  { kind: 'event', event: 'expired', data: '{}' },
];

function parseInPieces(pieces: readonly string[]): SseFrame[] {
  const parser = new SseParser();
  return pieces.flatMap((piece) => [...parser.push(piece)]);
}

describe('SseParser (DL-222)', () => {
  it('reads the contract stream: retry, comments, named events and their data', () => {
    expect(parseInPieces([STREAM])).toEqual(EXPECTED);
  });

  /** The network cuts wherever it likes; every cut must read the same as none. */
  it('reads the same frames however the stream is cut', () => {
    for (let size = 1; size <= 7; size++) {
      const pieces: string[] = [];
      for (let at = 0; at < STREAM.length; at += size) pieces.push(STREAM.slice(at, at + size));
      expect(parseInPieces(pieces)).toEqual(EXPECTED);
    }
  });

  it('waits for the half of a CRLF that has not arrived, rather than ending an event early', () => {
    const crlf = STREAM.replace(/\n/g, '\r\n');
    const pieces: string[] = [];
    // Cut every line just after its \r, so the \n always arrives in the next chunk.
    for (const part of crlf.split('\n')) pieces.push(part, '\n');
    expect(parseInPieces(pieces)).toEqual(EXPECTED);
    // Bare CRs: the last one is held until the next ping shows it was not half of a CRLF.
    expect(parseInPieces([crlf.replace(/\r\n/g, '\r'), ': ping\r'])).toEqual(EXPECTED);
  });

  it('joins multi-line data, defaults the type to message and drops a frame with no data', () => {
    expect(parseInPieces(['data: one\ndata:two\n\n', 'event: lonely\n\n', 'data\n\n'])).toEqual([
      { kind: 'event', event: 'message', data: 'one\ntwo' },
      { kind: 'event', event: 'message', data: '' },
    ]);
  });

  it('ignores a byte-order mark, ids, unknown fields and a retry that is not a number', () => {
    expect(parseInPieces(['﻿id: 7\nfoo: bar\nretry: soon\nevent: resync\ndata: {}\n\n'])).toEqual([
      { kind: 'event', event: 'resync', data: '{}' },
    ]);
  });

  it('holds an unfinished event until its blank line arrives', () => {
    const parser = new SseParser();
    expect(parser.push('event: change\ndata: {"topics":["news"]}\n')).toEqual([]);
    expect(parser.push('\n')).toEqual([
      { kind: 'event', event: 'change', data: '{"topics":["news"]}' },
    ]);
  });

  it('frames a stream of chunks, one parser per subscription', async () => {
    const pieces = [STREAM.slice(0, 40), STREAM.slice(40)];
    const frames = await firstValueFrom(from(pieces).pipe(sseFrames(), toArray()));
    expect(frames).toEqual(EXPECTED);
  });
});

describe('toChangeFeedEvent — topic names and nothing else (DL-222)', () => {
  const event = (name: string, data: string): SseFrame => ({ kind: 'event', event: name, data });

  it('reads the four events of the contract', () => {
    expect(toChangeFeedEvent(event('ready', '{"topics":["news","notifications"]}'))).toEqual({
      kind: 'ready',
      topics: ['news', 'notifications'],
    });
    expect(toChangeFeedEvent(event('change', '{"topics":["residents"]}'))).toEqual({
      kind: 'change',
      topics: ['residents'],
    });
    expect(toChangeFeedEvent(event('resync', '{}'))).toEqual({ kind: 'resync' });
    expect(toChangeFeedEvent(event('expired', '{}'))).toEqual({ kind: 'expired' });
  });

  /** The contract promises no ids; the mapper does not take that on trust. */
  it('keeps only topics when the server sends more', () => {
    const read = toChangeFeedEvent(
      event('change', '{"topics":["cases"],"id":"case-7","resident":"Cruz, M.","count":3}'),
    );
    expect(read).toEqual({ kind: 'change', topics: ['cases'] });
    expect(Object.keys(read ?? {})).toEqual(['kind', 'topics']);
  });

  it('keeps only strings shaped like a topic name', () => {
    expect(
      toChangeFeedEvent(event('change', '{"topics":["cases",7,{"id":1},"Cases","a b","work"]}')),
    ).toEqual({ kind: 'change', topics: ['cases', 'work'] });
  });

  it('drops what it cannot read, and frames it does not use', () => {
    expect(toChangeFeedEvent(event('change', 'not json'))).toBeNull();
    expect(toChangeFeedEvent(event('change', '{"topics":"cases"}'))).toBeNull();
    expect(toChangeFeedEvent(event('change', '{"topics":[]}'))).toBeNull();
    expect(toChangeFeedEvent(event('message', '{"topics":["cases"]}'))).toBeNull();
    expect(toChangeFeedEvent({ kind: 'retry', milliseconds: 5000 })).toBeNull();
  });

  it('turns the contract stream into events, the retry dropped', async () => {
    const events = await firstValueFrom(
      from([STREAM]).pipe(sseFrames(), changeFeedEvents(), toArray()),
    );
    expect(events).toEqual([
      { kind: 'ready', topics: ['news', 'notifications'] },
      { kind: 'change', topics: ['verification', 'notifications'] },
      { kind: 'resync' },
      { kind: 'expired' },
    ]);
  });
});
