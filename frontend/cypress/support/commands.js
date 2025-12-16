// ***********************************************
// Custom commands for MH Soluciones E2E tests
// ***********************************************

/**
 * Login command - authenticates a user
 * @param {string} username - Username or email
 * @param {string} password - User password
 * @param {string} role - Expected user role (optional, for verification)
 */
Cypress.Commands.add('login', (username, password, role = null) => {
  cy.visit('/login')
  cy.get('input[name="username"]').type(username)
  cy.get('input[type="password"]').type(password)
  cy.get('button[type="submit"]').click()
  
  // Wait for redirect to dashboard
  cy.url().should('include', '/dashboard')
  
  // Optionally verify role
  if (role) {
    cy.window().then((win) => {
      const user = JSON.parse(win.localStorage.getItem('user') || '{}')
      expect(user.role).to.equal(role)
    })
  }
})

/**
 * Logout command
 */
Cypress.Commands.add('logout', () => {
  cy.get('[data-testid="user-menu"]').click()
  cy.get('[data-testid="logout-button"]').click()
  cy.url().should('include', '/login')
})

/**
 * Create a task via UI
 */
Cypress.Commands.add('createTask', (taskData) => {
  cy.get('[data-testid="create-task-button"]').click()
  cy.get('input[name="title"]').type(taskData.title)
  
  if (taskData.description) {
    cy.get('textarea[name="description"]').type(taskData.description)
  }
  
  if (taskData.due_date) {
    cy.get('input[name="due_date"]').type(taskData.due_date)
  }
  
  if (taskData.priority) {
    cy.get('select[name="priority"]').select(taskData.priority)
  }
  
  cy.get('button[type="submit"]').contains('Crear').click()
  
  // Wait for success message
  cy.contains('exitosamente').should('be.visible')
})

/**
 * Check responsive breakpoints
 */
Cypress.Commands.add('testResponsive', (sizes = ['mobile', 'tablet', 'desktop']) => {
  const viewports = {
    mobile: [375, 667],
    tablet: [768, 1024],
    desktop: [1280, 720],
    large: [1920, 1080]
  }
  
  sizes.forEach(size => {
    const [width, height] = viewports[size]
    cy.viewport(width, height)
    cy.wait(500) // Allow layout to settle
    cy.screenshot(`${size}-view`)
  })
})

/**
 * Intercept API calls
 */
Cypress.Commands.add('mockAPI', (endpoint, fixture) => {
  cy.intercept('GET', `**/api/${endpoint}`, { fixture })
})
