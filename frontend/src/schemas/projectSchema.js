import { z } from 'zod';

export const projectSchema = z.object({
  name: z
    .string()
    .min(1, 'El nombre del proyecto es obligatorio')
    .max(255, 'El nombre no puede exceder 255 caracteres'),
  
  description: z
    .string()
    .optional()
    .default(''),
  
  status: z
    .enum(['PLANNING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED'])
    .default('PLANNING'),
  
  client: z
    .number()
    .positive('Debe seleccionar un cliente válido')
    .optional()
    .nullable(),
  
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato YYYY-MM-DD')
    .optional()
    .nullable(),
  
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato YYYY-MM-DD')
    .optional()
    .nullable(),
}).refine(
  (data) => {
    if (data.start_date && data.end_date) {
      return new Date(data.start_date) <= new Date(data.end_date);
    }
    return true;
  },
  {
    message: 'La fecha de inicio debe ser anterior a la fecha de fin',
    path: ['end_date'],
  }
);

/**
 * Project update schema - makes most fields optional
 */
export const projectUpdateSchema = projectSchema.partial();
