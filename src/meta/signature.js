import crypto from 'crypto';

/**
 * Verifies Meta's X-Hub-Signature-256 header ("sha256=<hex>") against the raw
 * request body using the app secret.
 */
export function isValidSignature(rawBody, header, appSecret) {
  if (!appSecret || !header || !Buffer.isBuffer(rawBody)) return false;
  const [algo, received] = String(header).split('=');
  if (algo !== 'sha256' || !/^[a-f0-9]{64}$/i.test(received || '')) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
}
