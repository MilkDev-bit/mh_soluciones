from django.urls import path
from .views import (
    DashboardDataAPIView, EntregablesReportAPIView, GeneralStatusAPIView, GlobalSearchAPIView, StatisticsAPIView,
)

urlpatterns = [
    path('dashboard/', DashboardDataAPIView.as_view(), name='dashboard-data'),
    path('search/', GlobalSearchAPIView.as_view(), name='global-search'),
    path('statistics/', StatisticsAPIView.as_view(), name='statistics'),
    path('entregables/', EntregablesReportAPIView.as_view(), name='entregables-xlsx'),
    path('general-status/', GeneralStatusAPIView.as_view(), name='general-status'),
]