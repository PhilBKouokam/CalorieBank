import { describe, expect, it } from 'vitest';

import {
  createOAuth1Signature,
  createSignedOAuth1Parameters,
  normalizeOAuth1Parameters,
  oauthPercentEncode,
} from '../src/modules/fatsecret/oauth1';

describe('FatSecret OAuth 1.0 signing', () => {
  const officialStyleParameters = [
    ['oauth_consumer_key', 'demo'],
    ['oauth_signature_method', 'HMAC-SHA1'],
    ['oauth_timestamp', '12345678'],
    ['oauth_nonce', 'abc'],
    ['oauth_version', '1.0'],
    ['a', 'foo'],
    ['z', 'bar'],
  ] as const;

  it('uses RFC 3986 percent encoding and deterministic parameter ordering', () => {
    expect(oauthPercentEncode(" !'()*~")).toBe('%20%21%27%28%29%2A~');
    expect(normalizeOAuth1Parameters(officialStyleParameters)).toBe(
      'a=foo&oauth_consumer_key=demo&oauth_nonce=abc&oauth_signature_method=HMAC-SHA1&oauth_timestamp=12345678&oauth_version=1.0&z=bar',
    );
  });

  it('matches the deterministic HMAC-SHA1 signature for the documented-style base string', () => {
    expect(createOAuth1Signature({
      method: 'POST',
      url: 'https://platform.fatsecret.com/rest/server.api',
      parameters: officialStyleParameters,
      consumerSecret: 'secret',
    })).toBe('I7PmpurssJx240HVqxOK0I9yOMY=');
  });

  it('includes the token secret and callback in delegated signatures', () => {
    const signed = createSignedOAuth1Parameters({
      method: 'POST',
      url: 'https://authentication.fatsecret.com/oauth/request_token',
      consumerKey: 'consumer',
      consumerSecret: 'consumer-secret',
      token: 'request-token',
      tokenSecret: 'request-secret',
      callback: 'https://api.example.test/callback',
      timestamp: 12345678,
      nonce: 'nonce',
    });
    expect(Object.fromEntries(signed)).toMatchObject({
      oauth_callback: 'https://api.example.test/callback',
      oauth_token: 'request-token',
      oauth_signature_method: 'HMAC-SHA1',
    });
    expect(Object.fromEntries(signed).oauth_signature).toBeTruthy();
  });
});
