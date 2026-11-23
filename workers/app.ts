import { createRequestHandler } from "react-router";

import { readSession } from "../app/lib/session.server";

export { Board } from "./board";
export { RateLimiter } from "./rate-limiter";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

/** WebSocket connections are only for users who have entered the PIN. */
async function handleSocket(request: Request, env: Env): Promise<Response> {
  if (request.headers.get("Upgrade") !== "websocket") {
    return new Response("Expected WebSocket", { status: 426 });
  }
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    return new Response("Forbidden", { status: 403 });
  }
  if (!(await readSession(request, env))) {
    return new Response("Unauthorized", { status: 401 });
  }
  return env.BOARD.get(env.BOARD.idFromName("main")).fetch(request);
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === "/ws") {
      return handleSocket(request, env);
    }
    return requestHandler(request);
  },
} satisfies ExportedHandler<Env>;
