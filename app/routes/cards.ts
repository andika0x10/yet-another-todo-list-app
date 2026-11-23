import { env } from "cloudflare:workers";
import { data, redirect } from "react-router";

import type { Route } from "./+types/cards";
import { notifyBoard } from "~/lib/board.server";
import {
  archiveCard,
  createCard,
  deleteCard,
  reorderCards,
  restoreCard,
  updateCard,
  type CardResult,
} from "~/lib/cards.server";
import { formatWait, limitMutations } from "~/lib/rate-limit.server";
import { assertSameOrigin, requireSession } from "~/lib/session.server";

const MAX_REORDER_IDS = 1000;

export function loader() {
  return redirect("/");
}

function parseIds(raw: string): string[] | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || value.length > MAX_REORDER_IDS) return null;
    return value.every((item) => typeof item === "string") ? (value as string[]) : null;
  } catch {
    return null;
  }
}

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const session = await requireSession(request, env);

  const limit = await limitMutations(env, session.sid);
  if (!limit.allowed) {
    return data(
      { ok: false as const, error: `Terlalu banyak perubahan. Coba lagi dalam ${formatWait(limit.retryAfterMs)}.` },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const form = await request.formData();
  const text = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value : "";
  };

  const id = text("id");
  let result: CardResult;
  switch (text("intent")) {
    case "create":
      result = await createCard(env.DB, text("title"), text("body"));
      break;
    case "update":
      result = await updateCard(env.DB, id, text("title"), text("body"));
      break;
    case "archive":
      result = await archiveCard(env.DB, id);
      break;
    case "restore":
      result = await restoreCard(env.DB, id);
      break;
    case "delete":
      result = await deleteCard(env.DB, id);
      break;
    case "reorder": {
      const ids = parseIds(text("ids"));
      result = ids
        ? await reorderCards(env.DB, ids)
        : { ok: false, error: "Urutan kartu tidak valid.", status: 400 };
      break;
    }
    default:
      result = { ok: false, error: "Aksi tidak dikenal.", status: 400 };
  }

  if (!result.ok) {
    return data({ ok: false as const, error: result.error }, { status: result.status });
  }

  await notifyBoard(env, text("clientId").slice(0, 64));
  return data({ ok: true as const });
}
