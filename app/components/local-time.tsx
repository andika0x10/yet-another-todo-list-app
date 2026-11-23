import { useSyncExternalStore } from "react";

const formatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const subscribe = () => () => {};

/** Formatted in the browser (user's time zone). Empty on the server so the HTML matches on hydration. */
export function LocalTime({ ms }: { ms: number }) {
  const text = useSyncExternalStore(
    subscribe,
    () => formatter.format(ms),
    () => "",
  );
  return <time dateTime={new Date(ms).toISOString()}>{text}</time>;
}
