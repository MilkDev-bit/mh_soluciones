from django import forms
from .models import Task, TaskSubmission
from apps.projects.models import Project
from apps.authentication.models import CustomUser

class TaskForm(forms.ModelForm):
    """
    Formulario para la creación y edición de Tareas en el panel de administrador.
    """
    class Meta:
        model = Task
        fields = [
            'title',
            'description',
            'project',
            'assigned_to',
            'status',
            'due_date',
        ]
        widgets = {
            'description': forms.Textarea(attrs={'rows': 4}),
            'due_date': forms.DateInput(attrs={'type': 'date'}),
        }

    def __init__(self, *args, **kwargs):
        """
        Personaliza el formulario al inicializarse.
        """
        super().__init__(*args, **kwargs)
        self.fields['assigned_to'].queryset = CustomUser.objects.exclude(role=CustomUser.Role.CLIENT)
        self.fields['project'].queryset = Project.objects.order_by('name')


class TaskSubmissionForm(forms.ModelForm):
    """
    Formulario para manejar la entrega de documentos en una tarea.
    """
    class Meta:
        model = TaskSubmission
        fields = [
            'task',
            'submitted_by',
            'file',
            'notes',
        ]
        widgets = {
            'notes': forms.Textarea(attrs={'rows': 3}),
        }