/**
 * Task Management E2E Tests
 * Tests task creation, assignment, submission, and grading flows
 */

describe('Task Management Flow', () => {
  describe('Task Creation (Professor)', () => {
    beforeEach(() => {
      cy.fixture('users').then((users) => {
        cy.login(users.professor.username, users.professor.password)
      })
    })

    it('should create a new task successfully', () => {
      cy.visit('/proyectos')
      cy.get('[data-testid="project-card"]').first().click()
      
      cy.createTask({
        title: 'Tarea de Prueba E2E',
        description: 'Esta es una tarea creada por Cypress',
        due_date: '2024-12-31',
        priority: 'HIGH'
      })
      
      // Verify task appears in list
      cy.contains('Tarea de Prueba E2E').should('be.visible')
    })

    it('should validate required fields', () => {
      cy.visit('/proyectos')
      cy.get('[data-testid="project-card"]').first().click()
      cy.get('[data-testid="create-task-button"]').click()
      
      // Try to submit without filling required fields
      cy.get('button[type="submit"]').contains('Crear').click()
      
      // Should show validation error
      cy.contains('obligatorio').should('be.visible')
    })

    it('should validate date is not in the past', () => {
      cy.visit('/proyectos')
      cy.get('[data-testid="project-card"]').first().click()
      cy.get('[data-testid="create-task-button"]').click()
      
      cy.get('input[name="title"]').type('Tarea con fecha pasada')
      cy.get('input[name="due_date"]').type('2020-01-01')
      cy.get('button[type="submit"]').contains('Crear').click()
      
      // Should show validation error
      cy.contains(/pasado|inválid/i).should('be.visible')
    })

    it('should assign task to student', () => {
      cy.visit('/proyectos')
      cy.get('[data-testid="project-card"]').first().click()
      
      cy.createTask({
        title: 'Tarea Asignada',
        description: 'Tarea para asignar',
      })
      
      // Open task details
      cy.contains('Tarea Asignada').click()
      
      // Assign to student
      cy.get('[data-testid="assign-button"]').click()
      cy.get('[data-testid="student-select"]').select('estudiante')
      cy.get('[data-testid="confirm-assign"]').click()
      
      cy.contains('asignada exitosamente').should('be.visible')
    })
  })

  describe('Task Submission (Student)', () => {
    beforeEach(() => {
      cy.fixture('users').then((users) => {
        cy.login(users.student.username, users.student.password)
      })
    })

    it('should view assigned tasks', () => {
      cy.visit('/dashboard')
      cy.get('[data-testid="my-tasks"]').should('be.visible')
      cy.get('[data-testid="task-item"]').should('exist')
    })

    it('should submit a task solution', () => {
      cy.visit('/dashboard')
      cy.get('[data-testid="task-item"]').first().click()
      
      // Fill submission form
      cy.get('[data-testid="submit-solution"]').click()
      cy.get('textarea[name="submission_text"]').type('Esta es mi solución a la tarea')
      
      // Optionally upload file
      // cy.get('input[type="file"]').attachFile('sample-submission.pdf')
      
      cy.get('button[type="submit"]').contains('Enviar').click()
      
      cy.contains('enviada exitosamente').should('be.visible')
    })

    it('should see submission status', () => {
      cy.visit('/dashboard')
      cy.get('[data-testid="task-item"]').first().within(() => {
        // Should show submitted status
        cy.get('[data-testid="task-status"]').should('contain', 'Enviada')
      })
    })
  })

  describe('Task Grading (Professor)', () => {
    beforeEach(() => {
      cy.fixture('users').then((users) => {
        cy.login(users.professor.username, users.professor.password)
      })
    })

    it('should view student submissions', () => {
      cy.visit('/proyectos')
      cy.get('[data-testid="project-card"]').first().click()
      
      // Find a submitted task
      cy.get('[data-testid="task-item"]').contains('Enviada').click()
      
      // Should see submissions list
      cy.get('[data-testid="submissions-list"]').should('be.visible')
    })

    it('should grade a submission', () => {
      cy.visit('/proyectos')
      cy.get('[data-testid="project-card"]').first().click()
      cy.get('[data-testid="task-item"]').contains('Enviada').click()
      
      // Open first submission
      cy.get('[data-testid="submission-item"]').first().click()
      
      // Grade the submission
      cy.get('[data-testid="grade-input"]').clear().type('95')
      cy.get('textarea[name="feedback"]').type('Excelente trabajo!')
      cy.get('[data-testid="approve-submission"]').click()
      
      cy.contains('calificada exitosamente').should('be.visible')
    })

    it('should validate grade range', () => {
      cy.visit('/proyectos')
      cy.get('[data-testid="project-card"]').first().click()
      cy.get('[data-testid="task-item"]').contains('Enviada').click()
      cy.get('[data-testid="submission-item"]').first().click()
      
      // Try to enter invalid grade
      cy.get('[data-testid="grade-input"]').clear().type('150')
      cy.get('[data-testid="approve-submission"]').click()
      
      // Should show validation error
      cy.contains(/0.*100|rango/i).should('be.visible')
    })
  })

  describe('Task Notifications', () => {
    it('should notify student when task is assigned', () => {
      cy.fixture('users').then((users) => {
        cy.login(users.student.username, users.student.password)
      })
      
      cy.visit('/dashboard')
      
      // Check for notifications
      cy.get('[data-testid="notifications"]').click()
      cy.contains('asignada').should('be.visible')
    })

    it('should notify professor when task is submitted', () => {
      cy.fixture('users').then((users) => {
        cy.login(users.professor.username, users.professor.password)
      })
      
      cy.visit('/dashboard')
      
      // Check for notifications
      cy.get('[data-testid="notifications"]').click()
      cy.contains('enviada').should('be.visible')
    })
  })
})
