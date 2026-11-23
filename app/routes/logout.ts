import { redirect } from "react-router";

import type { Route } from "./+types/logout";
import { assertSameOrigin, clearSessionCookie } from "~/lib/session.server";

export function loader() {
  return redirect("/");
}

export function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  return redirect("/login", { headers: { "Set-Cookie": clearSessionCookie(request) } });
}
