import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/** Ported from web/templates/404.html. */
export default function NotFound(): React.JSX.Element {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <Image src="/img/lobby/hand.svg" alt="" width={125} height={125} />
      <p className="text-2xl font-bold">404 Not Found</p>
      <p className="text-muted-foreground">このページは存在していません</p>
      <Button asChild variant="secondary" className="mt-2">
        <Link href="/">ホームに戻る</Link>
      </Button>
    </div>
  );
}
