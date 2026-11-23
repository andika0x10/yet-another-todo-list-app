import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Sofia+Sans+Extra+Condensed:wght@800&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#ffffff" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Terjadi masalah";
  let details = "Ada kesalahan yang tidak terduga. Muat ulang halaman, atau kembali ke daftar tugas.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "Halaman tidak ditemukan" : "Terjadi masalah";
    details =
      error.status === 404
        ? "Alamat ini tidak ada. Kembali ke daftar tugas untuk melanjutkan."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto max-w-[60rem] px-6 pt-20 pb-24">
      <h1 className="font-display text-[3rem] font-extrabold leading-[0.9]">{message}</h1>
      <p className="ticket-body mt-6 max-w-[32rem]">{details}</p>
      <p className="mt-6">
        <a href="/" className="link">
          Kembali ke daftar tugas
        </a>
      </p>
      {stack && (
        <pre className="mt-8 w-full overflow-x-auto bg-paper p-4 text-sm">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
