-- Опциональный учёт кумулятивной (курсовой) дозы препарата (см. SPEC.md, раздел 4, drugs).
-- Если track_cumulative_dose = true, врач задаёт максимальную суммарную дозу
-- на весь курс лечения в мг/кг; калькулятор дозировки в карточке пациента
-- сравнивает с суммой уже назначенных доз этого препарата пациенту.

alter table drugs
  add column track_cumulative_dose boolean not null default false,
  add column max_cumulative_dose_mg_per_kg numeric;

alter table drugs
  add constraint drugs_cumulative_dose_requires_max check (
    (not track_cumulative_dose)
    or (max_cumulative_dose_mg_per_kg is not null and max_cumulative_dose_mg_per_kg > 0)
  );
