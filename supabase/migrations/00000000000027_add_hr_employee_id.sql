-- Migration: add hr_employee_id to users for Excel HR sync mapping
-- departments.name already exists per schema; no change needed there.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS hr_employee_id VARCHAR(10) UNIQUE;

COMMENT ON COLUMN public.users.hr_employee_id IS
  'ID del empleado en el Excel de RH (ej: ''0006''). Usado para sincronización automática desde archivo Excel.';
