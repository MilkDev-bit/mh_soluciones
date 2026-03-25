import os
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

def validate_file_extension(value):
    """
    Validator to check if a file has a permitted extension.
    """
    ext = os.path.splitext(value.name)[1]  # [0] returns path+filename
    valid_extensions = [
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', 
        '.jpg', '.jpeg', '.png', '.gif', '.zip', '.rar', '.txt', '.csv'
    ]
    if not ext.lower() in valid_extensions:
        raise ValidationError(_('Tipo de archivo no soportado. Extensiones permitidas: ') + ', '.join(valid_extensions))

class FileExtensionWhitelistValidator:
    def __init__(self, allowed_extensions=None):
        if allowed_extensions:
            self.allowed_extensions = [ext.lower() if ext.startswith('.') else f'.{ext.lower()}' for ext in allowed_extensions]
        else:
            self.allowed_extensions = [
                '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', 
                '.jpg', '.jpeg', '.png', '.gif', '.zip', '.rar', '.txt', '.csv'
            ]

    def __call__(self, value):
        ext = os.path.splitext(value.name)[1]
        if not ext.lower() in self.allowed_extensions:
            raise ValidationError(
                _('Tipo de archivo "%(ext)s" no soportado. Extensiones permitidas: %(allowed)s'),
                params={'ext': ext, 'allowed': ', '.join(self.allowed_extensions)},
            )
