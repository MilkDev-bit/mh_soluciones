# Implementation Notes - Google Drive Folder Structure Update

## Overview
This document describes the changes made to the Google Drive folder structure and file management system in the MH Soluciones application.

## Date: December 19, 2025

---

## Changes Implemented

### 1. New Google Drive Folder Structure

**Previous Structure:**
```
MH Soluciones/
└── [AÑO]/
    └── [PROYECTO]/
        └── [TIPO_CARPETA]/
            └── archivo_usuario_fecha.ext
```

**New Structure:**
```
[AÑO]/
└── [PROYECTO]/
    └── [NOMBRE_TAREA]/ (optional - only if task exists)
        └── [USUARIO]/
            └── archivo.ext
```

**Key Changes:**
- Removed "MH Soluciones" root folder (now starts at year level)
- Removed intermediate folder type level
- Added task name level (when applicable)
- Added user-specific folder level
- Files keep original names (no date/user suffix)
- No version subfolders - all user files in same level

**Example Paths:**
- With task: `2025/Axioma/Diseño de Interface/Rebeca Macias/mockup.pdf`
- Without task: `2025/Axioma/Juan Perez/documento.pdf`
- General (no project): `2025/General/Maria Lopez/archivo.docx`

### 2. Centro de Archivos - New Folder Filter

**Location:** `frontend/src/pages/ArchivosPage.jsx`

**Added Features:**
- New dropdown filter for folder types
- Placed between search box and existing type filter
- Filters include:
  - Todas las carpetas (All)
  - Operativo
  - Administrativo
  - Documentos
  - Imágenes
  - Videos
  - Archivos
  - Entrega de Tarea
  - Otros

**Behavior:**
- Works independently from the existing type filter
- Priority: Folder filter > Type filter > Default
- Resets when changing projects
- Affects both display and file upload

### 3. GoogleDriveFolder Component Enhancements

**Location:** `frontend/src/components/projects/GoogleDriveFolder.jsx`

**Added Features:**
- **Search Filter**: Search files by name (case-insensitive)
- **Folder Type Filter**: Filter by folder category
- **Pagination**: 
  - 20 files per page (default)
  - Previous/Next navigation buttons
  - Page indicator (Page X of Y)
  - Disabled buttons at boundaries

**UI Updates:**
- Filters appear above document list
- Responsive design for mobile
- Maintains consistent styling with app theme
- Empty state shows when no results match filters

### 4. Backend API Updates

**Endpoint:** `/api/projects/{id}/drive-folder/`

**New Query Parameters:**
- `page`: Page number (default: 1)
- `page_size`: Items per page (default: 20, max: 100)
- `search`: Search term for file names
- `folder_type`: Filter by folder type

**Response Format:**
```json
{
  "project_name": "Project Name",
  "total_documents": 45,
  "page": 1,
  "page_size": 20,
  "total_pages": 3,
  "has_next": true,
  "has_previous": false,
  "documents": [...]
}
```

---

## Technical Details

### Modified Files

**Backend:**
- `backend/apps/documents/services.py` - GoogleDriveService.upload_document()
- `backend/apps/projects/api/views.py` - ProjectViewSet.drive_folder()

**Frontend:**
- `frontend/src/pages/ArchivosPage.jsx`
- `frontend/src/pages/ArchivosPage.scss`
- `frontend/src/components/projects/GoogleDriveFolder.jsx`
- `frontend/src/components/projects/GoogleDriveFolder.scss`
- `frontend/src/services/projectService.js`

### Dependencies
No new dependencies added. All changes use existing libraries and frameworks.

---

## Migration Considerations

### Existing Files
- **Not automatically migrated** - files remain in old structure
- New uploads use new structure
- Both structures coexist
- Consider manual migration if needed

### User Impact
- Users will see new folder organization for new uploads
- Old files remain accessible in their current locations
- Search and filtering work across both structures
- No user action required

### Google Drive Impact
- Drive API calls remain the same
- Folder creation uses existing `_get_or_create_folder` method
- Permissions handled as before
- No changes to authentication/authorization

---

## Testing Checklist

### Backend Testing
- [ ] Test file upload with task assigned
- [ ] Test file upload without task
- [ ] Test file upload without project
- [ ] Verify folder structure in Google Drive
- [ ] Test pagination endpoint
- [ ] Test search filter
- [ ] Test folder type filter
- [ ] Test edge cases (empty results, max page size)

### Frontend Testing
- [ ] Test folder filter in ArchivosPage
- [ ] Test search in GoogleDriveFolder
- [ ] Test pagination navigation
- [ ] Test filter combinations
- [ ] Test on mobile devices
- [ ] Verify empty states
- [ ] Check loading states
- [ ] Verify error handling

### Integration Testing
- [ ] Upload files and verify folder structure
- [ ] Search for files across projects
- [ ] Filter by multiple criteria
- [ ] Navigate between pages
- [ ] Test with different user roles
- [ ] Verify permissions

---

## Known Limitations

1. **No Automatic Migration**: Existing files remain in old structure
2. **Mixed Structure**: Old and new structures coexist
3. **Search Scope**: Search only filters current result set, not all Drive files
4. **Pagination**: Client-side only, all documents fetched from database

---

## Future Enhancements

1. **Migration Tool**: Script to move existing files to new structure
2. **Bulk Operations**: Select and move multiple files
3. **Advanced Search**: Search across all Drive folders
4. **Folder Views**: Tree view of folder hierarchy
5. **Sorting Options**: Sort by name, date, size, etc.
6. **Download Options**: Bulk download, zip folders

---

## Support

For issues or questions:
1. Check backend logs for upload errors
2. Verify Google Drive credentials
3. Check GOOGLE_DRIVE_ROOT_FOLDER_ID setting
4. Verify user has Google Drive linked
5. Check browser console for frontend errors

---

## Rollback Procedure

If needed to rollback:

1. **Backend Rollback:**
   ```bash
   git checkout <previous-commit> backend/apps/documents/services.py
   git checkout <previous-commit> backend/apps/projects/api/views.py
   ```

2. **Frontend Rollback:**
   ```bash
   git checkout <previous-commit> frontend/src/pages/ArchivosPage.jsx
   git checkout <previous-commit> frontend/src/components/projects/GoogleDriveFolder.jsx
   git checkout <previous-commit> frontend/src/services/projectService.js
   ```

3. Rebuild and redeploy
4. Clear browser cache

---

## Performance Considerations

- Pagination reduces data transfer for large file lists
- Search/filter operations done in database
- Google Drive API calls minimized (create folders only when needed)
- Frontend filters use memoization where applicable

---

## Security Notes

- No changes to authentication/authorization
- Existing Google Drive permissions maintained
- User folder isolation enforced
- No cross-user file access added

---

## Changelog

### Version 1.0.0 - December 19, 2025
- Initial implementation of new folder structure
- Added folder filter to ArchivosPage
- Added pagination to GoogleDriveFolder component
- Added search and filter capabilities
- Updated backend API to support new features
