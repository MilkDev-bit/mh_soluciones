from rest_framework.pagination import PageNumberPagination, LimitOffsetPagination


class StandardPageNumberPagination(PageNumberPagination):
    """
    Clase de paginación estándar que permite al cliente controlar el tamaño
    de página mediante el parámetro ?page_size=N (máximo 1000).
    """
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 1000


class AuditLogPagination(LimitOffsetPagination):
    default_limit = 30
    max_limit = 100
