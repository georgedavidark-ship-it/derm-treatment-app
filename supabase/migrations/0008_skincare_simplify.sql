-- Упрощение ухода за кожей (см. SPEC.md, разделы 4-6): убираем разбивку по
-- неделям и привязку к назначению препарата. Теперь skincare_routines — это
-- просто список записей ухода на пациента («средство/процедура» +
-- «инструкция»), без временной привязки; врач добавляет/редактирует/удаляет
-- их в любой момент, и страница пациента показывает весь список целиком.

alter table skincare_routines
  drop constraint if exists skincare_routines_start_date_required;

alter table skincare_routines
  drop column if exists week_number,
  drop column if exists prescription_id,
  drop column if exists start_date;

-- Пересоздаём RPC для пациентской страницы под упрощённую модель — набор
-- возвращаемых столбцов меняется, поэтому функцию нужно сначала удалить
-- (create or replace этого не позволяет).
drop function if exists public.get_patient_skincare_by_token(uuid);

create function public.get_patient_skincare_by_token(p_token uuid)
returns table (
  id uuid,
  products_and_procedures text,
  instructions text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select sr.id, sr.products_and_procedures, sr.instructions, sr.created_at
  from skincare_routines sr
  join patients p on p.id = sr.patient_id
  where p.access_token = p_token
  order by sr.created_at;
$$;

grant execute on function public.get_patient_skincare_by_token(uuid) to anon, authenticated;
