import type { Meta, StoryObj } from "@storybook/react";
import { Copy } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

/**
 * トリガーは素の <button>。Button は各アプリが自前で持つ（意図的にスタイルが
 * 異なる）ため、このパッケージからは参照できない。ここで見せたいのは Tooltip の
 * 挙動なので、テーマトークンだけで最低限の見た目を与えている。
 */
function TriggerButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

const meta = {
  title: "UI/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <TooltipProvider delayDuration={150}>
        <div className="p-10">
          <Story />
        </div>
      </TooltipProvider>
    ),
  ],
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tooltip open>
      <TooltipTrigger asChild>
        <TriggerButton>
          <Copy />
          <span className="sr-only">リンクをコピー</span>
        </TriggerButton>
      </TooltipTrigger>
      <TooltipContent>リンクをコピー</TooltipContent>
    </Tooltip>
  ),
};

export const Bottom: Story = {
  render: () => (
    <Tooltip open>
      <TooltipTrigger asChild>
        <TriggerButton>ホバー or 表示</TriggerButton>
      </TooltipTrigger>
      <TooltipContent side="bottom">下側に表示</TooltipContent>
    </Tooltip>
  ),
};
