import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.ts"),
  route("cards", "routes/cards.ts"),
  layout("routes/board.tsx", [index("routes/active.tsx"), route("archive", "routes/archive.tsx")]),
] satisfies RouteConfig;
