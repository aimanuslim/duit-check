// Optional passphrase encryption for backups (AES-GCM, key from PBKDF2). All local, WebCrypto only.
const ITER = 310_000;
const enc = new TextEncoder();

const b64 = (b: ArrayBuffer | Uint8Array) => {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export interface Sealed {
  alg: 'AES-GCM';
  kdf: 'PBKDF2-SHA256';
  iter: number;
  salt: string;
  iv: string;
  data: string;
}

async function key(pass: string, salt: Uint8Array, iter: number, use: KeyUsage) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, [use]);
}

export async function seal(text: string, pass: string): Promise<Sealed> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(pass, salt, ITER, 'encrypt'), enc.encode(text));
  return { alg: 'AES-GCM', kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64(salt), iv: b64(iv), data: b64(data) };
}

/** Throws if the passphrase is wrong. */
export async function unseal(s: Sealed, pass: string): Promise<string> {
  const out = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(s.iv) as BufferSource }, await key(pass, unb64(s.salt), s.iter, 'decrypt'), unb64(s.data) as BufferSource);
  return new TextDecoder().decode(out);
}
