import os
from datetime import datetime
from django.utils import timezone

def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

def generate_project_folder_structure(project_name):
    """Genera estructura de carpetas para un proyecto"""
    now = datetime.now()
    year = now.strftime('%Y')
    month = now.strftime('%m')
    return f"{year}/{project_name}/{month}"

def calculate_time_spent(start_time, end_time=None):
    """Calcula el tiempo transcurrido entre dos fechas"""
    end_time = end_time or timezone.now()
    return end_time - start_time