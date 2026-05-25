"use client";

import { useMemo, useState } from "react";
import { Check, Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type PlayerOption = {
  id: string;
  player_name: string;
};

type PlayerMultiSelectProps = {
  players: PlayerOption[];
  selectedIds: string[];
  onChange: (nextSelectedIds: string[]) => void;
  disabled?: boolean;
};

export function PlayerMultiSelect({
  players,
  selectedIds,
  onChange,
  disabled = false,
}: PlayerMultiSelectProps) {
  const [query, setQuery] = useState("");

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedPlayers = useMemo(
    () => players.filter((player) => selectedSet.has(player.id)),
    [players, selectedSet],
  );
  const filteredPlayers = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return players;
    return players.filter((player) =>
      player.player_name.toLowerCase().includes(trimmed),
    );
  }, [players, query]);

  function togglePlayer(playerId: string) {
    if (disabled) return;
    if (selectedSet.has(playerId)) {
      onChange(selectedIds.filter((id) => id !== playerId));
      return;
    }
    onChange([...selectedIds, playerId]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Assigned players</p>
          <p className="text-muted mt-1 text-xs">
            Search and select every player included in this session.
          </p>
        </div>
        <span className="bg-accent/10 text-accent ring-accent/20 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ring-1">
          <Users className="size-3.5" aria-hidden />
          {selectedIds.length} selected
        </span>
      </div>

      <div className="border-border bg-background/70 rounded-2xl border p-3">
        <label className="sr-only" htmlFor="session-player-search">
          Search players
        </label>
        <div className="border-border bg-background flex h-11 items-center gap-2 rounded-xl border px-3">
          <Search className="text-muted size-4" aria-hidden />
          <input
            id="session-player-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search players..."
            className="h-full w-full bg-transparent text-sm outline-none"
            disabled={disabled}
          />
        </div>

        {selectedPlayers.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedPlayers.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => togglePlayer(player.id)}
                disabled={disabled}
                className="bg-accent/10 text-accent ring-accent/20 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors hover:bg-accent/15 disabled:opacity-60"
              >
                <Check className="size-3" aria-hidden />
                {player.player_name}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-muted mt-3 text-xs">
            No players selected yet. Pick one or more below.
          </p>
        )}

        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
          {filteredPlayers.length === 0 ? (
            <div className="text-muted rounded-xl bg-black/[0.02] px-3 py-4 text-sm dark:bg-white/[0.03]">
              No players match your search.
            </div>
          ) : (
            filteredPlayers.map((player) => {
              const checked = selectedSet.has(player.id);
              return (
                <label
                  key={player.id}
                  className={cn(
                    "border-border hover:bg-black/[0.02] flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-colors dark:hover:bg-white/[0.03]",
                    checked && "bg-accent/5 border-accent/25",
                    disabled && "cursor-not-allowed opacity-60",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePlayer(player.id)}
                    disabled={disabled}
                    className="accent-[var(--color-accent)]"
                  />
                  <span className="min-w-0 flex-1 truncate">{player.player_name}</span>
                </label>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
