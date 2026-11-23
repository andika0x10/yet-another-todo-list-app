import { useState } from "react";
import { useFetcher } from "react-router";

import { LocalTime } from "./local-time";
import { Perforation } from "./ticket";
import { clientId } from "~/lib/client";
import type { Card } from "~/lib/types";
import type { action } from "~/routes/cards";

/** Archived card: can only be restored or deleted. */
export function ArchivedTicket({ card }: { card: Card }) {
  const fetcher = useFetcher<typeof action>({ key: `card-${card.id}` });
  const [confirming, setConfirming] = useState(false);

  const intent = fetcher.formData?.get("intent");
  const leaving = intent === "restore" || intent === "delete";
  const error = fetcher.data && !fetcher.data.ok ? fetcher.data.error : null;

  function send(intent: string) {
    fetcher.submit({ intent, id: card.id, clientId }, { method: "post", action: "/cards" });
  }

  return (
    <li className={`list-none ${leaving ? "pointer-events-none opacity-40" : ""}`}>
      <article className="ticket">
        <span className="hole" aria-hidden="true" />
        <h2 className="ticket-title">{card.title}</h2>
        <Perforation />
        {card.body ? <p className="ticket-body">{card.body}</p> : null}
        <p className="meta min-h-5">
          {card.archivedAt ? (
            <>
              Diarsipkan <LocalTime ms={card.archivedAt} />
            </>
          ) : null}
        </p>
        <p role="alert" className="error-text">
          {error}
        </p>
        {confirming ? (
          <div className="actions" role="group" aria-label="Konfirmasi hapus">
            <span className="mr-auto text-sm">Hapus kartu ini?</span>
            <button type="button" className="link link-danger" onClick={() => send("delete")}>
              Hapus
            </button>
            <button type="button" className="link" autoFocus onClick={() => setConfirming(false)}>
              Batal
            </button>
          </div>
        ) : (
          <div className="actions">
            <button type="button" className="link" onClick={() => send("restore")}>
              Kembalikan
            </button>
            <button type="button" className="link link-danger ml-auto" onClick={() => setConfirming(true)}>
              Hapus
            </button>
          </div>
        )}
      </article>
    </li>
  );
}
