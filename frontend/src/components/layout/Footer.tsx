import Link from "next/link";

/** Ported from web/templates/footer.html. */
export function Footer(): React.JSX.Element {
  return (
    <footer className="mt-auto border-t border-border bg-card py-6">
      <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground">
        <p>
          d-party — dアニメストアでウォッチパーティー ·{" "}
          <a
            className="underline-offset-4 hover:underline"
            href="https://github.com/d-Party"
            target="_blank"
            rel="noreferrer noopener"
          >
            GitHub
          </a>{" "}
          ·{" "}
          <Link
            href="/privacy"
            className="underline-offset-4 hover:underline"
          >
            プライバシーポリシー
          </Link>
        </p>
        <p className="mt-1">© {new Date().getFullYear()} d-party</p>
      </div>
    </footer>
  );
}
