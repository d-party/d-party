import type { Metadata } from "next";
import Link from "next/link";
import { FaRegHand } from "react-icons/fa6";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "404 Not Found",
  description: "お探しのページは見つかりませんでした。",
  robots: { index: false, follow: true },
};

/** Ported from web/templates/404.html. */
export default function NotFound(): React.JSX.Element {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <FaRegHand className="text-muted-foreground" size={96} aria-hidden />
      <p className="text-2xl font-bold">404 Not Found</p>
      <p className="text-muted-foreground">このページは存在していません</p>
      <Button asChild variant="secondary" className="mt-2">
        <Link href="/">ホームに戻る</Link>
      </Button>
    </div>
  );
}
