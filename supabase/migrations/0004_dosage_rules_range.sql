-- Диапазон суточной дозы (мг/кг/сутки) вместо фиксированного значения
-- (см. SPEC.md, раздел 4, dosage_rules, и раздел 5).
-- Врач при назначении конкретному пациенту выбирает точное значение внутри
-- диапазона [mg_per_kg_min, mg_per_kg_max].

alter table dosage_rules
  add column mg_per_kg_min numeric,
  add column mg_per_kg_max numeric;

-- Перенос уже сохранённых значений: старое фиксированное mg_per_kg
-- становится и минимумом, и максимумом диапазона.
update dosage_rules
set mg_per_kg_min = mg_per_kg,
    mg_per_kg_max = mg_per_kg;

alter table dosage_rules
  alter column mg_per_kg_min set not null,
  alter column mg_per_kg_max set not null;

alter table dosage_rules
  add constraint dosage_rules_range_check check (
    mg_per_kg_min > 0 and mg_per_kg_max >= mg_per_kg_min
  );

alter table dosage_rules
  drop column mg_per_kg;
