/**
 * extension と frontend が共有する shadcn/ui プリミティブ。
 *
 * ここに置くのは**テーマトークンだけに依存する**コンポーネント。配色は各アプリの
 * CSS が定義する custom property（--background / --primary など）から来るので、
 * 同じコンポーネントが popup の明るいテーマでもサイトの暗いテーマでも成立する。
 *
 * `button` はここには無い。両アプリで意図的にスタイルが異なる（拡張側は hover の
 * 浮き上がりと押し込みの演出を持つ）ため、それぞれのパッケージが自前で持つ。
 */
export { cn } from "./lib/utils";
export {
  PortalContainerContext,
  usePortalContainer,
} from "./lib/portalContainer";

export * from "./accordion";
export * from "./input";
export * from "./label";
export * from "./skeleton";
export * from "./switch";
export * from "./tabs";
export * from "./toast";
export * from "./tooltip";
