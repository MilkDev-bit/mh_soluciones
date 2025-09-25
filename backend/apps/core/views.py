from django.http import HttpResponse

def index(request):
    """
    Vista de ejemplo para la aplicación 'core'.

    Esta vista no se conectará a ninguna URL pública, ya que la app 'core'
    solo provee lógica interna y compartida para el resto del proyecto.
    """
    return HttpResponse("La aplicación 'core' está funcionando correctamente.")