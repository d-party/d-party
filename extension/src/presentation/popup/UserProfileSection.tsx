import { Check, Pencil, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { useTransientFlag } from "@/components/useTransientFlag";
import { type Settings, USER_NAME_MAX_LENGTH } from "@/domain/settings";
import { Input, Label } from "@d-party/ui";

import { IconPicker } from "./IconPicker";
import type { UpdateSetting } from "./useSettings";

const SAVED_FEEDBACK_MS = 1500;

export function UserProfileSection({
  settings,
  update,
}: {
  settings: Settings;
  update: UpdateSetting;
}): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const [saved, flagSaved] = useTransientFlag(SAVED_FEEDBACK_MS);

  const saveName = async (name: string): Promise<void> => {
    await update("userName", name);
    setEditing(false);
    flagSaved();
  };

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <User className="size-4 text-red-600" aria-hidden />
        <h2 className="text-sm font-semibold">ユーザー設定</h2>
      </div>
      {editing ? (
        <ProfileForm
          initialName={settings.userName}
          userIcon={settings.userIcon}
          onSubmitName={(name) => void saveName(name)}
          onChangeIcon={(key) => void update("userIcon", key)}
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">表示名・アイコン</span>
          <div className="flex items-center gap-2">
            <UserAvatar
              iconKey={settings.userIcon}
              className="size-5 shrink-0 text-red-600"
            />
            <p className="flex-1 truncate text-sm font-medium">
              {settings.userName || (
                <span className="text-muted-foreground">未設定</span>
              )}
            </p>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setEditing(true)}
              aria-label={saved ? "保存しました" : "表示名とアイコンを編集"}
            >
              {saved ? (
                <Check className="size-5 text-red-600" aria-hidden />
              ) : (
                <Pencil className="size-5" aria-hidden />
              )}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

/** 名前は ✓ で確定、アイコンは選んだ時点で保存する。開くたびに現在の名前から始める。 */
function ProfileForm({
  initialName,
  userIcon,
  onSubmitName,
  onChangeIcon,
}: {
  initialName: string;
  userIcon: string;
  onSubmitName: (name: string) => void;
  onChangeIcon: (key: string) => void;
}): React.JSX.Element {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmitName(name);
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="user-name" className="text-xs text-muted-foreground">
          表示名（{USER_NAME_MAX_LENGTH}文字以下）
        </Label>
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            id="user-name"
            className="flex-1"
            maxLength={USER_NAME_MAX_LENGTH}
            placeholder="あなたの名前"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            type="submit"
            size="icon"
            variant="ghost"
            className="text-red-600 hover:text-red-600"
            aria-label="表示名とアイコンを確定"
          >
            <Check className="size-5" aria-hidden />
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">アイコン</span>
        <IconPicker value={userIcon} onChange={onChangeIcon} />
      </div>
    </form>
  );
}
