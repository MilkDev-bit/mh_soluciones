class RoleConstants:
    SUPERADMIN = 'SUPERADMIN'
    ADMIN = 'ADMIN'
    DIRECTOR = 'DIRECTOR'
    PROFESSOR = 'PROFESSOR'
    STUDENT = 'STUDENT'
    CLIENT = 'CLIENT'
    CEO = 'CEO'
    RH = 'RH'

    CHOICES = [
        (SUPERADMIN, 'Super Administrador'),
        (ADMIN, 'Administrador'),
        (DIRECTOR, 'Director'),
        (PROFESSOR, 'Profesor'),
        (STUDENT, 'Alumno'),
        (CLIENT, 'Cliente'),
        (CEO, 'CEO'),
        (RH, 'Recursos Humanos'),
    ]