-- In-app уведомления пациенту о новых заметках/назначениях/уходе
-- (см. SPEC.md, разделы 4, 6, 8). Уведомления создаются автоматически
-- триггерами при добавлении врачом новой записи — так это работает
-- независимо от того, из какого места приложения пришла вставка, и не
-- требует правок в уже работающих doctor-компонентах.

create or replace function public.notify_patient_new_diagnosis()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into notifications (patient_id, recipient, type, text)
  values (new.patient_id, 'patient', 'note', 'Добавлена запись в историю болезни: ' || new.diagnosis_type);
  return new;
end;
$$;

drop trigger if exists diagnoses_notify_patient on diagnoses;
create trigger diagnoses_notify_patient
  after insert on diagnoses
  for each row execute function public.notify_patient_new_diagnosis();

create or replace function public.notify_patient_new_prescription()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_drug_name text;
begin
  select name into v_drug_name from drugs where id = new.drug_id;
  insert into notifications (patient_id, recipient, type, text)
  values (new.patient_id, 'patient', 'prescription', 'Назначен препарат: ' || coalesce(v_drug_name, 'препарат'));
  return new;
end;
$$;

drop trigger if exists prescriptions_notify_patient on prescriptions;
create trigger prescriptions_notify_patient
  after insert on prescriptions
  for each row execute function public.notify_patient_new_prescription();

create or replace function public.notify_patient_new_skincare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into notifications (patient_id, recipient, type, text)
  values (
    new.patient_id,
    'patient',
    'skincare',
    'Добавлена запись ухода за кожей' ||
      case when new.products_and_procedures is not null then ': ' || new.products_and_procedures else '' end
  );
  return new;
end;
$$;

drop trigger if exists skincare_routines_notify_patient on skincare_routines;
create trigger skincare_routines_notify_patient
  after insert on skincare_routines
  for each row execute function public.notify_patient_new_skincare();

-- SECURITY DEFINER RPC для пациентской страницы (доступ по access_token,
-- без Supabase Auth — как и остальные get_patient_*_by_token функции).

create or replace function public.get_patient_notifications_by_token(p_token uuid)
returns table (
  id uuid,
  type text,
  text text,
  is_read boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select n.id, n.type, n.text, n.is_read, n.created_at
  from notifications n
  join patients p on p.id = n.patient_id
  where p.access_token = p_token
    and n.recipient = 'patient'
  order by n.created_at desc;
$$;

grant execute on function public.get_patient_notifications_by_token(uuid) to anon, authenticated;

create or replace function public.mark_patient_notifications_read_by_token(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update notifications n
  set is_read = true
  from patients p
  where p.id = n.patient_id
    and p.access_token = p_token
    and n.recipient = 'patient'
    and n.is_read = false;
end;
$$;

grant execute on function public.mark_patient_notifications_read_by_token(uuid) to anon, authenticated;
