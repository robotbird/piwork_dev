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
import { type ReactNode, useCallback, useEffect, useRef } from "react";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { formatSkillDisplayName } from "@/lib/ai/skill-display";
import { cn } from "@/lib/utils";

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
    description: "Start a new chat",
    icon: <PenSquareIcon className="size-3.5" />,
    name: "new",
  },
  {
    action: "clear",
    description: "Clear current chat",
    icon: <Trash2Icon className="size-3.5" />,
    name: "clear",
  },
  {
    action: "rename",
    description: "Rename current chat",
    icon: <PenLineIcon className="size-3.5" />,
    name: "rename",
  },
  {
    action: "model",
    description: "Change the AI model",
    icon: <ListIcon className="size-3.5" />,
    name: "model",
  },
  {
    action: "theme",
    description: "Toggle dark/light mode",
    icon: <PaletteIcon className="size-3.5" />,
    name: "theme",
  },
  {
    action: "delete",
    description: "Delete current chat",
    icon: <XIcon className="size-3.5" />,
    name: "delete",
  },
  {
    action: "purge",
    description: "Delete all chats",
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
  const handleClick = useCallback(() => {
    onSelect(cmd);
  }, [cmd, onSelect]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  return (
    <CommandItem
      className={cn(
        "gap-3 rounded-lg px-3 py-2.5",
        index === selectedIndex && "bg-muted/70"
      )}
      data-selected={index === selectedIndex}
      onMouseDown={handleMouseDown}
      onSelect={handleClick}
      value={cmd.name}
    >
      <span className="flex size-6 shrink-0 items-center justify-center text-muted-foreground/60">
        {cmd.icon}
      </span>
      <span className="font-mono text-[13px] text-foreground">/{cmd.name}</span>
      <span className="min-w-0 truncate text-[12px] text-muted-foreground/60">
        {cmd.description}
      </span>
      {cmd.shortcut ? (
        <span className="ml-auto text-[11px] text-muted-foreground/30">
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
    <div
      className="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-xl border border-border/50 bg-card/95 shadow-[var(--shadow-float)] backdrop-blur-xl"
      ref={menuRef}
    >
      <Command className="rounded-xl bg-transparent" shouldFilter={false}>
        <CommandList className="max-h-72 p-1">
          {commandItems.length > 0 ? (
            <CommandGroup heading="Commands">
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
          {skillItems.length > 0 ? (
            <CommandGroup heading="Skills">
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
        </CommandList>
      </Command>
    </div>
  );
}
