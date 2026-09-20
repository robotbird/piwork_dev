"use client";

import {
  BombIcon,
  HammerIcon,
  ListIcon,
  PaletteIcon,
  PenLineIcon,
  PenSquareIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useCallback, useEffect, useRef } from "react";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { formatSkillDisplayName } from "@/lib/ai/skill-display";
import { cn } from "@/lib/utils";
import { usePreferences } from "../preferences-provider";

export type SlashCommand = {
  name: string;
  displayName?: string;
  description: string;
  icon: ReactNode;
  action: string;
  group?: "commands" | "skills";
  skillName?: string;
  shortcut?: string;
};

export type SkillSummary = {
  description: string;
  displayName: string;
  name: string;
};

export const slashCommands: SlashCommand[] = [
  {
    action: "new",
    description: "new",
    icon: <PenSquareIcon className="size-3.5" />,
    name: "new",
  },
  {
    action: "clear",
    description: "clear",
    icon: <Trash2Icon className="size-3.5" />,
    name: "clear",
  },
  {
    action: "rename",
    description: "rename",
    icon: <PenLineIcon className="size-3.5" />,
    name: "rename",
  },
  {
    action: "model",
    description: "model",
    icon: <ListIcon className="size-3.5" />,
    name: "model",
  },
  {
    action: "theme",
    description: "theme",
    icon: <PaletteIcon className="size-3.5" />,
    name: "theme",
  },
  {
    action: "delete",
    description: "delete",
    icon: <XIcon className="size-3.5" />,
    name: "delete",
  },
  {
    action: "purge",
    description: "purge",
    icon: <BombIcon className="size-3.5" />,
    name: "purge",
  },
];

export function createSkillSlashCommands(
  skills: SkillSummary[]
): SlashCommand[] {
  const builtInNames = new Set(slashCommands.map((command) => command.name));

  return skills
    .filter((skill) => !builtInNames.has(skill.name))
    .map((skill) => ({
      action: "skill",
      description: skill.description,
      displayName:
        skill.displayName.trim() || formatSkillDisplayName(skill.name),
      group: "skills",
      icon: <HammerIcon className="size-3.5" />,
      name: skill.name,
      skillName: skill.name,
    }));
}

type SlashCommandMenuProps = {
  query: string;
  commands: SlashCommand[];
  onSelect: (command: SlashCommand) => void;
  selectedIndex: number;
};

function GroupHeading({ label, count }: { label: string; count: number }) {
  return (
    <span className="flex items-center gap-1.5">
      {label}
      <span className="font-normal text-muted-foreground/40">（{count}）</span>
    </span>
  );
}

function SlashCommandMenuItem({
  cmd,
  index,
  onSelect,
  selectedIndex,
}: {
  cmd: SlashCommand;
  index: number;
  onSelect: (command: SlashCommand) => void;
  selectedIndex: number;
}) {
  const t = useTranslations("chatCommands");
  const handleClick = useCallback(() => {
    onSelect(cmd);
  }, [cmd, onSelect]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  return (
    <CommandItem
      className={cn(
        "min-h-11 gap-3 rounded-md border border-transparent px-3 py-2",
        "data-[selected=true]:border-border/40 data-[selected=true]:bg-muted",
        index === selectedIndex && "border-border/40 bg-muted"
      )}
      data-selected={index === selectedIndex}
      onMouseDown={handleMouseDown}
      onSelect={handleClick}
      value={cmd.name}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground/70">
        {cmd.icon}
      </span>
      <span className="shrink-0 font-mono text-sm text-foreground">
        /{cmd.name}
      </span>
      <span className="min-w-0 flex-1 truncate text-left text-xs text-muted-foreground/60">
        {cmd.group === "skills"
          ? cmd.description
          : t(
              cmd.name as
                | "new"
                | "clear"
                | "rename"
                | "model"
                | "theme"
                | "delete"
                | "purge"
            )}
      </span>
      {cmd.shortcut ? (
        <span className="shrink-0 text-[11px] text-muted-foreground/30">
          {cmd.shortcut}
        </span>
      ) : null}
    </CommandItem>
  );
}

export function SlashCommandMenu({
  commands,
  query,
  onSelect,
  selectedIndex,
}: SlashCommandMenuProps) {
  const { translate } = usePreferences();
  const menuRef = useRef<HTMLDivElement>(null);
  const filtered = commands.filter((cmd) =>
    cmd.name.startsWith(query.toLowerCase())
  );
  const commandItems = filtered.filter((cmd) => cmd.group !== "skills");
  const skillItems = filtered.filter((cmd) => cmd.group === "skills");

  useEffect(() => {
    const selected =
      menuRef.current?.querySelectorAll("[cmdk-item]")[selectedIndex];
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (filtered.length === 0) {
    return null;
  }

  return (
    // 不透明卡片：纯色背景（不用半透明+模糊），配合 isolate 保证
    // 面板完整遮住底层内容（Z 序问题另由 shell.tsx 的 z-20 修复）
    <div
      className="skill-menu absolute bottom-full left-0 right-0 z-50 mb-2 isolate overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-[var(--shadow-float)]"
      ref={menuRef}
    >
      <Command className="rounded-xl bg-transparent p-1.5" shouldFilter={false}>
        <CommandList className="max-h-[min(420px,55vh)] scroll-py-2 p-1">
          {skillItems.length > 0 ? (
            <CommandGroup
              heading={
                <GroupHeading
                  count={skillItems.length}
                  label={translate("技能", "Skills")}
                />
              }
            >
              {skillItems.map((cmd) => (
                <SlashCommandMenuItem
                  cmd={cmd}
                  index={filtered.indexOf(cmd)}
                  key={cmd.name}
                  onSelect={onSelect}
                  selectedIndex={selectedIndex}
                />
              ))}
            </CommandGroup>
          ) : null}
          {skillItems.length > 0 && commandItems.length > 0 ? (
            <CommandSeparator className="mx-3 my-1.5" />
          ) : null}
          {commandItems.length > 0 ? (
            <CommandGroup
              heading={
                <GroupHeading
                  count={commandItems.length}
                  label={translate("指令", "Commands")}
                />
              }
            >
              {commandItems.map((cmd) => (
                <SlashCommandMenuItem
                  cmd={cmd}
                  index={filtered.indexOf(cmd)}
                  key={cmd.name}
                  onSelect={onSelect}
                  selectedIndex={selectedIndex}
                />
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </Command>
    </div>
  );
}
