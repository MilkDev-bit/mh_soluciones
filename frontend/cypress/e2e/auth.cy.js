/**
 * Authentication E2E Tests
 * Tests login, logout, and session management
 */

describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.visit('/login')
  })

  it('should display login page correctly', () => {
    cy.get('h1').should('contain', 'Iniciar Sesión')
    cy.get('input[name="username"]').should('be.visible')
    cy.get('input[type="password"]').should('be.visible')
    cy.get('button[type="submit"]').should('be.visible')
  })

  it('should show validation errors for empty fields', () => {
    cy.get('button[type="submit"]').click()
    cy.contains('obligatorio').should('be.visible')
  })

  it('should show error for invalid credentials', () => {
    cy.get('input[name="username"]').type('wronguser')
    cy.get('input[type="password"]').type('wrongpass')
    cy.get('button[type="submit"]').click()
    
    cy.contains(/credenciales|inválid/i).should('be.visible')
  })

  it('should successfully login as admin', () => {
    cy.fixture('users').then((users) => {
      cy.login(users.admin.username, users.admin.password, users.admin.role)
      
      // Verify redirect to dashboard
      cy.url().should('include', '/dashboard')
      
      // Verify user is logged in
      cy.contains('Bienvenido').should('be.visible')
    })
  })

  it('should successfully login as professor', () => {
    cy.fixture('users').then((users) => {
      cy.login(users.professor.username, users.professor.password, users.professor.role)
      cy.url().should('include', '/dashboard')
    })
  })

  it('should successfully login as student', () => {
    cy.fixture('users').then((users) => {
      cy.login(users.student.username, users.student.password, users.student.role)
      cy.url().should('include', '/dashboard')
    })
  })

  it('should persist session after page reload', () => {
    cy.fixture('users').then((users) => {
      cy.login(users.student.username, users.student.password)
      cy.reload()
      cy.url().should('include', '/dashboard')
      cy.contains('Bienvenido').should('be.visible')
    })
  })

  it('should successfully logout', () => {
    cy.fixture('users').then((users) => {
      cy.login(users.student.username, users.student.password)
      cy.logout()
      
      // Verify redirect to login
      cy.url().should('include', '/login')
      
      // Verify token is removed
      cy.window().then((win) => {
        expect(win.localStorage.getItem('access_token')).to.be.null
      })
    })
  })

  it('should redirect to login when accessing protected route without auth', () => {
    cy.visit('/dashboard')
    cy.url().should('include', '/login')
  })
})
