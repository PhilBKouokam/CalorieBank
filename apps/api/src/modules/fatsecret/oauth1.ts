import { createHmac, randomBytes } from 'node:crypto';

export type OAuth1Parameter = readonly [name: string, value: string];

export function oauthPercentEncode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function normalizeOAuth1Parameters(parameters: readonly OAuth1Parameter[]) {
  return parameters
    .filter(([name]) => name !== 'oauth_signature')
    .map(([name, value]) => [oauthPercentEncode(name), oauthPercentEncode(value)] as const)
    .sort(([leftName, leftValue], [rightName, rightValue]) => {
      if (leftName !== rightName) return leftName < rightName ? -1 : 1;
      if (leftValue === rightValue) return 0;
      return leftValue < rightValue ? -1 : 1;
    })
    .map(([name, value]) => `${name}=${value}`)
    .join('&');
}

export function createOAuth1Signature(input: {
  method: string;
  url: string;
  parameters: readonly OAuth1Parameter[];
  consumerSecret: string;
  tokenSecret?: string;
}) {
  const baseString = [
    input.method.toUpperCase(),
    oauthPercentEncode(input.url),
    oauthPercentEncode(normalizeOAuth1Parameters(input.parameters)),
  ].join('&');
  const signingKey = `${oauthPercentEncode(input.consumerSecret)}&${oauthPercentEncode(input.tokenSecret ?? '')}`;
  return createHmac('sha1', signingKey).update(baseString).digest('base64');
}

export function createSignedOAuth1Parameters(input: {
  method: string;
  url: string;
  consumerKey: string;
  consumerSecret: string;
  token?: string;
  tokenSecret?: string;
  callback?: string;
  verifier?: string;
  requestParameters?: readonly OAuth1Parameter[];
  timestamp?: number;
  nonce?: string;
}) {
  const parameters: OAuth1Parameter[] = [
    ['oauth_consumer_key', input.consumerKey],
    ['oauth_nonce', input.nonce ?? randomBytes(16).toString('hex')],
    ['oauth_signature_method', 'HMAC-SHA1'],
    ['oauth_timestamp', String(input.timestamp ?? Math.floor(Date.now() / 1000))],
    ['oauth_version', '1.0'],
    ...(input.token ? [['oauth_token', input.token] as const] : []),
    ...(input.callback ? [['oauth_callback', input.callback] as const] : []),
    ...(input.verifier ? [['oauth_verifier', input.verifier] as const] : []),
    ...(input.requestParameters ?? []),
  ];
  return [
    ...parameters,
    ['oauth_signature', createOAuth1Signature({
      method: input.method,
      url: input.url,
      parameters,
      consumerSecret: input.consumerSecret,
      ...(input.tokenSecret === undefined ? {} : { tokenSecret: input.tokenSecret }),
    })] as const,
  ];
}

export function oauth1Query(parameters: readonly OAuth1Parameter[]) {
  const query = new URLSearchParams();
  for (const [name, value] of parameters) query.append(name, value);
  return query;
}
