# MH Soluciones - E2E Testing with Cypress

## Overview
This directory contains end-to-end tests for MH Soluciones platform using Cypress.

## Test Structure

```
cypress/
├── e2e/                    # Test files
│   ├── auth.cy.js         # Authentication tests
│   ├── permissions.cy.js  # Role-based permission tests
│   ├── tasks.cy.js        # Task management flow tests
│   └── responsive.cy.js   # Responsive design tests
├── fixtures/              # Test data
│   └── users.json        # User credentials for testing
├── support/              # Support files
│   ├── commands.js       # Custom Cypress commands
│   └── e2e.js           # Global configuration
└── cypress.config.js     # Cypress configuration

```

## Test Coverage

### 1. Authentication (`auth.cy.js`)
- Login page display
- Form validation
- Login with different user roles
- Session persistence
- Logout functionality
- Protected route access

### 2. Role-Based Permissions (`permissions.cy.js`)
- Admin permissions (user management, all projects)
- Professor permissions (task creation, grading)
- Student permissions (task submission, limited access)
- Client permissions (read-only project access)

### 3. Task Management (`tasks.cy.js`)
- Task creation (Professor)
- Task assignment
- Form validation (Zod schemas)
- Task submission (Student)
- Task grading (Professor)
- Notification system

### 4. Responsive Design (`responsive.cy.js`)
- Mobile viewports (320px, 375px)
- Tablet viewports (768px, 1024px)
- Desktop viewports (1280px, 1920px, 2560px)
- Touch target sizes (WCAG 2.1 AAA)
- Keyboard navigation
- Accessibility compliance

## Running Tests

### Prerequisites
```bash
npm install
```

### Run Tests Headless (CI/CD)
```bash
npm run test:e2e
```

### Open Cypress Test Runner (Interactive)
```bash
npm run test:e2e:open
```

### Run Specific Test File
```bash
npx cypress run --spec "cypress/e2e/auth.cy.js"
```

### Run Tests on Specific Browser
```bash
npx cypress run --browser chrome
npx cypress run --browser firefox
npx cypress run --browser edge
```

## Test Data

Test users are defined in `cypress/fixtures/users.json`:
- Admin user
- Professor user
- Student user
- Client user

**Note:** Ensure these users exist in your test database before running tests.

## Custom Commands

Located in `cypress/support/commands.js`:

- `cy.login(username, password, role)` - Login helper
- `cy.logout()` - Logout helper
- `cy.createTask(taskData)` - Create task via UI
- `cy.testResponsive(sizes)` - Test multiple viewports
- `cy.mockAPI(endpoint, fixture)` - Mock API responses

## Configuration

Cypress configuration is in `cypress.config.js`:
- Base URL: `http://localhost:5173` (Vite dev server)
- Video recording: Enabled
- Screenshots on failure: Enabled
- Default viewport: 1280x720

## CI/CD Integration

Add to your CI/CD pipeline:

```yaml
- name: Run E2E Tests
  run: |
    npm run build
    npm run preview &
    npx wait-on http://localhost:5173
    npm run test:e2e
```

## Best Practices

1. **Use data-testid attributes** for stable selectors
2. **Keep tests independent** - each test should setup/cleanup
3. **Use fixtures** for test data
4. **Mock external APIs** when appropriate
5. **Test user flows** not implementation details
6. **Follow AAA pattern** (Arrange, Act, Assert)

## Troubleshooting

### Tests fail with "Network Error"
- Ensure backend is running
- Check API endpoints are accessible
- Verify CORS configuration

### Tests timeout
- Increase timeout in cypress.config.js
- Check if application is slow to load
- Use `cy.wait()` for async operations

### Element not found
- Check selectors are correct
- Use `data-testid` attributes
- Wait for elements with `cy.get(...).should('be.visible')`

## Reports

Test results are generated in:
- `cypress/videos/` - Video recordings
- `cypress/screenshots/` - Failure screenshots
- Console output - Test summary

## Future Enhancements

- [ ] Add Cypress Dashboard integration
- [ ] Add visual regression testing
- [ ] Add performance testing
- [ ] Add API testing
- [ ] Add component testing
- [ ] Add accessibility testing with cypress-axe
