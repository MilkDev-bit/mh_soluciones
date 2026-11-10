"""
Explorador de archivos: carpetas virtuales, filtros en servidor y descarga ZIP.

Antes, el Centro de Archivos:
- descargaba hasta 1000 documentos de golpe y filtraba en el navegador (y
  si había más de 1000, los demás simplemente no aparecían);
- para ver carpetas consultaba la API de Google Drive en cada clic (lento) y
  solo mostraba archivos de la carpeta inmediata, nunca de sus subcarpetas;
- sin proyecto seleccionado, las "carpetas" eran una lista fija en el código;
- solo podía descargar en ZIP esas carpetas fijas, en el navegador y
  omitiendo los archivos que solo existían en Drive.

Ahora las carpetas se calculan desde la base de datos con la MISMA jerarquía
que se usa en Drive (Año / Proyecto / Tarea / Usuario):

    Proyecto ─▶ Carpeta (título de la tarea, o carpeta de Drive si se subió
                 directo, o "Archivos generales") ─▶ Persona ─▶ archivos

Son agregaciones SQL (1-2 queries), sin llamar a Drive.
"""
import logging
import re
import zipfile
from datetime import datetime, time

from django.db.models import Count, F, Max, Q, Sum, Value
from django.db.models.functions import Coalesce, NullIf
from django.utils import timezone

logger = logging.getLogger(__name__)

GENERAL_FOLDER = 'Archivos generales'


# ---------------------------------------------------------------------------
# Carpeta virtual
# ---------------------------------------------------------------------------

def folder_expression():
    """Nombre de la carpeta de un documento: tarea > carpeta de Drive > general."""
    return Coalesce(
        NullIf(F('task__title'), Value('')),
        NullIf(F('drive_parent_folder_name'), Value('')),
        Value(GENERAL_FOLDER),
    )


def with_folder(queryset):
    return queryset.annotate(folder_name=folder_expression())


# ---------------------------------------------------------------------------
# Filtros comunes (lista, resumen de carpetas y ZIP usan los mismos)
# ---------------------------------------------------------------------------

def _parse_date(value):
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except (TypeError, ValueError):
        return None


def apply_filters(queryset, params, *, skip=()):
    """Filtra por los parámetros del explorador.

    project, folder, uploaded_by, search, folder_type, date_from, date_to
    (fechas YYYY-MM-DD en hora local: date_to incluye todo ese día).
    """
    queryset = with_folder(queryset)

    project = params.get('project')
    if project and 'project' not in skip:
        try:
            pid = int(project)
            queryset = queryset.filter(Q(project_id=pid) | Q(project__isnull=True, task__project_id=pid))
        except (TypeError, ValueError):
            return queryset.none()

    folder = params.get('folder')
    if folder and 'folder' not in skip:
        queryset = queryset.filter(folder_name=folder)

    uploaded_by = params.get('uploaded_by')
    if uploaded_by and 'uploaded_by' not in skip:
        try:
            queryset = queryset.filter(uploaded_by_id=int(uploaded_by))
        except (TypeError, ValueError):
            return queryset.none()

    search = (params.get('search') or '').strip()
    if search:
        queryset = queryset.filter(
            Q(name__icontains=search)
            | Q(task__title__icontains=search)
            | Q(uploaded_by__first_name__icontains=search)
            | Q(uploaded_by__last_name__icontains=search)
        )

    folder_type = params.get('folder_type')
    if folder_type:
        queryset = queryset.filter(folder_type=folder_type)

    tz = timezone.get_default_timezone()
    date_from = _parse_date(params.get('date_from'))
    if date_from:
        queryset = queryset.filter(
            created_at__gte=timezone.make_aware(datetime.combine(date_from, time.min), tz))
    date_to = _parse_date(params.get('date_to'))
    if date_to:
        queryset = queryset.filter(
            created_at__lte=timezone.make_aware(datetime.combine(date_to, time.max), tz))

    return queryset


# ---------------------------------------------------------------------------
# Resumen de carpetas
# ---------------------------------------------------------------------------

def _stats(qs, *group_by):
    return (qs.order_by().values(*group_by)
            .annotate(count=Count('id'), size=Coalesce(Sum('file_size'), 0),
                      last_upload=Max('created_at')))


def folder_summary(queryset, params):
    """Hijos del nivel actual del explorador.

    - sin project:          proyectos
    - project:              carpetas del proyecto
    - project + folder:     personas dentro de la carpeta
    Respeta search / folder_type / fechas, para que los conteos coincidan
    con lo que se verá al entrar.
    """
    project = params.get('project')
    folder = params.get('folder')
    qs = apply_filters(queryset, params, skip=('folder', 'uploaded_by'))

    if not project:
        rows = _stats(qs.annotate(pid=Coalesce('project_id', 'task__project_id')),
                      'pid', 'project__name', 'task__project__name')
        merged = {}
        for r in rows:
            key = r['pid']
            name = r['project__name'] or r['task__project__name'] or 'Sin proyecto'
            item = merged.setdefault(key, {'kind': 'project', 'id': key, 'name': name,
                                           'count': 0, 'size': 0, 'last_upload': None})
            _accumulate(item, r)
        items = sorted(merged.values(), key=lambda i: i['name'].lower())
        return {'level': 'projects', 'items': items}

    if not folder:
        rows = _stats(qs, 'folder_name')
        items = [{'kind': 'folder', 'id': r['folder_name'], 'name': r['folder_name'],
                  'count': r['count'], 'size': r['size'], 'last_upload': r['last_upload']}
                 for r in rows]
        items.sort(key=lambda i: (i['name'] == GENERAL_FOLDER, i['name'].lower()))
        return {'level': 'folders', 'items': items}

    rows = _stats(qs.filter(folder_name=folder), 'uploaded_by_id', 'uploaded_by__first_name',
                  'uploaded_by__last_name', 'uploaded_by__username')
    items = []
    for r in rows:
        full = f"{r['uploaded_by__first_name'] or ''} {r['uploaded_by__last_name'] or ''}".strip()
        items.append({'kind': 'person', 'id': r['uploaded_by_id'],
                      'name': full or r['uploaded_by__username'] or 'Sin usuario',
                      'count': r['count'], 'size': r['size'], 'last_upload': r['last_upload']})
    items.sort(key=lambda i: i['name'].lower())
    return {'level': 'people', 'items': items}


def _accumulate(item, row):
    item['count'] += row['count']
    item['size'] += row['size'] or 0
    if row['last_upload'] and (item['last_upload'] is None or row['last_upload'] > item['last_upload']):
        item['last_upload'] = row['last_upload']


# ---------------------------------------------------------------------------
# ZIP en streaming
# ---------------------------------------------------------------------------

MAX_ZIP_FILES = 2000
_UNSAFE = re.compile(r'[\\/:*?"<>|\x00-\x1f]+')


def safe_name(value, fallback='archivo'):
    value = _UNSAFE.sub('_', (value or '').strip()).strip('. ')
    return value[:150] or fallback


class _ZipSink:
    """Destino no "seekable" para zipfile: acumula bytes y los entrega por partes."""

    def __init__(self):
        self.chunks = []
        self.offset = 0
        self.pending = 0

    def write(self, data):
        self.chunks.append(bytes(data))
        self.offset += len(data)
        self.pending += len(data)
        return len(data)

    def tell(self):
        return self.offset

    def flush(self):
        pass

    def drain(self):
        data, self.chunks, self.pending = b''.join(self.chunks), [], 0
        return data


def zip_entries(documents, level_params):
    """Lista (ruta dentro del ZIP, documento) con carpetas Carpeta/Persona/archivo."""
    entries, used = [], set()
    for doc in documents:
        parts = []
        if not level_params.get('project'):
            parts.append(safe_name(doc['project_name'] or 'Sin proyecto'))
        if not level_params.get('folder'):
            parts.append(safe_name(doc['folder_name']))
        if not level_params.get('uploaded_by'):
            parts.append(safe_name(doc['uploader'] or 'Sin usuario'))
        name = safe_name(doc['name'] or f"archivo_{doc['id']}")
        if doc['is_link']:
            name = f"{name}.url"
        path = '/'.join(parts + [name])
        base, dot, ext = path.rpartition('.')
        n = 2
        while path.lower() in used:  # nombres repetidos → "archivo (2).pdf"
            path = f"{base} ({n}).{ext}" if dot else f"{path} ({n})"
            n += 1
        used.add(path.lower())
        entries.append((path, doc))
    return entries


def zip_document_rows(queryset):
    """Datos mínimos para el ZIP (se leen ANTES de empezar el streaming)."""
    rows = (queryset.annotate(pid_name=Coalesce('project__name', 'task__project__name'))
            .values('id', 'name', 'file', 'drive_file_id', 'is_link', 'link', 'folder_name',
                    'pid_name', 'uploaded_by__first_name', 'uploaded_by__last_name',
                    'uploaded_by__username')
            .order_by('folder_name', 'uploaded_by__first_name', 'created_at')[:MAX_ZIP_FILES + 1])
    docs = []
    for r in rows:
        full = f"{r['uploaded_by__first_name'] or ''} {r['uploaded_by__last_name'] or ''}".strip()
        docs.append({
            'id': r['id'], 'name': r['name'], 'file': r['file'], 'drive_file_id': r['drive_file_id'],
            'is_link': r['is_link'], 'link': r['link'], 'folder_name': r['folder_name'],
            'project_name': r['pid_name'], 'uploader': full or r['uploaded_by__username'],
        })
    return docs


def iter_zip(entries, chunk_size=1024 * 1024):
    """Genera el ZIP por partes, leyendo cada archivo de S3/disco o de Drive.

    Los archivos que no se pueden leer se omiten y se listan en
    _ARCHIVOS_NO_INCLUIDOS.txt dentro del mismo ZIP.
    """
    from django.core.files.storage import default_storage

    sink = _ZipSink()
    failed = []
    drive = None
    # ZIP_STORED: PDFs, imágenes y Office ya vienen comprimidos; comprimir de
    # nuevo solo gasta CPU del servidor.
    with zipfile.ZipFile(sink, mode='w', compression=zipfile.ZIP_STORED, allowZip64=True) as zf:
        for path, doc in entries:
            try:
                if doc['is_link']:
                    zf.writestr(path, f"[InternetShortcut]\nURL={doc['link'] or ''}\n")
                elif doc['file']:
                    with default_storage.open(doc['file'], 'rb') as src, \
                            zf.open(path, 'w', force_zip64=True) as dst:
                        while True:
                            block = src.read(chunk_size)
                            if not block:
                                break
                            dst.write(block)
                            if sink.pending >= chunk_size:
                                yield sink.drain()
                elif doc['drive_file_id']:
                    if drive is None:
                        drive = _drive_service()
                    yield from _copy_from_drive(drive, doc['drive_file_id'], zf, path, sink, chunk_size)
                else:
                    failed.append(f"{path}: el archivo no tiene contenido almacenado")
            except Exception as exc:  # un archivo dañado no debe cortar toda la descarga
                logger.warning("ZIP: no se pudo agregar %s (doc %s): %s", path, doc['id'], exc)
                failed.append(f"{path}: {exc.__class__.__name__}")
            data = sink.drain()
            if data:
                yield data
        if failed:
            zf.writestr('_ARCHIVOS_NO_INCLUIDOS.txt',
                        'Estos archivos no se pudieron incluir:\n\n' + '\n'.join(failed) + '\n')
    data = sink.drain()
    if data:
        yield data


def _drive_service():
    from .services import GoogleDriveService
    return GoogleDriveService(use_institutional=True)


def _copy_from_drive(drive, file_id, zf, path, sink, chunk_size):
    from googleapiclient.http import MediaIoBaseDownload

    class _Writer:
        def __init__(self, dst):
            self.dst = dst

        def write(self, data):
            self.dst.write(data)
            return len(data)

    request = drive.service.files().get_media(fileId=file_id, supportsAllDrives=True)
    with zf.open(path, 'w', force_zip64=True) as dst:
        downloader = MediaIoBaseDownload(_Writer(dst), request, chunksize=chunk_size)
        done = False
        while not done:
            _status, done = downloader.next_chunk(num_retries=2)
            if sink.pending >= chunk_size:
                yield sink.drain()
