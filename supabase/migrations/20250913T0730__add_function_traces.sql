create table if not exists public.function_traces (
  id bigserial primary key,
  created_at timestamptz default now() not null,
  function_name text not null,
  block text,
  week int,
  day int,
  user_id int,
  program_id int,
  status text,
  message text,
  count int,
  sample_names text[],
  raw jsonb
);

-- Basic RLS disabled for simplicity of debugging
alter table public.function_traces enable row level security;
create policy "allow all inserts from service role" on public.function_traces
  for insert to public using (true) with check (true);
