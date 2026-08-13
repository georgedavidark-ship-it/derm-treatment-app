-- Уход за кожей, не привязанный к назначению препарата (prescription_id
-- пуст), должен иметь собственную дату начала курса — иначе на странице
-- пациента невозможно определить текущую неделю ухода (см. SPEC.md,
-- разделы 4 и 6).

alter table skincare_routines
  add column start_date date;

-- Бэкофилл уже существующих непривязанных записей: используем дату
-- создания записи как лучшую доступную оценку даты начала курса.
update skincare_routines
set start_date = created_at::date
where prescription_id is null
  and start_date is null;

alter table skincare_routines
  add constraint skincare_routines_start_date_required
  check (prescription_id is not null or start_date is not null);

-- Пересоздаём RPC для пациентской страницы с учётом нового поля —
-- у get_patient_skincare_by_token меняется набор возвращаемых столбцов,
-- поэтому функцию нужно сначала удалить (create or replace этого не позволяет).
drop function if exists public.get_patient_skincare_by_token(uuid);

create function public.get_patient_skincare_by_token(p_token uuid)
returns table (
  id uuid,
  prescription_id uuid,
  week_number int,
  products_and_procedures text,
  instructions text,
  start_date date
)
language sql
security definer
set search_path = public
stable
as $$
  select sr.id, sr.prescription_id, sr.week_number, sr.products_and_procedures, sr.instructions, sr.start_date
  from skincare_routines sr
  join patients p on p.id = sr.patient_id
  where p.access_token = p_token
  order by sr.week_number;
$$;

grant execute on function public.get_patient_skincare_by_token(uuid) to anon, authenticated;
