import { env } from "cloudflare:workers";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { data, Form, redirect, useNavigation, useSubmit } from "react-router";

import type { Route } from "./+types/login";
import { Perforation } from "~/components/ticket";
import { finishLoginSuccess, beginLoginAttempt, formatWait } from "~/lib/rate-limit.server";
import {
  assertSameOrigin,
  clientIp,
  configProblem,
  createSessionCookie,
  pinMatches,
  readSession,
} from "~/lib/session.server";

export function meta() {
  return [{ title: "Masuk - Daftar tugas" }, { name: "robots", content: "noindex" }];
}

/** Passes headers from the action (such as Retry-After) through to the page response. */
export function headers({ actionHeaders }: Route.HeadersArgs) {
  return actionHeaders;
}

export async function loader({ request }: Route.LoaderArgs) {
  if (await readSession(request, env)) throw redirect("/");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);

  const problem = configProblem(env);
  if (problem) return data({ error: problem }, { status: 500 });

  const form = await request.formData();
  const pin = String(form.get("pin") ?? "").trim();
  if (!/^\d{6}$/.test(pin)) return data({ error: "Masukkan 6 digit angka." }, { status: 400 });

  const ip = clientIp(request);
  const gate = await beginLoginAttempt(env, ip);
  if (!gate.ok) {
    const where = gate.scope === "ip" ? "Terlalu banyak percobaan." : "Terlalu banyak percobaan dari semua perangkat.";
    return data(
      { error: `${where} Coba lagi dalam ${formatWait(gate.retryAfterMs)}.` },
      { status: 429, headers: { "Retry-After": String(Math.ceil(gate.retryAfterMs / 1000)) } },
    );
  }

  if (!(await pinMatches(pin, env))) {
    const error =
      gate.remaining > 0
        ? `PIN salah. Sisa ${gate.remaining} percobaan.`
        : `PIN salah. Percobaan habis, coba lagi dalam ${formatWait(gate.retryAfterMs)}.`;
    return data({ error }, { status: 401 });
  }

  await finishLoginSuccess(env, ip);
  return redirect("/", { headers: { "Set-Cookie": await createSessionCookie(request, env) } });
}

export default function Login({ actionData }: Route.ComponentProps) {
  const submit = useSubmit();
  const navigation = useNavigation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pin, setPin] = useState("");
  const busy = navigation.state !== "idle";

  // After a rejected PIN, clear the field and get ready for the next attempt.
  useEffect(() => {
    if (actionData?.error) {
      setPin("");
      inputRef.current?.focus();
    }
  }, [actionData]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 6);
    setPin(digits);
    if (digits.length === 6) submit({ pin: digits }, { method: "post" });
  }

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16">
      <article className="ticket w-full max-w-[19rem]">
        <span className="hole" aria-hidden="true" />
        <h1 className="ticket-title">Masuk</h1>
        <Perforation />
        <Form method="post">
          <label htmlFor="pin" className="ticket-body block">
            Masukkan PIN 6 digit.
          </label>
          <input
            ref={inputRef}
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            autoFocus
            maxLength={6}
            value={pin}
            readOnly={busy}
            onChange={handleChange}
            aria-describedby="pin-message"
            className="field-pin mt-6"
          />
          <p id="pin-message" role="alert" className="error-text mt-4 min-h-[3.25rem]">
            {busy ? "Memeriksa PIN" : actionData?.error}
          </p>
        </Form>
      </article>
    </main>
  );
}
