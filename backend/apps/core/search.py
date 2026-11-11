"""
Búsqueda sin importar acentos, mayúsculas, ñ, signos ni el orden de las
palabras.

"region 2 norte", "REGIÓN 2 NORTE", "norte región-2" o "cedis bajio" vs
"CEDIS BAJÍO" encuentran lo mismo. Funciona en PostgreSQL y SQLite sin
extensiones: cada palabra se convierte en una expresión regular donde cada
vocal (y n/c) acepta sus variantes acentuadas, y se compara con
`__iregex`. Todas las palabras deben aparecer (en cualquiera de los campos).
"""
import re
import unicodedata
from functools import reduce
from operator import and_, or_

from django.db.models import Q
from rest_framework.filters import SearchFilter

_VARIANTS = {
    'a': 'aáàäâãAÁÀÄÂÃ',
    'e': 'eéèëêEÉÈËÊ',
    'i': 'iíìïîIÍÌÏÎ',
    'o': 'oóòöôõOÓÒÖÔÕ',
    'u': 'uúùüûUÚÙÜÛ',
    'n': 'nñNÑ',
    'c': 'cçCÇ',
}

# Se tratan como espacio: guiones, puntos, comas, diagonales, #, etc.
_SEPARATORS = re.compile(r"[\s\-_.,;:/\\#()\[\]'\"]+")


def strip_accents(text: str) -> str:
    """'Región Bajío Ñ' → 'region bajio n'."""
    decomposed = unicodedata.normalize('NFKD', text or '')
    return ''.join(ch for ch in decomposed if not unicodedata.combining(ch)).lower()


def search_tokens(text: str):
    return [t for t in _SEPARATORS.split(strip_accents(text)) if t]


def token_regex(token: str) -> str:
    """'bajio' → 'b[aáà…]j[iíì…][oóò…]' (para __iregex)."""
    parts = []
    for ch in token:
        variants = _VARIANTS.get(ch)
        parts.append(f'[{variants}]' if variants else re.escape(ch))
    return ''.join(parts)


def accent_insensitive_q(fields, text: str):
    """Q que exige cada palabra de `text` en alguno de `fields` (o None si no hay palabras)."""
    tokens = search_tokens(text)
    if not tokens:
        return None
    per_token = [
        reduce(or_, (Q(**{f'{field}__iregex': token_regex(token)}) for field in fields))
        for token in tokens
    ]
    return reduce(and_, per_token)


class AccentInsensitiveSearchFilter(SearchFilter):
    """SearchFilter de DRF, pero sin distinguir acentos, ñ, signos ni mayúsculas."""

    def filter_queryset(self, request, queryset, view):
        fields = [f.lstrip('^=@$') for f in self.get_search_fields(view, request) or []]
        text = request.query_params.get(self.search_param, '')
        if not fields or not text.strip():
            return queryset
        q = accent_insensitive_q(fields, text)
        return queryset.filter(q).distinct() if q is not None else queryset
