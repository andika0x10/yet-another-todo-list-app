import { env } from "cloudflare:workers";

import type { Route } from "./+types/archive";
import { ArchivedTicket } from "~/components/archived-ticket";
import { listCards } from "~/lib/cards.server";
import { requireSession } from "~/lib/session.server";

export function meta() {
  return [{ title: "Arsip - Daftar tugas" }, { name: "robots", content: "noindex" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireSession(request, env);
  return { cards: await listCards(env.DB, "archived") };
}

export default function Archive({ loaderData }: Route.ComponentProps) {
  const { cards } = loaderData;

  if (cards.length === 0) {
    return <p className="ticket-body max-w-[28rem] text-steel-muted">Arsip kosong. Kartu yang kamu arsipkan muncul di sini.</p>;
  }

  return (
    <ul role="list" className="board-grid">
      {cards.map((card) => (
        <ArchivedTicket key={card.id} card={card} />
      ))}
    </ul>
  );
}
