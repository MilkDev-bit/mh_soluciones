import os
import logging
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

logger = logging.getLogger(__name__)

# Optional imports for security features
try:
    import magic
except ImportError:
    magic = None
    logger.warning("python-magic not installed. MIME type validation will be skipped.")

try:
    import pyclamd
except ImportError:
    pyclamd = None
    logger.warning("pyclamd not installed. Malware scanning will be skipped.")


# Map typical extensions to common mime types for quick basic allow-listing.
ALLOWED_MIME_TYPES = {
    '.pdf': ['application/pdf'],
    '.doc': ['application/msword'],
    '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    '.xls': ['application/vnd.ms-excel'],
    '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    '.ppt': ['application/vnd.ms-powerpoint'],
    '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    '.jpg': ['image/jpeg'],
    '.jpeg': ['image/jpeg'],
    '.png': ['image/png'],
    '.gif': ['image/gif'],
    '.zip': ['application/zip', 'application/x-zip-compressed'],
    '.rar': ['application/x-rar-compressed', 'application/vnd.rar'],
    '.txt': ['text/plain'],
    '.csv': ['text/csv', 'text/plain'],
}

def scan_with_clamav(file_obj):
    """
    Scans a file object with ClamAV (if available).
    Falls back gracefully if pyclamd connection fails or is not installed.
    """
    if not pyclamd:
        return

    try:
        # Try local unix socket or network socket
        try:
            cd = pyclamd.ClamdUnixSocket()
            cd.ping()
        except (pyclamd.ConnectionError, AttributeError):
            cd = pyclamd.ClamdNetworkSocket()
            cd.ping()
            
        file_obj.seek(0)
        # Scan stream
        result = cd.scan_stream(file_obj.read())
        file_obj.seek(0)
        
        if result:
            logger.warning(f"Virus detected in upload: {result}")
            raise ValidationError(_('Se ha detectado contenido malicioso en el archivo.'))
            
    except (pyclamd.ConnectionError, AttributeError):
        # ClamAV not set up, gracefully skip.
        logger.info("ClamAV no está configurado o no responde. Saltando escaneo de virus.")
        file_obj.seek(0)
    except Exception as e:
        logger.error(f"Error during ClamAV scan: {str(e)}")
        file_obj.seek(0)

def validate_file_extension(value):
    """
    Validator to check if a file has a permitted extension and matches its real MIME type.
    Includes an optional ClamAV malware scan.
    """
    ext = os.path.splitext(value.name)[1].lower()
    valid_extensions = list(ALLOWED_MIME_TYPES.keys())
    
    if ext not in valid_extensions:
        raise ValidationError(_('Tipo de archivo no soportado. Extensiones permitidas: ') + ', '.join(valid_extensions))
        
    # Check MIME with magic if available
    if magic:
        try:
            value.file.seek(0)
            file_mime = magic.from_buffer(value.file.read(2048), mime=True)
            value.file.seek(0)
            
            allowed_mimes = ALLOWED_MIME_TYPES.get(ext, [])
            if allowed_mimes and file_mime not in allowed_mimes:
                logger.warning(f"File {value.name} has fake extension. Real MIME is {file_mime}.")
                raise ValidationError(_('El contenido del archivo no coincide con su extensión.'))
        except Exception as e:
            logger.error(f"Error validating MIME with magic: {e}")
            value.file.seek(0)
        
    # Malware scan
    scan_with_clamav(value.file)

class FileExtensionWhitelistValidator:
    def __init__(self, allowed_extensions=None):
        if allowed_extensions:
            self.allowed_extensions = [ext.lower() if ext.startswith('.') else f'.{ext.lower()}' for ext in allowed_extensions]
        else:
            self.allowed_extensions = list(ALLOWED_MIME_TYPES.keys())

    def __call__(self, value):
        ext = os.path.splitext(value.name)[1].lower()
        if ext not in self.allowed_extensions:
            raise ValidationError(
                _('Tipo de archivo "%(ext)s" no soportado. Extensiones permitidas: %(allowed)s'),
                params={'ext': ext, 'allowed': ', '.join(self.allowed_extensions)},
            )
            
        # Check MIME with magic if available
        if magic:
            try:
                value.file.seek(0)
                file_mime = magic.from_buffer(value.file.read(2048), mime=True)
                value.file.seek(0)
                
                # Verify the MIME falls into known good types for the extension
                allowed_mimes = ALLOWED_MIME_TYPES.get(ext, [])
                if allowed_mimes and file_mime not in allowed_mimes:
                    logger.warning(f"File {value.name} has fake extension. Real MIME is {file_mime}.")
                    raise ValidationError(_('El contenido del archivo no coincide con su extensión.'))
            except Exception as e:
                logger.error(f"Error validating MIME with magic: {e}")
                value.file.seek(0)
            
        # Malware scan
        scan_with_clamav(value.file)
