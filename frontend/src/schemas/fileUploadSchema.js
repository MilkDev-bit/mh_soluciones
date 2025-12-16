import { z } from 'zod';

// Maximum file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Allowed file types
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'text/plain',
  'application/zip',
];

/**
 * File upload validation schema aligned with backend Document model
 * Validates file uploads
 */
export const fileUploadSchema = z.object({
  file: z
    .instanceof(File, { message: 'Debe seleccionar un archivo' })
    .refine(
      (file) => file.size <= MAX_FILE_SIZE,
      'El archivo no puede exceder 50MB'
    )
    .refine(
      (file) => ALLOWED_FILE_TYPES.includes(file.type),
      'Tipo de archivo no permitido. Formatos permitidos: PDF, Word, Excel, imágenes (JPG, PNG, GIF, WebP), videos (MP4, WebM), ZIP, TXT'
    ),
  
  folder_type: z
    .enum([
      'OPERATIVO',
      'ADMINISTRATIVO',
      'DOCUMENTOS',
      'IMAGENES',
      'VIDEOS',
      'ARCHIVOS',
      'OTROS'
    ])
    .default('DOCUMENTOS'),
  
  description: z
    .string()
    .max(500, 'La descripción no puede exceder 500 caracteres')
    .optional()
    .default(''),
  
  project: z
    .number()
    .positive('Debe seleccionar un proyecto válido')
    .optional()
    .nullable(),
  
  task: z
    .number()
    .positive('Debe seleccionar una tarea válida')
    .optional()
    .nullable(),
});

/**
 * Multiple file upload schema
 */
export const multipleFileUploadSchema = z.object({
  files: z
    .array(
      z.instanceof(File).refine(
        (file) => file.size <= MAX_FILE_SIZE,
        'Uno o más archivos exceden el tamaño máximo de 50MB'
      )
    )
    .min(1, 'Debe seleccionar al menos un archivo')
    .max(10, 'No puede subir más de 10 archivos a la vez'),
  
  folder_type: z
    .enum([
      'OPERATIVO',
      'ADMINISTRATIVO',
      'DOCUMENTOS',
      'IMAGENES',
      'VIDEOS',
      'ARCHIVOS',
      'OTROS'
    ])
    .default('DOCUMENTOS'),
  
  project: z
    .number()
    .positive('Debe seleccionar un proyecto válido')
    .optional()
    .nullable(),
});
