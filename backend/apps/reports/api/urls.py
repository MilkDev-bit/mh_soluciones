from django.urls import path
from .views import DashboardDataAPIView, GlobalSearchAPIView

urlpatterns = [
    path('dashboard/', DashboardDataAPIView.as_view(), name='dashboard-data'),
    path('search/', GlobalSearchAPIView.as_view(), name='global-search'),
]