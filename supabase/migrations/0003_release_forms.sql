-- Формы выпуска препарата (см. SPEC.md, раздел 4, release_forms).
-- Например: Акнекутан — капсулы 8 мг (упаковка 30 шт) и капсулы 16 мг (упаковка 30 шт).

create table release_forms (
  id uuid primary key default gen_random_uuid(),
  drug_id uuid not null references drugs (id) on delete cascade,
  form_name text not null,
  unit_dose_mg numeric not null check (unit_dose_mg > 0),
  units_per_package integer not null check (units_per_package > 0),
  created_at timestamptz not null default now()
);

create index release_forms_drug_id_idx on release_forms (drug_id);

alter table release_forms enable row level security;

create policy "doctors manage release forms of own drugs" on release_forms
  for all using (
    exists (select 1 from drugs d where d.id = release_forms.drug_id and d.doctor_id = auth.uid())
  ) with check (
    exists (select 1 from drugs d where d.id = release_forms.drug_id and d.doctor_id = auth.uid())
  );
