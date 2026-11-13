import { Check, Copy, Timer } from "lucide-react";
import { FaEnvelope, FaFacebookF, FaXTwitter } from "react-icons/fa6";
import { SiLine } from "react-icons/si";

import { Button } from "@/components/ui/button";
import { useTransientFlag } from "@/components/useTransientFlag";
import { FACEBOOK_APP_ID } from "@/infrastructure/env";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@d-party/ui";

import type { SidebarState } from "../sidebarStore";

const COPIED_FEEDBACK_MS = 1200;

function timerUrl(shareUrl: string): string {
  if (!shareUrl) return "";
  return shareUrl.includes("?") ? `${shareUrl}&timer=true` : `${shareUrl}?timer=true`;
}

/** `copied` stays false when the clipboard write is refused (e.g. the page lost focus). */
function useCopy(text: string): { copied: boolean; copy: () => void } {
  const [copied, flagCopied] = useTransientFlag(COPIED_FEEDBACK_MS);
  const copy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(flagCopied, () => undefined);
  };
  return { copied, copy };
}

/** The URL with a copy icon; the whole field is the button. Extra props reach the `<button>` (for `TooltipTrigger asChild`). */
function CopyField({
  url,
  placeholder,
  copied,
  ...props
}: React.ComponentProps<"button"> & {
  url: string;
  placeholder: string;
  copied: boolean;
}): React.JSX.Element {
  return (
    <button
      type="button"
      disabled={!url}
      className="flex w-full items-center gap-1.5 rounded-lg border bg-muted/40 p-1.5 text-left transition-colors hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-60"
      {...props}
    >
      <span className="flex-1 truncate px-1 text-xs" title={url}>
        {url || placeholder}
      </span>
      <span
        aria-hidden
        className="flex size-7 items-center justify-center rounded-md bg-secondary text-secondary-foreground"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </span>
    </button>
  );
}

export function SharePanel({ state }: { state: SidebarState }): React.JSX.Element {
  const url = state.shareUrl;
  const { copied, copy } = useCopy(url);

  const text = `dアニメストアで『${state.shareTitle}』を一緒に見ませんか？ 拡張機能『d-party』を使ってパーティーに参加してください`;
  const open = (shareUrl: string) => window.open(shareUrl, "", "width=700,height=400");

  return (
    <div className="flex h-full flex-col justify-center gap-5 px-1">
      <p className="text-xs text-muted-foreground">
        パーティーリンクを共有して友達をルームに招待
      </p>
      <Tooltip>
        <TooltipTrigger asChild>
          <CopyField
            url={url}
            placeholder="ルーム作成後にリンクが表示されます"
            copied={copied}
            onClick={copy}
            aria-label="リンクをコピー"
          />
        </TooltipTrigger>
        <TooltipContent side="top">
          {copied ? "コピーしました" : "リンクをコピー"}
        </TooltipContent>
      </Tooltip>

      <TimerUrlAccordion url={timerUrl(url)} />

      <div className="flex items-center justify-center gap-3">
        <ShareIcon
          label="Xでシェア"
          disabled={!url}
          onClick={() =>
            open(
              "https://twitter.com/intent/tweet?text=" +
              encodeURIComponent(text) +
              "&url=" +
              encodeURIComponent(url) +
              "&hashtags=" +
              encodeURIComponent("dアニメストア,dパーティー"),
            )
          }
        >
          <FaXTwitter />
        </ShareIcon>
        <ShareIcon
          label="LINEでシェア"
          disabled={!url}
          onClick={() =>
            open(
              "https://social-plugins.line.me/lineit/share?url=" +
              encodeURIComponent(url),
            )
          }
        >
          <SiLine />
        </ShareIcon>
        <ShareIcon
          label="Facebookでシェア"
          disabled={!url}
          onClick={() =>
            open(
              "https://www.facebook.com/dialog/share?app_id=" +
              FACEBOOK_APP_ID +
              "&href=" +
              encodeURIComponent(url),
            )
          }
        >
          <FaFacebookF />
        </ShareIcon>
        <ShareIcon
          label="メールでシェア"
          disabled={!url}
          onClick={() =>
            open(
              "mailto:?&subject=" +
              encodeURIComponent("dアニメストアで一緒にアニメを観ませんか？") +
              "&body=" +
              encodeURIComponent(text + "\n\n") +
              encodeURIComponent(url + "\n"),
            )
          }
        >
          <FaEnvelope />
        </ShareIcon>
      </div>
    </div>
  );
}

/** タイマー画面の URL（ロビー URL + `?timer=true`）。拡張機能が無くても開ける。 */
function TimerUrlAccordion({ url }: { url: string }): React.JSX.Element {
  const { copied, copy } = useCopy(url);

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="timer" className="border-b-0">
        <AccordionTrigger className="text-muted-foreground hover:text-foreground hover:no-underline">
          <Timer className="size-4" aria-hidden />
          タイマーのみのURL
        </AccordionTrigger>
        <AccordionContent>
          <p className="mb-1.5 text-[11px] leading-snug text-muted-foreground">
            拡張機能なし・dアニメストア不要で、再生中の動画のタイトルと時間だけを表示します。
          </p>
          <CopyField
            url={url}
            placeholder="ルーム作成後にURLが表示されます"
            copied={copied}
            onClick={copy}
            aria-label="タイマーURLをコピー"
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function ShareIcon({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          className="size-12 rounded-full [&_svg]:size-5"
          disabled={disabled}
          onClick={onClick}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
