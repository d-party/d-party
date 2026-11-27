import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";

import type { Announcement } from "@/domain/announcement";
import { installChromeMock } from "@/presentation/popup/storybookChromeMock";

import { Announcements } from "./Announcements";
import {
  loadOf,
  SAMPLE_INFO,
  SAMPLE_LINK,
  SAMPLE_WARNING,
  SAMPLE_WARNING_LINKS,
} from "./announcementSamples";

/** `dismissed` は閉じた扱いにしておく ID（`chrome.storage.local`）。 */
function withChromeMock(dismissed: number[] = []): Decorator {
  return (Story) => {
    installChromeMock({}, { dismissedAnnouncementIds: dismissed });
    return (
      <div className="w-[360px] bg-background pb-3">
        <Story />
      </div>
    );
  };
}

const meta: Meta<typeof Announcements> = {
  title: "Components/Announcements",
  component: Announcements,
  parameters: { layout: "centered" },
  args: { itemClassName: "px-4" },
};

export default meta;

type Story = StoryObj<typeof Announcements>;

/** 通常のお知らせ。小さな点 ＋ 灰色の文字。× で閉じると、以後は出ない。 */
export const Info: Story = {
  args: { load: loadOf(SAMPLE_INFO) },
  decorators: [withChromeMock()],
};

/** 重要（メンテナンスなど）。色だけでなく、警告アイコンと「重要」の文字で区別する。 */
export const Warning: Story = {
  args: { load: loadOf(SAMPLE_WARNING) },
  decorators: [withChromeMock()],
};

/**
 * 配信中が複数あっても出すのは先頭（backend の並びで開始が一番新しいもの）の 1 件だけ。
 * × で閉じると次のものが繰り上がる。
 */
export const OnlyNewest: Story = {
  args: { load: loadOf(SAMPLE_WARNING, SAMPLE_INFO) },
  decorators: [withChromeMock()],
};

/** 本文の上限（60 文字）。省略せず折り返して全文を出す。 */
export const LongestMessage: Story = {
  args: {
    load: loadOf({ ...SAMPLE_INFO, message: "あいうえおかきくけこ".repeat(6) }),
  },
  decorators: [withChromeMock()],
};

/** `[テキスト](https://…)` はリンクにし、新しいタブで開く。URL は表示しない。 */
export const WithLink: Story = {
  args: { load: loadOf(SAMPLE_LINK) },
  decorators: [withChromeMock()],
};

/** 1 つの本文に複数のリンクを書ける。重要の行でもリンクの見た目は同じ。 */
export const WithLinks: Story = {
  args: { load: loadOf(SAMPLE_WARNING_LINKS) },
  decorators: [withChromeMock()],
};

/** リンクにしない本文の例。1 件ずつしか出ないので、行ごとに別の `Announcements` で並べる。 */
const DISALLOWED_LINK_LOADS = [
  { id: 11, level: "info", message: "[http](http://d-party.net/) は不可" },
  { id: 12, level: "info", message: "[js](javascript:alert(1)) は不可" },
  { id: 13, level: "info", message: "[data](data:text/html,x) は不可" },
  {
    id: 14,
    level: "info",
    message: "[相対](/docs) と [空白](https://d-party.net/a b) は不可",
  },
  { id: 15, level: "info", message: "[](https://d-party.net/) テキストが空" },
  {
    id: 16,
    level: "info",
    message: "**太字** や <https://d-party.net/> は Markdown として扱わない",
  },
] satisfies Announcement[];
// `load` が変わると取り直すので、描くたびに作らず固定しておく。
const DISALLOWED_LINK_ROWS = DISALLOWED_LINK_LOADS.map((announcement) => ({
  id: announcement.id,
  load: loadOf(announcement),
}));

/**
 * https:// 以外（http・javascript・data・相対・空白入り）と空のテキストはリンクにせず、
 * 書いたままの文字で出す（管理画面では保存できないが、DB に直接入った値に備える）。
 */
export const DisallowedLinks: Story = {
  render: (args) => (
    <>
      {DISALLOWED_LINK_ROWS.map(({ id, load }) => (
        <Announcements key={id} {...args} load={load} />
      ))}
    </>
  ),
  decorators: [withChromeMock()],
};

/** 表示される文字数の上限（60 文字。URL は数えない）までリンクを含めたとき。 */
export const LongestMessageWithLinks: Story = {
  args: {
    load: loadOf({
      ...SAMPLE_INFO,
      message:
        "あいうえおかきくけこ".repeat(4) +
        "[さしすせそたちつてと](https://d-party.net/docs/announcements/very/long/path?with=query#and-hash)" +
        "[なにぬねのはひふへほ](https://d-party.net/news)",
    }),
  },
  decorators: [withChromeMock()],
};

/** 閉じたことのあるもの（ID 1）は出さず、次のものを出す。 */
export const AlreadyDismissed: Story = {
  args: { load: loadOf(SAMPLE_WARNING, SAMPLE_INFO) },
  decorators: [withChromeMock([SAMPLE_WARNING.id])],
};

/** 取得に失敗したときは何も描かない。 */
export const LoadFailed: Story = {
  args: { load: () => Promise.reject(new Error("offline")) },
  decorators: [withChromeMock()],
};
