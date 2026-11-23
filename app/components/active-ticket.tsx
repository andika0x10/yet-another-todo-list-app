import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useFetcher } from "react-router";

import { LocalTime } from "./local-time";
import { Perforation } from "./ticket";
import { clientId } from "~/lib/client";
import { BODY_MAX, TITLE_MAX } from "~/lib/limits";
import type { Card } from "~/lib/types";
import type { action } from "~/routes/cards";

/** Active card: can be dragged by its hanging hole, edited, archived, or deleted. */
export function ActiveTicket({ card, fresh }: { card: Card; fresh: boolean }) {
  const fetcher = useFetcher<typeof action>({ key: `card-${card.id}` });
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const submitted = useRef(false);

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: editing,
  });

  const intent = fetcher.formData?.get("intent");
  const leaving = intent === "archive" || intent === "delete";
  const saving = intent === "update";
  const error = fetcher.data && !fetcher.data.ok ? fetcher.data.error : null;

  useEffect(() => {
    if (submitted.current && fetcher.state === "idle" && fetcher.data?.ok) {
      submitted.current = false;
      setEditing(false);
    }
  }, [fetcher.state, fetcher.data]);

  function send(fields: Record<string, string>) {
    fetcher.submit({ ...fields, id: card.id, clientId }, { method: "post", action: "/cards" });
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    submitted.current = true;
    send({ intent: "update", title: String(form.get("title") ?? ""), body: String(form.get("body") ?? "") });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape") {
      setEditing(false);
    } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    }
  }

  const itemClass = [
    "list-none",
    isDragging ? "relative z-20 dragging" : "",
    leaving ? "pointer-events-none opacity-40" : "",
  ].join(" ");

  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={itemClass}>
      <article className={`ticket ${fresh ? "print-in" : ""}`}>
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="hole"
          disabled={editing}
          aria-label={`Geser kartu ${card.title}`}
          {...attributes}
          aria-roledescription="kartu yang bisa digeser"
          {...listeners}
        />

        {editing ? (
          <form onSubmit={handleSave} onKeyDown={handleKeyDown}>
            <label htmlFor={`title-${card.id}`} className="sr-only">
              Judul
            </label>
            <input
              id={`title-${card.id}`}
              name="title"
              defaultValue={card.title}
              required
              maxLength={TITLE_MAX}
              autoComplete="off"
              autoFocus
              className="field field-title"
            />
            <Perforation />
            <label htmlFor={`body-${card.id}`} className="sr-only">
              Isi
            </label>
            <textarea
              id={`body-${card.id}`}
              name="body"
              defaultValue={card.body}
              maxLength={BODY_MAX}
              className="field field-body"
            />
            <p role="alert" className="error-text min-h-5">
              {error}
            </p>
            <div className="actions">
              <button type="submit" className="button" disabled={saving}>
                Simpan
              </button>
              <button type="button" className="link" onClick={() => setEditing(false)}>
                Batal
              </button>
            </div>
          </form>
        ) : (
          <>
            <h2 className="ticket-title">{card.title}</h2>
            <Perforation />
            {card.body ? <p className="ticket-body">{card.body}</p> : null}
            <p className="meta min-h-5">
              <LocalTime ms={card.createdAt} />
            </p>
            <p role="alert" className="error-text">
              {error}
            </p>
            {confirming ? (
              <div className="actions" role="group" aria-label="Konfirmasi hapus">
                <span className="mr-auto text-sm">Hapus kartu ini?</span>
                <button type="button" className="link link-danger" onClick={() => send({ intent: "delete" })}>
                  Hapus
                </button>
                <button type="button" className="link" autoFocus onClick={() => setConfirming(false)}>
                  Batal
                </button>
              </div>
            ) : (
              <div className="actions">
                <button type="button" className="link" onClick={() => setEditing(true)}>
                  Edit
                </button>
                <button type="button" className="link" onClick={() => send({ intent: "archive" })}>
                  Arsipkan
                </button>
                <button type="button" className="link link-danger ml-auto" onClick={() => setConfirming(true)}>
                  Hapus
                </button>
              </div>
            )}
          </>
        )}
      </article>
    </li>
  );
}
