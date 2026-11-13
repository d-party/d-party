import { Crown, LogOut, PartyPopper, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import type { RoomSettings as RoomSettingsValue } from "@/domain/roomSettings";
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
import { RoomSettings } from "./RoomSettings";

const DELETE_HOLD_MS = 3000;
const DELETE_HOLD_SECONDS = DELETE_HOLD_MS / 1000;
const DELETE_LABEL = `ルームを削除（${DELETE_HOLD_SECONDS}秒長押し）`;

function OwnerBadge(): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-amber-950">
          <Crown className="size-3" aria-hidden />
          <span className="sr-only">オーナー</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>オーナー</TooltipContent>
    </Tooltip>
  );
}

export function CreatePanel({
  onCreateRoom,
  draftSettings,
  onChangeDraftSettings,
}: {
  onCreateRoom: () => void;
  draftSettings: RoomSettingsValue;
  onChangeDraftSettings: (next: RoomSettingsValue) => void;
}): React.JSX.Element {
  return (
    // `m-auto` で、短いときは縦中央、伸びたら上からスクロールする。
    <div className="flex flex-1 flex-col overflow-y-auto p-6">
      <div className="m-auto flex w-full flex-col gap-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <PartyPopper className="size-8 text-red-600" aria-hidden />
          <div>
            <p className="text-sm font-semibold">パーティールームを作成</p>
            <p className="mt-1 text-xs text-muted-foreground">
              パーティーを主催して、みんなで同時に鑑賞しよう！
            </p>
          </div>
        </div>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="advanced" className="border-b-0">
            <AccordionTrigger className="justify-center text-muted-foreground hover:text-foreground hover:no-underline">
              <Plus
                className="size-4 transition-transform group-data-[state=open]:rotate-45"
                aria-hidden
              />
              詳細設定
            </AccordionTrigger>
            <AccordionContent>
              <RoomSettings
                value={draftSettings}
                onChange={onChangeDraftSettings}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Button onClick={onCreateRoom} className="w-full">
          ルームを作成
        </Button>
      </div>
    </div>
  );
}

export function UsersPanel({
  state,
}: {
  state: SidebarState;
}): React.JSX.Element {
  if (state.users.length === 0) {
    return <EmptyHint text="参加者はいません" />;
  }
  return (
    <div className="px-1">
      <p className="mb-2 text-xs text-muted-foreground">
        {state.users.length}人が参加中
      </p>
      <ul className="flex flex-col gap-1">
        {state.users.map((user) => {
          const isSelf = user.user_id === state.selfUserId;
          const isOwner = user.is_host === true;
          return (
            <li
              key={user.user_id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
            >
              <UserAvatar
                iconKey={user.user_icon}
                className="size-4 shrink-0 text-red-600"
              />
              <span className="truncate">{user.user_name}</span>
              {/* you と owner が両方付く場合は you を左、owner を右に並べる。 */}
              {(isSelf || isOwner) && (
                <span className="ml-auto flex shrink-0 items-center gap-1">
                  {isSelf && (
                    <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none text-white">
                      you
                    </span>
                  )}
                  {isOwner && <OwnerBadge />}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ControlPanel({
  onLeave,
  onDeleteRoom,
  isOwner,
  roomSettings,
  onChangeRoomSettings,
}: {
  onLeave: () => void;
  onDeleteRoom: () => void;
  isOwner: boolean;
  roomSettings: RoomSettingsValue;
  onChangeRoomSettings: (next: RoomSettingsValue) => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-8 px-1 pb-3 pt-6">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-semibold">ルームから退室</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            退室するとサイドバーが閉じます。
          </p>
        </div>
        <Button
          variant="destructive"
          size="lg"
          className="w-full gap-1.5"
          onClick={onLeave}
        >
          <LogOut className="size-4" aria-hidden /> 退室する
        </Button>
      </div>

      {isOwner && (
        <div className="flex flex-col gap-3 border-t border-border pt-6">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold">ルームを削除</p>
              <OwnerBadge />
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              オーナーのみが実行できます。全員が退室になります。誤操作防止のため{" "}
              {DELETE_HOLD_SECONDS} 秒間長押しで削除します。
            </p>
          </div>
          <HoldToDeleteButton onConfirm={onDeleteRoom} />
        </div>
      )}

      {/* 非オーナーには現在値を read-only で見せる。 */}
      <div className="flex flex-col gap-3 border-t border-border pt-6">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold">詳細設定</p>
          {isOwner ? (
            <OwnerBadge />
          ) : (
            <span className="text-[11px] text-muted-foreground">
              （オーナーのみ変更可能）
            </span>
          )}
        </div>
        <RoomSettings
          value={roomSettings}
          onChange={onChangeRoomSettings}
          disabled={!isOwner}
        />
      </div>
    </div>
  );
}

/** 長押しで {@link onConfirm} を呼ぶ。押している間、背景が左から満ちる。 */
function HoldToDeleteButton({
  onConfirm,
}: {
  onConfirm: () => void;
}): React.JSX.Element {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  const cancelHold = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startRef.current = null;
    setProgress(0);
  }, []);

  const startHold = useCallback(() => {
    if (rafRef.current !== null) return;
    firedRef.current = false;
    startRef.current = null;
    const loop = (timestamp: number): void => {
      if (startRef.current === null) startRef.current = timestamp;
      const ratio = Math.min(
        1,
        (timestamp - startRef.current) / DELETE_HOLD_MS,
      );
      setProgress(ratio);
      if (ratio >= 1) {
        rafRef.current = null;
        startRef.current = null;
        if (!firedRef.current) {
          firedRef.current = true;
          onConfirm();
        }
        setProgress(0);
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [onConfirm]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const holding = progress > 0;
  const remaining = Math.ceil((1 - progress) * DELETE_HOLD_SECONDS);

  return (
    <button
      type="button"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        startHold();
      }}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      aria-label={DELETE_LABEL}
      className="relative h-10 w-full cursor-pointer select-none overflow-hidden rounded-md border border-destructive/60 bg-destructive/10 px-3 text-sm font-semibold text-destructive transition-all duration-150 ease-out hover:bg-destructive/15 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:shadow-none"
    >
      <span
        className="absolute inset-y-0 left-0 bg-destructive/30"
        style={{ width: `${progress * 100}%` }}
        aria-hidden
      />
      <span className="relative z-10 flex items-center justify-center gap-1.5">
        <Trash2 className="size-4" aria-hidden />
        {holding ? `押し続けて削除… ${remaining}` : DELETE_LABEL}
      </span>
    </button>
  );
}

export function EmptyHint({ text }: { text: string }): React.JSX.Element {
  return (
    <p className="px-2 py-6 text-center text-xs text-muted-foreground">
      {text}
    </p>
  );
}
