-- V2-B1 Finance Centre: expenses, budgets, invoices, coach wages

create table if not exists public.finance_expenses (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  academy_id uuid references public.academies (id) on delete set null,
  expense_date date not null default current_date,
  amount_pence integer not null check (amount_pence >= 0),
  category text not null default 'other'
    check (category in (
      'facility_hire', 'equipment', 'coach_wages', 'referees', 'marketing',
      'insurance', 'travel', 'pitch_hire', 'hall_hire', 'floodlights',
      'equipment_rental', 'other'
    )),
  supplier text,
  receipt_path text,
  notes text,
  is_recurring boolean not null default false,
  is_paid boolean not null default true,
  expense_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_budgets (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  month_key text not null,
  income_goal_pence integer not null default 0 check (income_goal_pence >= 0),
  expense_target_pence integer not null default 0 check (expense_target_pence >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coach_id, month_key)
);

create table if not exists public.finance_invoices (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  player_id uuid references public.players (id) on delete set null,
  invoice_number text not null,
  amount_pence integer not null check (amount_pence >= 0),
  status text not null default 'outstanding'
    check (status in ('paid', 'outstanding', 'cancelled')),
  due_date date,
  description text,
  notes text,
  sent_at timestamptz,
  paid_at timestamptz,
  invoice_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_wage_records (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  payee_name text not null,
  amount_pence integer not null check (amount_pence >= 0),
  hourly_rate_pence integer,
  hours numeric(6, 2),
  payment_type text not null default 'wage'
    check (payment_type in ('session', 'match', 'camp', 'wage')),
  status text not null default 'outstanding'
    check (status in ('outstanding', 'paid')),
  session_id uuid references public.sessions (id) on delete set null,
  camp_id uuid references public.camps (id) on delete set null,
  due_date date,
  notes text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists finance_expenses_coach_date_idx
  on public.finance_expenses (coach_id, expense_date desc);

create index if not exists finance_budgets_coach_month_idx
  on public.finance_budgets (coach_id, month_key);

create index if not exists finance_invoices_coach_status_idx
  on public.finance_invoices (coach_id, status);

create index if not exists coach_wage_records_coach_status_idx
  on public.coach_wage_records (coach_id, status);

alter table public.finance_expenses enable row level security;
alter table public.finance_budgets enable row level security;
alter table public.finance_invoices enable row level security;
alter table public.coach_wage_records enable row level security;

create policy "Coaches manage own finance expenses"
  on public.finance_expenses for all
  using (auth.uid() = coach_id) with check (auth.uid() = coach_id);

create policy "Coaches manage own finance budgets"
  on public.finance_budgets for all
  using (auth.uid() = coach_id) with check (auth.uid() = coach_id);

create policy "Coaches manage own finance invoices"
  on public.finance_invoices for all
  using (auth.uid() = coach_id) with check (auth.uid() = coach_id);

create policy "Coaches manage own coach wage records"
  on public.coach_wage_records for all
  using (auth.uid() = coach_id) with check (auth.uid() = coach_id);
