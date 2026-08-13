-- Пациентская страница по токену (см. SPEC.md, раздел 6) — доступ без
-- Supabase Auth реализован через SECURITY DEFINER RPC-функции, а не прямой
-- анонимный SELECT по таблицам, как и запланировано в 0001_init.sql.
-- Каждая функция сама проверяет соответствие access_token и возвращает
-- только данные этого пациента.

create or replace function public.get_patient_by_token(p_token uuid)
returns table (
  id uuid,
  full_name text,
  birth_date date,
  weight_kg numeric,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.full_name, p.birth_date, p.weight_kg, p.created_at
  from patients p
  where p.access_token = p_token;
$$;

create or replace function public.get_patient_prescriptions_by_token(p_token uuid)
returns table (
  id uuid,
  drug_id uuid,
  drug_name text,
  severity text,
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
  select pr.id, pr.drug_id, d.name, pr.severity, pr.calculated_dosage, pr.manual_dosage, pr.start_date, pr.status
  from prescriptions pr
  join patients p on p.id = pr.patient_id
  join drugs d on d.id = pr.drug_id
  where p.access_token = p_token
  order by pr.start_date desc;
$$;

create or replace function public.get_patient_prescription_weeks_by_token(p_token uuid)
returns table (
  id uuid,
  prescription_id uuid,
  week_number int,
  dosage numeric,
  comment text
)
language sql
security definer
set search_path = public
stable
as $$
  select pw.id, pw.prescription_id, pw.week_number, pw.dosage, pw.comment
  from prescription_weeks pw
  join prescriptions pr on pr.id = pw.prescription_id
  join patients p on p.id = pr.patient_id
  where p.access_token = p_token
  order by pw.week_number;
$$;

create or replace function public.get_patient_skincare_by_token(p_token uuid)
returns table (
  id uuid,
  prescription_id uuid,
  week_number int,
  products_and_procedures text,
  instructions text
)
language sql
security definer
set search_path = public
stable
as $$
  select sr.id, sr.prescription_id, sr.week_number, sr.products_and_procedures, sr.instructions
  from skincare_routines sr
  join patients p on p.id = sr.patient_id
  where p.access_token = p_token
  order by sr.week_number;
$$;

create or replace function public.get_patient_photos_by_token(p_token uuid)
returns table (
  id uuid,
  storage_path text,
  note text,
  uploaded_by text,
  uploaded_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select ph.id, ph.storage_path, ph.note, ph.uploaded_by, ph.uploaded_at
  from patient_photos ph
  join patients p on p.id = ph.patient_id
  where p.access_token = p_token
  order by ph.uploaded_at desc;
$$;

grant execute on function public.get_patient_by_token(uuid) to anon, authenticated;
grant execute on function public.get_patient_prescriptions_by_token(uuid) to anon, authenticated;
grant execute on function public.get_patient_prescription_weeks_by_token(uuid) to anon, authenticated;
grant execute on function public.get_patient_skincare_by_token(uuid) to anon, authenticated;
grant execute on function public.get_patient_photos_by_token(uuid) to anon, authenticated;
