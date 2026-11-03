import Link from "next/link";

export const metadata = { title: "Page not found" };

// Next's built-in 404 brings its own colors, which go white-on-white when the
// device is in dark mode. This one sits inside the app shell like any page.
export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
      <p className="eyebrow">404</p>
      <h1 className="page-title">This page isn&apos;t here</h1>
      <p className="text-slate-600">
        The link may be old or mistyped. The course, review and games are all a click away.
      </p>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <Link href="/" className="btn-primary">
          Go to the course
        </Link>
        <Link href="/try" className="btn-secondary">
          Try a problem
        </Link>
      </div>
    </div>
  );
}
