-- Начальная схема БД для приложения назначения лечения (см. SPEC.md, раздел 4).
-- Применяется через Supabase CLI (`supabase db push`) или SQL Editor в дашборде.

create extension if not exists pgcrypto;

-- ============================================================================
-- ТАБЛИЦЫ
-- ============================================================================

-- doctors.id совпадает с auth.users.id — это упрощает RLS-политики (auth.uid())
-- и подготавливает архитектуру к нескольким врачам без изменения модели данных.
create table doctors (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table patients (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctors (id) on delete cascade,
  full_name text not null,
  birth_date date,
  contact_info text,
  access_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now()
);

create index patients_doctor_id_idx on patients (doctor_id);
create index patients_access_token_idx on patients (access_token);

create table diagnoses (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id) on delete cascade,
  diagnosis_type text not null,
  diagnosed_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create index diagnoses_patient_id_idx on diagnoses (patient_id);

create table drugs (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctors (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index drugs_doctor_id_idx on drugs (doctor_id);

create table dosage_rules (
  id uuid primary key default gen_random_uuid(),
  drug_id uuid not null references drugs (id) on delete cascade,
  severity text not null check (severity in ('mild', 'moderate', 'severe')),
  mg_per_kg numeric not null check (mg_per_kg > 0),
  created_at timestamptz not null default now(),
  unique (drug_id, severity)
);

create table prescriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id) on delete cascade,
  diagnosis_id uuid references diagnoses (id) on delete set null,
  drug_id uuid not null references drugs (id),
  weight_kg numeric not null check (weight_kg > 0),
  severity text not null check (severity in ('mild', 'moderate', 'severe')),
  -- дозировка фиксируется на момент расчёта и не пересчитывается при
  -- изменении dosage_rules в будущем (см. SPEC.md, раздел 5)
  calculated_dosage numeric not null,
  manual_dosage numeric,
  start_date date not null default current_date,
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now()
);

create index prescriptions_patient_id_idx on prescriptions (patient_id);

create table prescription_weeks (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references prescriptions (id) on delete cascade,
  week_number int not null check (week_number > 0),
  dosage numeric not null,
  comment text,
  unique (prescription_id, week_number)
);

create table skincare_routines (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id) on delete cascade,
  prescription_id uuid references prescriptions (id) on delete set null,
  week_number int not null check (week_number > 0),
  products_and_procedures text,
  instructions text,
  created_at timestamptz not null default now()
);

create index skincare_routines_patient_id_idx on skincare_routines (patient_id);

create table patient_photos (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id) on delete cascade,
  -- путь объекта в приватном Storage-бакете `patient-photos`, а не публичный URL
  -- (доступ выдаётся через подписанные ссылки, см. SPEC.md, раздел 7)
  storage_path text not null,
  note text,
  uploaded_by text not null check (uploaded_by in ('doctor', 'patient')),
  uploaded_at timestamptz not null default now()
);

create index patient_photos_patient_id_idx on patient_photos (patient_id);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id) on delete cascade,
  recipient text not null check (recipient in ('doctor', 'patient')),
  type text not null check (type in ('note', 'prescription', 'skincare', 'photo')),
  text text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_patient_id_idx on notifications (patient_id);

-- ============================================================================
-- Автосоздание записи doctors при регистрации врача в Supabase Auth
-- ============================================================================

create function public.handle_new_doctor()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.doctors (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_doctor();

-- ============================================================================
-- ROW LEVEL SECURITY — доступ врача к собственным данным (auth.uid())
-- ============================================================================
-- Доступ пациента по access_token (без Supabase Auth) реализуется отдельно —
-- через SECURITY DEFINER RPC-функции, которые будут добавлены вместе с
-- пациентской страницей (шаг 6 MVP), чтобы не открывать анонимный SELECT
-- напрямую по таблицам.

alter table doctors enable row level security;
alter table patients enable row level security;
alter table diagnoses enable row level security;
alter table drugs enable row level security;
alter table dosage_rules enable row level security;
alter table prescriptions enable row level security;
alter table prescription_weeks enable row level security;
alter table skincare_routines enable row level security;
alter table patient_photos enable row level security;
alter table notifications enable row level security;

create policy "doctors read/update own row" on doctors
  for select using (id = auth.uid());
create policy "doctors update own row" on doctors
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "doctors manage own patients" on patients
  for all using (doctor_id = auth.uid()) with check (doctor_id = auth.uid());

create policy "doctors manage diagnoses of own patients" on diagnoses
  for all using (
    exists (select 1 from patients p where p.id = diagnoses.patient_id and p.doctor_id = auth.uid())
  ) with check (
    exists (select 1 from patients p where p.id = diagnoses.patient_id and p.doctor_id = auth.uid())
  );

create policy "doctors manage own drugs" on drugs
  for all using (doctor_id = auth.uid()) with check (doctor_id = auth.uid());

create policy "doctors manage own dosage rules" on dosage_rules
  for all using (
    exists (select 1 from drugs d where d.id = dosage_rules.drug_id and d.doctor_id = auth.uid())
  ) with check (
    exists (select 1 from drugs d where d.id = dosage_rules.drug_id and d.doctor_id = auth.uid())
  );

create policy "doctors manage prescriptions of own patients" on prescriptions
  for all using (
    exists (select 1 from patients p where p.id = prescriptions.patient_id and p.doctor_id = auth.uid())
  ) with check (
    exists (select 1 from patients p where p.id = prescriptions.patient_id and p.doctor_id = auth.uid())
  );

create policy "doctors manage prescription weeks of own patients" on prescription_weeks
  for all using (
    exists (
      select 1 from prescriptions pr
      join patients p on p.id = pr.patient_id
      where pr.id = prescription_weeks.prescription_id and p.doctor_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from prescriptions pr
      join patients p on p.id = pr.patient_id
      where pr.id = prescription_weeks.prescription_id and p.doctor_id = auth.uid()
    )
  );

create policy "doctors manage skincare routines of own patients" on skincare_routines
  for all using (
    exists (select 1 from patients p where p.id = skincare_routines.patient_id and p.doctor_id = auth.uid())
  ) with check (
    exists (select 1 from patients p where p.id = skincare_routines.patient_id and p.doctor_id = auth.uid())
  );

create policy "doctors manage photos of own patients" on patient_photos
  for all using (
    exists (select 1 from patients p where p.id = patient_photos.patient_id and p.doctor_id = auth.uid())
  ) with check (
    exists (select 1 from patients p where p.id = patient_photos.patient_id and p.doctor_id = auth.uid())
  );

create policy "doctors manage notifications of own patients" on notifications
  for all using (
    exists (select 1 from patients p where p.id = notifications.patient_id and p.doctor_id = auth.uid())
  ) with check (
    exists (select 1 from patients p where p.id = notifications.patient_id and p.doctor_id = auth.uid())
  );

-- ============================================================================
-- STORAGE — приватный бакет для фото пациентов
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('patient-photos', 'patient-photos', false)
on conflict (id) do nothing;

-- Ожидаемая структура пути объекта: {patient_id}/{filename}
create policy "doctors manage storage objects of own patients" on storage.objects
  for all using (
    bucket_id = 'patient-photos'
    and exists (
      select 1 from patients p
      where p.id::text = (storage.foldername(name))[1] and p.doctor_id = auth.uid()
    )
  ) with check (
    bucket_id = 'patient-photos'
    and exists (
      select 1 from patients p
      where p.id::text = (storage.foldername(name))[1] and p.doctor_id = auth.uid()
    )
  );
