import { env } from "cloudflare:workers";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";

import type { Route } from "./+types/active";
import type { action } from "./cards";
import { ActiveTicket } from "~/components/active-ticket";
import { AddTicket } from "~/components/add-ticket";
import { listCards } from "~/lib/cards.server";
import { clientId } from "~/lib/client";
import { requireSession } from "~/lib/session.server";

export function meta() {
  return [{ title: "Daftar tugas" }, { name: "robots", content: "noindex" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireSession(request, env);
  return { cards: await listCards(env.DB, "active") };
}

export default function Active({ loaderData }: Route.ComponentProps) {
  const { cards } = loaderData;
  const reorder = useFetcher<typeof action>({ key: "card-order" });

  // Local order so a card moves as soon as it is dropped, before the server answers.
  const [order, setOrder] = useState(() => cards.map((card) => card.id));
  const [known, setKnown] = useState(() => new Set(cards.map((card) => card.id)));
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const [seenCards, setSeenCards] = useState(cards);
  if (cards !== seenCards) {
    setSeenCards(cards);
    setOrder(cards.map((card) => card.id));
    const added = cards.filter((card) => !known.has(card.id)).map((card) => card.id);
    if (added.length > 0) {
      setKnown(new Set([...known, ...added]));
      setFresh(new Set(added));
    }
  }

  // The "print" animation only runs for newly appearing cards and stops when done.
  useEffect(() => {
    if (fresh.size === 0) return;
    const timer = setTimeout(() => setFresh(new Set()), 700);
    return () => clearTimeout(timer);
  }, [fresh]);

  const byId = new Map(cards.map((card) => [card.id, card]));
  const ordered = order.flatMap((id) => byId.get(id) ?? []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)));
    setOrder(next);
    reorder.submit(
      { intent: "reorder", ids: JSON.stringify(next), clientId },
      { method: "post", action: "/cards" },
    );
  }

  const titleOf = (id: string | number) => byId.get(String(id))?.title ?? "";
  const positionOf = (id: string | number) => order.indexOf(String(id)) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Kartu "${titleOf(active.id)}" diangkat.`,
    onDragOver: ({ active, over }) =>
      over ? `Kartu "${titleOf(active.id)}" di posisi ${positionOf(over.id)} dari ${order.length}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `Kartu "${titleOf(active.id)}" ditaruh di posisi ${positionOf(over.id)} dari ${order.length}.`
        : `Kartu "${titleOf(active.id)}" dikembalikan.`,
    onDragCancel: ({ active }) => `Pemindahan kartu "${titleOf(active.id)}" dibatalkan.`,
  };

  const reorderError = reorder.data && !reorder.data.ok ? reorder.data.error : null;

  return (
    <>
      <AddTicket />
      <DndContext
        id="card-board"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              "Tekan spasi untuk mengangkat kartu. Gunakan tombol panah untuk memindahkan, spasi lagi untuk menaruh, Esc untuk membatalkan.",
          },
        }}
      >
        <ul role="list" className="board-grid mt-16">
          <SortableContext items={order} strategy={rectSortingStrategy}>
            {ordered.map((card, index) => (
              <ActiveTicket key={card.id} card={card} index={index} fresh={fresh.has(card.id)} />
            ))}
          </SortableContext>
          {ordered.length === 0 ? (
            <li className="rail-cell sm:col-span-2">
              <p className="ticket-body max-w-[28rem] pt-6 text-steel-muted">
                Rel masih kosong. Tulis judul dan isi di atas, lalu tekan Tambah kartu.
              </p>
            </li>
          ) : null}
        </ul>
      </DndContext>
      <p role="alert" className="error-text mt-8 min-h-5 text-stamp-wall">
        {reorderError}
      </p>
    </>
  );
}
