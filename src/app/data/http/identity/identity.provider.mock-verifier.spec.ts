import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SignInError } from '@domain/index';

import { developmentSubject, IdentityProvider, identitySignInMethod } from './identity.provider.mock-verifier';

/**
 * The development verifier composes the credential a backend running `AUTH_VERIFIER=mock`
 * accepts. Its parts are asserted one by one rather than as a literal, so no credential-shaped
 * string is committed even here.
 */
describe('the development verifier (local-api only)', () => {
  let provider: IdentityProvider;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    provider = TestBed.inject(IdentityProvider);
    http = TestBed.inject(HttpTestingController);
  });

  // It reaches no network of its own: the API verifies what it composed.
  afterEach(() => http.verify());

  async function idTokenFor(email: string, password: string, claim?: 'staff' | 'admin'): Promise<string> {
    const result = await firstValueFrom(
      provider.signIn(claim === undefined ? { email, password } : { email, password, developmentRoleClaim: claim }),
    );

    if (result.kind !== 'signed-in') {
      throw new Error('expected a grant');
    }

    expect(result.grant.expiresAt).toBeNull();
    return result.grant.idToken;
  }

  it('composes scheme, chosen role and subject from what was typed', async () => {
    const parts = (await idTokenFor('  Alice.Dev@Example.invalid ', 'anything', 'admin')).split(':');

    expect(parts).toEqual(['mock', 'admin', 'alice.dev.example.invalid']);
  });

  it('asks for the least privilege when no role was chosen', async () => {
    expect((await idTokenFor('alice@example.invalid', 'anything')).split(':')[1]).toBe('staff');
  });

  it('ignores the password entirely', async () => {
    expect(await idTokenFor('alice@example.invalid', 'one')).toBe(await idTokenFor('alice@example.invalid', 'two'));
  });

  it("keeps the subject inside the backend's charset and length", () => {
    expect(developmentSubject('o’brien+test@exa mple.invalid')).toBe('obrientest.example.invalid');
    expect(developmentSubject(`${'a'.repeat(80)}@example.invalid`)).toHaveLength(64);
    expect(developmentSubject(`${'a'.repeat(80)}@example.invalid`)).toMatch(/^[A-Za-z0-9._-]{1,64}$/);
  });

  it('refuses an address that leaves no subject, with the uniform message', async () => {
    await expect(firstValueFrom(provider.signIn({ email: '  ', password: 'x' }))).rejects.toSatisfy(
      (error: unknown) => error instanceof SignInError && error.reason === 'invalid-credentials',
    );
  });

  it('has no second factor and nothing to refresh', async () => {
    await expect(firstValueFrom(provider.finalizeMfa())).rejects.toBeInstanceOf(SignInError);
    await expect(firstValueFrom(provider.refresh())).rejects.toBeInstanceOf(SignInError);
  });

  it('tells the sign-in screen what it is, in the words check:bundle looks for in a production artefact', () => {
    const method = identitySignInMethod();

    expect(method.kind).toBe('development-verifier');
    if (method.kind === 'development-verifier') {
      expect(method.roleClaims).toEqual(['staff', 'admin']);
      expect(method.explanation.join(' ')).toContain('Development mock verifier');
      expect(method.explanation.join(' ')).toMatch(/only the first time/);
      expect(method.explanation.join(' ')).toMatch(/Nothing checks the password/);
    }
  });
});
