import { useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import { useFetcher } from "react-router";

import { Perforation } from "./ticket";
import { clientId } from "~/lib/client";
import { BODY_MAX, TITLE_MAX } from "~/lib/limits";
import type { action } from "~/routes/cards";

/** Blank dashed ticket: where a new card is written. */
export function AddTicket() {
  const fetcher = useFetcher<typeof action>({ key: "card-new" });
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const submitted = useRef(false);
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    if (submitted.current && fetcher.state === "idle" && fetcher.data?.ok) {
      submitted.current = false;
      formRef.current?.reset();
      titleRef.current?.focus();
    }
  }, [fetcher.state, fetcher.data]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    submitted.current = true;
    fetcher.submit(
      { intent: "create", title: String(form.get("title") ?? ""), body: String(form.get("body") ?? ""), clientId },
      { method: "post", action: "/cards" },
    );
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    }
  }

  const error = fetcher.data && !fetcher.data.ok ? fetcher.data.error : null;

  return (
    <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="ticket-blank">
      <label htmlFor="new-title" className="sr-only">
        Judul
      </label>
      <input
        ref={titleRef}
        id="new-title"
        name="title"
        required
        maxLength={TITLE_MAX}
        placeholder="Judul"
        autoComplete="off"
        className="field field-title"
      />
      <Perforation />
      <label htmlFor="new-body" className="sr-only">
        Isi
      </label>
      <textarea id="new-body" name="body" maxLength={BODY_MAX} placeholder="Isi" className="field field-body" />
      <p role="alert" className="error-text min-h-5">
        {error}
      </p>
      <div className="actions">
        <button type="submit" className="button" disabled={busy}>
          Tambah kartu
        </button>
      </div>
    </form>
  );
}
