const crypto = require('node:crypto');

const DEFAULT_TTL_MS = 60_000;
const HANDSHAKE_VERSION = 'v1';

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function createCapabilityToken(payload, secret, ttlMs = DEFAULT_TTL_MS) {
  const now = Date.now();
  const normalizedPayload = {
    ...payload,
    version: HANDSHAKE_VERSION,
    issuedAt: payload.issuedAt || now,
    expiresAt: payload.expiresAt || now + ttlMs,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'echo-pact-handshake' }));
  const encodedPayload = base64UrlEncode(JSON.stringify(normalizedPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', secret).update(signingInput).digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyCapabilityToken(token, secret) {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(signingInput).digest('base64url');
  const signatureBuffer = Buffer.from(signature, 'base64url');
  const expectedBuffer = Buffer.from(expectedSignature, 'base64url');

  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (!payload || payload.version !== HANDSHAKE_VERSION) return null;
    if (payload.expiresAt && payload.expiresAt <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = {
  createCapabilityToken,
  verifyCapabilityToken,
  DEFAULT_TTL_MS,
};
