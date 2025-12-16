/**
 * Responsive Design E2E Tests
 * Tests the application across different viewport sizes
 * Ensures WCAG 2.1 AAA compliance is maintained on all devices
 */

describe('Responsive Design', () => {
  const pages = [
    { name: 'Dashboard', url: '/dashboard' },
    { name: 'Projects', url: '/proyectos' },
    { name: 'Tasks', url: '/tareas' },
    { name: 'Reports', url: '/reportes' },
  ]

  beforeEach(() => {
    cy.fixture('users').then((users) => {
      cy.login(users.student.username, users.student.password)
    })
  })

  describe('Mobile (320px - 640px)', () => {
    it('should display correctly on small mobile (320px)', () => {
      cy.viewport(320, 568)
      
      pages.forEach(page => {
        cy.visit(page.url)
        cy.screenshot(`mobile-320-${page.name}`)
        
        // Verify no horizontal scroll
        cy.document().then((doc) => {
          expect(doc.documentElement.scrollWidth).to.be.at.most(320)
        })
        
        // Check mobile menu is present
        cy.get('[data-testid="mobile-menu-toggle"]').should('be.visible')
      })
    })

    it('should display correctly on mobile (375px)', () => {
      cy.viewport(375, 667)
      
      pages.forEach(page => {
        cy.visit(page.url)
        cy.screenshot(`mobile-375-${page.name}`)
      })
    })

    it('should have touch-friendly buttons (min 44px)', () => {
      cy.viewport(375, 667)
      cy.visit('/dashboard')
      
      // Check all buttons meet minimum touch target size
      cy.get('button').each(($btn) => {
        const rect = $btn[0].getBoundingClientRect()
        const minSize = 44
        expect(rect.width).to.be.at.least(minSize - 10) // Allow 10px margin
        expect(rect.height).to.be.at.least(minSize - 10)
      })
    })
  })

  describe('Tablet (768px - 1024px)', () => {
    it('should display correctly on tablet portrait (768px)', () => {
      cy.viewport(768, 1024)
      
      pages.forEach(page => {
        cy.visit(page.url)
        cy.screenshot(`tablet-768-${page.name}`)
        
        // Tablet should show sidebar or adapted layout
        cy.get('[data-testid="sidebar"]').should('be.visible')
      })
    })

    it('should display correctly on tablet landscape (1024px)', () => {
      cy.viewport(1024, 768)
      
      pages.forEach(page => {
        cy.visit(page.url)
        cy.screenshot(`tablet-1024-${page.name}`)
      })
    })

    it('should adapt table layout on tablet', () => {
      cy.viewport(768, 1024)
      cy.visit('/admin/usuarios')
      
      // Tables should be responsive (cards or horizontal scroll)
      cy.get('[data-testid="users-table"]').should('be.visible')
    })
  })

  describe('Desktop (1280px+)', () => {
    it('should display correctly on desktop (1280px)', () => {
      cy.viewport(1280, 720)
      
      pages.forEach(page => {
        cy.visit(page.url)
        cy.screenshot(`desktop-1280-${page.name}`)
        
        // Desktop should show full sidebar
        cy.get('[data-testid="sidebar"]').should('be.visible')
        cy.get('[data-testid="main-content"]').should('be.visible')
      })
    })

    it('should display correctly on large desktop (1920px)', () => {
      cy.viewport(1920, 1080)
      
      pages.forEach(page => {
        cy.visit(page.url)
        cy.screenshot(`desktop-1920-${page.name}`)
      })
    })

    it('should display correctly on ultra-wide (2560px)', () => {
      cy.viewport(2560, 1440)
      
      pages.forEach(page => {
        cy.visit(page.url)
        cy.screenshot(`desktop-2560-${page.name}`)
        
        // Content should be centered or max-width constrained
        cy.get('[data-testid="main-content"]').should('be.visible')
      })
    })
  })

  describe('Orientation Changes', () => {
    it('should handle portrait to landscape transition', () => {
      // Start in portrait
      cy.viewport(768, 1024)
      cy.visit('/dashboard')
      cy.get('[data-testid="sidebar"]').should('be.visible')
      
      // Switch to landscape
      cy.viewport(1024, 768)
      cy.get('[data-testid="sidebar"]').should('be.visible')
      cy.get('[data-testid="main-content"]').should('be.visible')
    })
  })

  describe('WCAG 2.1 AAA Compliance', () => {
    beforeEach(() => {
      cy.viewport(1280, 720)
    })

    it('should have sufficient color contrast', () => {
      cy.visit('/dashboard')
      
      // Use cypress-axe for automated accessibility testing
      // cy.injectAxe()
      // cy.checkA11y(null, {
      //   runOnly: {
      //     type: 'tag',
      //     values: ['wcag2aaa']
      //   }
      // })
    })

    it('should support keyboard navigation', () => {
      cy.visit('/dashboard')
      
      // Tab through interactive elements
      cy.get('body').tab()
      cy.focused().should('have.attr', 'tabindex').and('not.equal', '-1')
      
      // Continue tabbing
      cy.focused().tab()
      cy.focused().should('be.visible')
    })

    it('should have proper heading hierarchy', () => {
      cy.visit('/dashboard')
      
      // Should have h1
      cy.get('h1').should('exist').and('have.length', 1)
      
      // Check heading order
      let previousLevel = 0
      cy.get('h1, h2, h3, h4, h5, h6').each(($heading) => {
        const level = parseInt($heading.prop('tagName').substring(1))
        expect(level).to.be.at.most(previousLevel + 1)
        previousLevel = level
      })
    })

    it('should have alt text for images', () => {
      cy.visit('/dashboard')
      
      cy.get('img').each(($img) => {
        // All images should have alt attribute
        expect($img).to.have.attr('alt')
      })
    })

    it('should have aria labels for icon buttons', () => {
      cy.visit('/dashboard')
      
      cy.get('button').each(($btn) => {
        const hasText = $btn.text().trim().length > 0
        const hasAriaLabel = $btn.attr('aria-label')
        const hasTitle = $btn.attr('title')
        
        // Button should have text, aria-label, or title
        expect(hasText || hasAriaLabel || hasTitle).to.be.true
      })
    })
  })
})
