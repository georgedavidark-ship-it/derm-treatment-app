-- Существенное изменение модели дозирования по итогам обратной связи от
-- врача (см. SPEC.md, разделы 4-5): убираем степень тяжести отовсюду —
-- врач фиксирует её в свободных заметках при необходимости. Вместо
-- диапазона мг/кг по степени тяжести — произвольное количество именованных
-- "схем дозирования" на препарат, каждая с одним значением мг/кг/сутки.
-- Вместо одного жёсткого максимума кумулятивной дозы на препарат —
-- произвольное количество именованных справочных вариантов кумулятивной
-- дозы, не привязанных к конкретной схеме и не блокирующих назначение.
--
-- ЛОМАЮЩЕЕ ИЗМЕНЕНИЕ, БЕЗ ПЕРЕНОСА ДАННЫХ ДЛЯ dosage_rules И
-- prescriptions.severity (решение обсуждено и подтверждено явно, а не
-- принято по умолчанию):
--   - dosage_rules (степень тяжести + диапазон мг/кг) удаляется целиком —
--     врач заново заводит схемы дозирования в новой модели.
--   - prescriptions.severity удаляется — степень тяжести на уже созданных
--     назначениях безвозвратно теряется. Сами дозировки (calculated_dosage,
--     manual_dosage), вес и разбивка по неделям не затрагиваются.
--   - prescriptions.dosage_scheme_id добавляется как новая колонка и для
--     всех уже существующих назначений будет NULL (сопоставить их со
--     схемами, которых на момент миграции ещё не существует, невозможно).
--   - drugs.track_cumulative_dose / max_cumulative_dose_mg_per_kg — здесь
--     перенос однозначный (максимум один на препарат), поэтому переносится
--     автоматически: для каждого препарата с включённым учётом создаётся
--     одна строка в cumulative_dose_options с прежним значением, после чего
--     старые колонки удаляются.

-- ============================================================================
-- dosage_schemes — именованные схемы дозирования (замена dosage_rules)
-- ============================================================================

create table dosage_schemes (
  id uuid primary key default gen_random_uuid(),
  drug_id uuid not null references drugs (id) on delete cascade,
  name text not null,
  mg_per_kg numeric not null check (mg_per_kg > 0),
  created_at timestamptz not null default now()
);

create index dosage_schemes_drug_id_idx on dosage_schemes (drug_id);

alter table dosage_schemes enable row level security;

create policy "doctors manage own dosage schemes" on dosage_schemes
  for all using (
    exists (select 1 from drugs d where d.id = dosage_schemes.drug_id and d.doctor_id = auth.uid())
  ) with check (
    exists (select 1 from drugs d where d.id = dosage_schemes.drug_id and d.doctor_id = auth.uid())
  );

-- ============================================================================
-- cumulative_dose_options — именованные справочные варианты кумулятивной
-- дозы препарата (замена drugs.track_cumulative_dose / max_cumulative_dose_mg_per_kg)
-- ============================================================================

create table cumulative_dose_options (
  id uuid primary key default gen_random_uuid(),
  drug_id uuid not null references drugs (id) on delete cascade,
  name text not null,
  max_cumulative_dose_mg_per_kg numeric not null check (max_cumulative_dose_mg_per_kg > 0),
  created_at timestamptz not null default now()
);

create index cumulative_dose_options_drug_id_idx on cumulative_dose_options (drug_id);

alter table cumulative_dose_options enable row level security;

create policy "doctors manage own cumulative dose options" on cumulative_dose_options
  for all using (
    exists (select 1 from drugs d where d.id = cumulative_dose_options.drug_id and d.doctor_id = auth.uid())
  ) with check (
    exists (select 1 from drugs d where d.id = cumulative_dose_options.drug_id and d.doctor_id = auth.uid())
  );

-- Автоперенос: единственный однозначный случай в этой миграции — старому
-- max_cumulative_dose_mg_per_kg препарата соответствует ровно один новый
-- именованный вариант.
insert into cumulative_dose_options (drug_id, name, max_cumulative_dose_mg_per_kg)
select id, 'Перенесено из старой настройки', max_cumulative_dose_mg_per_kg
from drugs
where track_cumulative_dose and max_cumulative_dose_mg_per_kg is not null;

alter table drugs
  drop constraint if exists drugs_cumulative_dose_requires_max;

alter table drugs
  drop column if exists track_cumulative_dose,
  drop column if exists max_cumulative_dose_mg_per_kg;

-- ============================================================================
-- prescriptions — привязка к схеме вместо степени тяжести
-- ============================================================================

alter table prescriptions
  add column dosage_scheme_id uuid references dosage_schemes (id) on delete set null;

alter table prescriptions
  drop column if exists severity;

-- ============================================================================
-- dosage_rules — удаляется целиком (чистый снос, без переноса данных —
-- подтверждено явно перед написанием миграции)
-- ============================================================================

drop table if exists dosage_rules;

-- ============================================================================
-- RPC для пациентской страницы — get_patient_prescriptions_by_token больше
-- не возвращает severity (create or replace не позволяет менять набор
-- возвращаемых столбцов, поэтому функцию нужно сначала удалить)
-- ============================================================================

drop function if exists public.get_patient_prescriptions_by_token(uuid);

create function public.get_patient_prescriptions_by_token(p_token uuid)
returns table (
  id uuid,
  drug_id uuid,
  drug_name text,
  calculated_dosage numeric,
  manual_dosage numeric,
  start_date date,
  status text
)
language sql
security definer
set search_path = public
stable
as $$
  select pr.id, pr.drug_id, d.name, pr.calculated_dosage, pr.manual_dosage, pr.start_date, pr.status
  from prescriptions pr
  join patients p on p.id = pr.patient_id
  join drugs d on d.id = pr.drug_id
  where p.access_token = p_token
  order by pr.start_date desc;
$$;

grant execute on function public.get_patient_prescriptions_by_token(uuid) to anon, authenticated;
