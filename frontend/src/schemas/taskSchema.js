import { z } from 'zod';

/**
 * Task validation schema aligned with backend Task model
 * Validates task creation and update forms
 */
export const taskSchema = z.object({
  title: z
    .string()
    .min(1, 'El título es obligatorio')
    .max(255, 'El título no puede exceder 255 caracteres'),
  
  description: z
    .string()
    .optional()
    .default(''),
  
  project: z
    .number({
      required_error: 'El proyecto es obligatorio',
      invalid_type_error: 'El proyecto debe ser un número válido',
    })
    .positive('Debe seleccionar un proyecto válido'),
  
  assigned_to: z
    .number()
    .positive('Debe seleccionar un usuario válido')
    .optional()
    .nullable(),
  
  status: z
    .enum([
      'DRAFT',
      'OPEN', 
      'IN_REVIEW',
      'CLOSED',
      'REOPENED',
      'PENDING',
      'IN_PROGRESS',
      'FOR_REVIEW',
      'COMPLETED'
    ])
    .default('DRAFT'),
  
  priority: z
    .enum(['LOW', 'MEDIUM', 'HIGH'])
    .default('MEDIUM'),
  
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato YYYY-MM-DD')
    .refine((date) => {
      const selectedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return selectedDate >= today;
    }, 'La fecha de vencimiento no puede ser en el pasado')
    .optional()
    .nullable(),
});

/**
 * Task update schema - makes most fields optional
 */
export const taskUpdateSchema = taskSchema.partial();
