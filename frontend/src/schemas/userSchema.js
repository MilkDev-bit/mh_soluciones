import { z } from 'zod';

/**
 * User validation schema aligned with backend CustomUser model
 * Validates user creation and update forms
 */
export const userSchema = z.object({
  username: z
    .string()
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
    .max(150, 'El nombre de usuario no puede exceder 150 caracteres')
    .regex(/^[\w.@+-]+$/, 'Solo se permiten letras, números y @/./+/-/_'),
  
  email: z
    .string()
    .email('Debe ser un email válido')
    .min(1, 'El email es obligatorio'),
  
  first_name: z
    .string()
    .min(1, 'El nombre es obligatorio')
    .max(150, 'El nombre no puede exceder 150 caracteres'),
  
  last_name: z
    .string()
    .min(1, 'El apellido es obligatorio')
    .max(150, 'El apellido no puede exceder 150 caracteres'),
  
  role: z
    .enum([
      'SUPERADMIN',
      'ADMIN',
      'DIRECTOR',
      'PROFESSOR',
      'STUDENT',
      'CLIENT',
      'CEO',
      'RH'
    ])
    .default('STUDENT'),
  
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'La contraseña debe contener al menos una mayúscula, una minúscula y un número'
    ),
  
  password_confirm: z
    .string()
    .min(1, 'Debe confirmar la contraseña'),
}).refine(
  (data) => data.password === data.password_confirm,
  {
    message: 'Las contraseñas no coinciden',
    path: ['password_confirm'],
  }
);

/**
 * User update schema - password is optional
 */
export const userUpdateSchema = z.object({
  username: z
    .string()
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
    .max(150, 'El nombre de usuario no puede exceder 150 caracteres')
    .regex(/^[\w.@+-]+$/, 'Solo se permiten letras, números y @/./+/-/_')
    .optional(),
  
  email: z
    .string()
    .email('Debe ser un email válido')
    .optional(),
  
  first_name: z
    .string()
    .max(150, 'El nombre no puede exceder 150 caracteres')
    .optional(),
  
  last_name: z
    .string()
    .max(150, 'El apellido no puede exceder 150 caracteres')
    .optional(),
  
  role: z
    .enum([
      'SUPERADMIN',
      'ADMIN',
      'DIRECTOR',
      'PROFESSOR',
      'STUDENT',
      'CLIENT',
      'CEO',
      'RH'
    ])
    .optional(),
});

/**
 * Password change schema
 */
export const passwordChangeSchema = z.object({
  current_password: z
    .string()
    .min(1, 'La contraseña actual es obligatoria'),
  
  new_password: z
    .string()
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'La contraseña debe contener al menos una mayúscula, una minúscula y un número'
    ),
  
  confirm_password: z
    .string()
    .min(1, 'Debe confirmar la nueva contraseña'),
}).refine(
  (data) => data.new_password === data.confirm_password,
  {
    message: 'Las contraseñas no coinciden',
    path: ['confirm_password'],
  }
);
