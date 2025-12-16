/**
 * Role-Based Permissions E2E Tests
 * Tests that different user roles see appropriate UI elements
 * and have correct access permissions
 */

describe('Role-Based Permissions', () => {
  describe('Admin Role Permissions', () => {
    beforeEach(() => {
      cy.fixture('users').then((users) => {
        cy.login(users.admin.username, users.admin.password)
      })
    })

    it('should see admin-only navigation items', () => {
      // Admins should see user management
      cy.get('[data-testid="sidebar"]').within(() => {
        cy.contains('Usuarios').should('be.visible')
        cy.contains('Administración').should('be.visible')
      })
    })

    it('should be able to access user management page', () => {
      cy.visit('/admin/usuarios')
      cy.url().should('include', '/admin/usuarios')
      cy.contains('Gestión de Usuarios').should('be.visible')
    })

    it('should be able to create new users', () => {
      cy.visit('/admin/usuarios')
      cy.get('[data-testid="create-user-button"]').should('be.visible').click()
      cy.get('input[name="username"]').should('be.visible')
    })

    it('should see all projects in the system', () => {
      cy.visit('/proyectos')
      cy.get('[data-testid="project-list"]').should('be.visible')
      // Admin should see multiple projects
      cy.get('[data-testid="project-card"]').should('have.length.greaterThan', 0)
    })
  })

  describe('Professor Role Permissions', () => {
    beforeEach(() => {
      cy.fixture('users').then((users) => {
        cy.login(users.professor.username, users.professor.password)
      })
    })

    it('should NOT see admin-only navigation items', () => {
      cy.get('[data-testid="sidebar"]').within(() => {
        cy.contains('Administración').should('not.exist')
      })
    })

    it('should NOT access user management page', () => {
      cy.visit('/admin/usuarios')
      // Should be redirected or see error
      cy.url().should('not.include', '/admin/usuarios')
    })

    it('should see task grading interface', () => {
      cy.visit('/proyectos')
      // Professor should see grading options
      cy.contains('Calificar').should('exist')
    })

    it('should be able to create tasks in their projects', () => {
      cy.visit('/proyectos')
      cy.get('[data-testid="project-card"]').first().click()
      cy.get('[data-testid="create-task-button"]').should('be.visible')
    })
  })

  describe('Student Role Permissions', () => {
    beforeEach(() => {
      cy.fixture('users').then((users) => {
        cy.login(users.student.username, users.student.password)
      })
    })

    it('should only see student-relevant menu items', () => {
      cy.get('[data-testid="sidebar"]').within(() => {
        cy.contains('Mis Tareas').should('be.visible')
        cy.contains('Proyectos').should('be.visible')
        cy.contains('Administración').should('not.exist')
      })
    })

    it('should NOT be able to create tasks', () => {
      cy.visit('/proyectos')
      cy.get('[data-testid="project-card"]').first().click()
      cy.get('[data-testid="create-task-button"]').should('not.exist')
    })

    it('should only see assigned tasks', () => {
      cy.visit('/dashboard')
      cy.get('[data-testid="my-tasks"]').should('be.visible')
      cy.get('[data-testid="task-item"]').should('have.length.greaterThan', 0)
    })

    it('should be able to submit task solutions', () => {
      cy.visit('/dashboard')
      cy.get('[data-testid="task-item"]').first().click()
      cy.get('[data-testid="submit-solution"]').should('be.visible')
    })
  })

  describe('Client Role Permissions', () => {
    beforeEach(() => {
      cy.fixture('users').then((users) => {
        cy.login(users.client.username, users.client.password)
      })
    })

    it('should only see their own projects', () => {
      cy.visit('/proyectos')
      cy.get('[data-testid="project-list"]').should('be.visible')
      // Client should see limited project list
      cy.get('[data-testid="project-card"]').each(($el) => {
        cy.wrap($el).should('contain', 'Cliente')
      })
    })

    it('should have read-only access to projects', () => {
      cy.visit('/proyectos')
      cy.get('[data-testid="project-card"]').first().click()
      // Should not see edit or create buttons
      cy.get('[data-testid="edit-project"]').should('not.exist')
      cy.get('[data-testid="create-task-button"]').should('not.exist')
    })
  })
})
