from django import forms
from .models import Project
from apps.authentication.models import CustomUser

class ProjectForm(forms.ModelForm):
    """
    Formulario para la creación y edición de Proyectos en el panel de administrador.
    """
    members = forms.ModelMultipleChoiceField(
        queryset=CustomUser.objects.all(),
        widget=forms.CheckboxSelectMultiple,
        required=False,
        label="Miembros del Equipo"
    )

    class Meta:
        model = Project
        fields = [
            'name',
            'description',
            'status',
            'client',
            'start_date',
            'end_date',
            'members',
        ]
        widgets = {
            'description': forms.Textarea(attrs={'rows': 4}),
            'start_date': forms.DateInput(attrs={'type': 'date'}),
            'end_date': forms.DateInput(attrs={'type': 'date'}),
        }

    def __init__(self, *args, **kwargs):
        """
        Sobrescribimos el método de inicialización para personalizar los querysets.
        """
        super().__init__(*args, **kwargs)
        self.fields['client'].queryset = CustomUser.objects.filter(role=CustomUser.Role.CLIENT)