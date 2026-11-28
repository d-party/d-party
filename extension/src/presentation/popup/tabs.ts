import {
  BarChart3,
  Info,
  type LucideIcon,
  Settings,
  Smile,
} from "lucide-react";

/** ポップアップと設定タブ（options.html）で共通の項目。 */
export const TABS = [
  { value: "settings", label: "設定", icon: Settings },
  { value: "reaction", label: "リアクション", icon: Smile },
  { value: "stats", label: "統計", icon: BarChart3 },
  { value: "info", label: "情報", icon: Info },
] as const satisfies readonly { value: string; label: string; icon: LucideIcon }[];

export type TabValue = (typeof TABS)[number]["value"];

/**
 * パネルを置く場所。`popup` は幅 360px のポップアップで、セクションを畳んで 1 つずつ開く。
 * `page` は別タブの設定ページで、畳まずにすべて開いておく。
 *
 * これで変えるのは開閉のふるまいだけ。幅に応じた並べ方は、設定ページのコンテナ
 * （`@container`）に対するコンテナクエリ（`@lg:` など）で書く。ポップアップには
 * コンテナが無いので当たらない。
 */
export type PanelLayout = "popup" | "page";
