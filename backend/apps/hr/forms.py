from django import forms
from .models import EmployeeDocument, PerformanceReview

class EmployeeDocumentForm(forms.ModelForm):
    """
    Formulario para la creación y edición de documentos de empleados.
    """
    class Meta:
        model = EmployeeDocument
        fields = [
            'employee',
            'document_type',
            'title',
            'file',
            'uploaded_by',
        ]
        widgets = {
            'employee': forms.Select(attrs={'class': 'form-control'}),
            'uploaded_by': forms.Select(attrs={'class': 'form-control'}),
            'document_type': forms.Select(attrs={'class': 'form-control'}),
            'title': forms.TextInput(attrs={'class': 'form-control'}),
        }

class PerformanceReviewForm(forms.ModelForm):
    """
    Formulario para la creación y edición de evaluaciones de desempeño.
    """

    class Meta:
        model = PerformanceReview
        fields = [
            'employee',
            'reviewer',
            'review_date',
            'overall_rating',
            'strengths',
            'areas_for_improvement',
            'comments',
        ]
        widgets = {
            'review_date': forms.DateInput(attrs={'type': 'date', 'class': 'form-control'}),
            'strengths': forms.Textarea(attrs={'rows': 4, 'class': 'form-control'}),
            'areas_for_improvement': forms.Textarea(attrs={'rows': 4, 'class': 'form-control'}),
            'comments': forms.Textarea(attrs={'rows': 4, 'class': 'form-control'}),
        }