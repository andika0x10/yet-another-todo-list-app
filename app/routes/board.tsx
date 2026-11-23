import { env } from "cloudflare:workers";
import { useEffect, useRef } from "react";
import { Form, NavLink, Outlet, useRevalidator } from "react-router";

import type { Route } from "./+types/board";
import { countCards } from "~/lib/cards.server";
import { clientId } from "~/lib/client";
import { requireSession } from "~/lib/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  await requireSession(request, env);
  return { counts: await countCards(env.DB) };
}

/** Opens a WebSocket to the Board Durable Object and reloads the list when another device changes a card. */
function useLiveSync() {
  const { revalidate } = useRevalidator();
  const revalidateRef = useRef(revalidate);
  revalidateRef.current = revalidate;

  useEffect(() => {
    let socket: WebSocket | undefined;
    let closed = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let pingTimer: ReturnType<typeof setInterval> | undefined;

    function connect() {
      const scheme = location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${scheme}://${location.host}/ws`);

      socket.onopen = () => {
        // After reconnecting, pick up any changes that were missed.
        if (attempt > 0) void revalidateRef.current();
        attempt = 0;
        pingTimer = setInterval(() => socket?.send("ping"), 30_000);
      };

      socket.onmessage = (event) => {
        if (event.data === "pong") return;
        try {
          const message = JSON.parse(String(event.data));
          if (message.type === "changed" && message.from !== clientId) void revalidateRef.current();
        } catch {
          // Unknown messages are ignored.
        }
      };

      socket.onclose = () => {
        clearInterval(pingTimer);
        if (closed) return;
        attempt += 1;
        retryTimer = setTimeout(connect, Math.min(30_000, 1000 * 2 ** attempt));
      };
    }

    function onVisible() {
      if (document.visibilityState === "visible") void revalidateRef.current();
    }

    connect();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      closed = true;
      clearTimeout(retryTimer);
      clearInterval(pingTimer);
      document.removeEventListener("visibilitychange", onVisible);
      socket?.close();
    };
  }, []);
}

const tabClass = ({ isActive }: { isActive: boolean }) =>
  [
    "-mb-px inline-flex items-baseline gap-2 border-b-2 pb-3 text-[1.125rem] font-bold leading-none",
    isActive ? "border-steel text-steel" : "border-transparent text-steel-muted hover:text-steel",
  ].join(" ");

export default function Board({ loaderData }: Route.ComponentProps) {
  const { counts } = loaderData;
  useLiveSync();

  return (
    <div className="mx-auto w-full max-w-[70rem] px-4 pt-10 pb-28 sm:px-6 sm:pt-16">
      <header className="flex items-start justify-between gap-6">
        <h1 className="font-display text-[2.25rem] font-bold leading-none tracking-[-0.03em] sm:text-[3rem]">
          Daftar tugas
        </h1>
        <Form method="post" action="/logout">
          <button type="submit" className="link mt-1">
            Keluar
          </button>
        </Form>
      </header>

      <nav aria-label="Daftar kartu" className="mt-10 flex gap-8 border-b border-steel/20">
        <NavLink to="/" end className={tabClass}>
          Aktif
          <span className="font-receipt text-sm font-normal text-steel-muted">{counts.active}</span>
        </NavLink>
        <NavLink to="/archive" className={tabClass}>
          Arsip
          <span className="font-receipt text-sm font-normal text-steel-muted">{counts.archived}</span>
        </NavLink>
      </nav>

      <main className="mt-10">
        <Outlet />
      </main>
    </div>
  );
}
