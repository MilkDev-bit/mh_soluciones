/**
 * Central export for all validation schemas
 * These schemas are aligned with backend models and provide
 * client-side validation using Zod
 */

export { taskSchema, taskUpdateSchema } from './taskSchema';
export { projectSchema, projectUpdateSchema } from './projectSchema';
export { userSchema, userUpdateSchema, passwordChangeSchema } from './userSchema';
export { fileUploadSchema, multipleFileUploadSchema } from './fileUploadSchema';
