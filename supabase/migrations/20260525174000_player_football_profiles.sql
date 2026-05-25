-- Football-specific player profile attributes.

alter table public.players
  add column if not exists preferred_foot text,
  add column if not exists primary_position text,
  add column if not exists secondary_positions text[];

update public.players
set preferred_foot = coalesce(preferred_foot, 'Unknown'),
    secondary_positions = coalesce(secondary_positions, '{}')
where preferred_foot is null
   or secondary_positions is null;

alter table public.players
  alter column preferred_foot set default 'Unknown',
  alter column preferred_foot set not null,
  alter column secondary_positions set default '{}',
  alter column secondary_positions set not null;

alter table public.players
  drop constraint if exists players_preferred_foot_check,
  drop constraint if exists players_primary_position_check,
  drop constraint if exists players_secondary_positions_check;

alter table public.players
  add constraint players_preferred_foot_check
    check (preferred_foot in ('Left', 'Right', 'Both', 'Unknown')),
  add constraint players_primary_position_check
    check (
      primary_position is null
      or primary_position in (
        'GK', 'RB', 'RWB', 'CB', 'LB', 'LWB',
        'CDM', 'CM', 'CAM', 'RM', 'LM', 'RW',
        'LW', 'CF', 'ST'
      )
    ),
  add constraint players_secondary_positions_check
    check (
      secondary_positions <@ array[
        'GK', 'RB', 'RWB', 'CB', 'LB', 'LWB',
        'CDM', 'CM', 'CAM', 'RM', 'LM', 'RW',
        'LW', 'CF', 'ST'
      ]::text[]
    );

create index if not exists players_primary_position_idx
  on public.players (primary_position);

create index if not exists players_secondary_positions_idx
  on public.players using gin (secondary_positions);
