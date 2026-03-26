"""
Check the status of task submissions and their documents uploaded today.
Uses sys.modules to mock missing native libs before Django setup.
Run: venv\Scripts\python.exe check_today_submissions.py
"""
import sys
import types

# Mock modules that may not be installed locally (magic, pyclamd)
for mod_name in ['magic', 'pyclamd']:
    mock = types.ModuleType(mod_name)
    mock.from_buffer = lambda *a, **kw: 'application/octet-stream'
    mock.ClamdUnixSocket = lambda *a, **kw: None
    mock.ClamdNetworkSocket = lambda *a, **kw: None
    mock.ConnectionError = Exception
    sys.modules[mod_name] = mock

import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from datetime import date
from apps.tasks.models import TaskSubmission
from apps.documents.models import Document

today = date.today()

print(f"\n{'='*60}")
print(f"ENTREGAS DE HOY ({today.strftime('%d/%m/%Y')})")
print('='*60)

submissions_today = TaskSubmission.objects.filter(
    created_at__date=today
).select_related('submitted_by', 'task', 'task__project').prefetch_related('documents')

if not submissions_today.exists():
    print("No hay entregas de hoy registradas.")
else:
    for sub in submissions_today:
        print(f"\n📋 Entrega #{sub.id} | Tarea: {sub.task.title}")
        print(f"   Proyecto: {sub.task.project.name if sub.task.project else 'Sin proyecto'}")
        print(f"   Estudiante: {sub.submitted_by.get_full_name()} ({sub.submitted_by.email})")
        print(f"   Hora: {sub.created_at.astimezone().strftime('%H:%M:%S')}")
        print(f"   Estado: {sub.status} | Version: v{sub.version}")

        docs = sub.documents.all()
        if docs.exists():
            print(f"   Documentos ({docs.count()}):")
            for doc in docs:
                status_icon = {'COMPLETE': '✅', 'PENDING': '⏳', 'UPLOADING': '📤', 'FAILED': '❌'}.get(doc.upload_status, '❓')
                print(f"     {status_icon} [{doc.upload_status}] {doc.name}")
                if doc.drive_file_url:
                    print(f"        Drive: {doc.drive_file_url}")
                else:
                    print(f"        Sin URL de Drive guardada")
        else:
            print(f"   Sin documentos enlazados (Document model)")
            if sub.files_metadata:
                print(f"   files_metadata ({len(sub.files_metadata)} archivos):")
                for fm in sub.files_metadata:
                    link = fm.get('web_view_link', 'sin link')
                    print(f"     - {fm.get('name','?')} | {link}")
            if sub.google_drive_link:
                print(f"   google_drive_link: {sub.google_drive_link}")
            if sub.file:
                print(f"   file field: {sub.file.name}")

print(f"\n{'='*60}")
print("RESUMEN DOCUMENTOS DE HOY")
print('='*60)

docs_today = Document.objects.filter(created_at__date=today)
status_counts = {}
for doc in docs_today:
    status_counts[doc.upload_status] = status_counts.get(doc.upload_status, 0) + 1

if not status_counts:
    print("  No hay documentos creados hoy.")
else:
    for status, count in sorted(status_counts.items()):
        icon = {'COMPLETE': '✅', 'PENDING': '⏳', 'UPLOADING': '📤', 'FAILED': '❌'}.get(status, '?')
        print(f"  {icon} {status}: {count} documento(s)")

failed = docs_today.filter(upload_status__in=['FAILED', 'PENDING'])
if failed.exists():
    print(f"\n⚠️  DOCUMENTOS QUE NO SE SUBIERON A DRIVE ({failed.count()}):")
    for doc in failed:
        print(f"  ID={doc.id} | {doc.name} | Status={doc.upload_status}")
        if doc.file:
            print(f"    Archivo local: {doc.file.name}")
