from rest_framework.routers import SimpleRouter
from .views import CalendarEventViewSet

router = SimpleRouter()
router.register(r'calendar-events', CalendarEventViewSet, basename='calendarevent')

urlpatterns = router.urls