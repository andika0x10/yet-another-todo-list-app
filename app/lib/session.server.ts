import { data, redirect } from "react-router";

const COOKIE_NAME = "session";
const SESSION_DAYS = 30;
const encoder = new TextEncoder();

export interface Session {
  sid: string;
  exp: number;
}

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> | null {
  if (!/^(?:[0-9a-f]{2})+$/.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/** The signing key is derived from SESSION_SECRET and the PIN, so changing the PIN signs everyone out. */
function signingKey(env: Env): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(`${env.SESSION_SECRET}\n${env.PIN}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Returns a message if the secrets are not configured correctly, or null if they are fine. */
export function configProblem(env: Env): string | null {
  if (!/^\d{6}$/.test(env.PIN ?? "")) {
    return "PIN belum diatur di server. PIN harus 6 digit angka.";
  }
  if ((env.SESSION_SECRET ?? "").length < 16) {
    return "SESSION_SECRET belum diatur di server. Isi minimal 16 karakter.";
  }
  return null;
}

async function sha256(text: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", encoder.encode(text));
}

/** Constant-time comparison: both sides are hashed first so they have the same length. */
export async function pinMatches(input: string, env: Env): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(input), sha256(env.PIN)]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let difference = left.length ^ right.length;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}

function cookieAttributes(request: Request, maxAge: number): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

/** Builds the Set-Cookie header value for a new session. */
export async function createSessionCookie(request: Request, env: Env): Promise<string> {
  const sid = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `v1.${sid}.${exp}`;
  const signature = await crypto.subtle.sign("HMAC", await signingKey(env), encoder.encode(payload));
  return `${COOKIE_NAME}=${payload}.${toHex(signature)}; ${cookieAttributes(request, SESSION_DAYS * 24 * 60 * 60)}`;
}

export function clearSessionCookie(request: Request): string {
  return `${COOKIE_NAME}=; ${cookieAttributes(request, 0)}`;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq) === name) return part.slice(eq + 1);
  }
  return null;
}

/** Reads and verifies the session cookie. Returns null if it is missing, malformed, or expired. */
export async function readSession(request: Request, env: Env): Promise<Session | null> {
  if (configProblem(env)) return null;
  const value = readCookie(request, COOKIE_NAME);
  if (!value) return null;

  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  const [version, sid, expText, signatureHex] = parts;

  const exp = Number(expText);
  if (!/^[0-9a-f]{32}$/.test(sid) || !Number.isFinite(exp) || exp < Date.now()) return null;

  const signature = fromHex(signatureHex);
  if (!signature) return null;

  const valid = await crypto.subtle.verify(
    "HMAC",
    await signingKey(env),
    signature,
    encoder.encode(`${version}.${sid}.${expText}`),
  );
  return valid ? { sid, exp } : null;
}

/** Used in every loader and action. Without a valid session the user is sent to the PIN page. */
export async function requireSession(request: Request, env: Env): Promise<Session> {
  const session = await readSession(request, env);
  if (!session) throw redirect("/login");
  return session;
}

/** Rejects write requests that come from another site. */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw data("Forbidden", { status: 403 });
  }
}

export function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "tidak-diketahui";
}
