# Testing Strategy & Quality Assurance

## Testing Architecture

### 1. Testing Pyramid
```
    /\
   /  \
  / E2E \     (10% - Critical user flows)
 /________\
/          \
| Integration| (30% - API endpoints, services)
|____________|
|   Unit     | (60% - Components, utilities)
|____________|
```

### 2. Testing Tools & Frameworks

**Frontend Testing:**
- **Jest** - Unit testing framework
- **React Testing Library** - Component testing
- **Cypress** - End-to-end testing
- **@testing-library/user-event** - User interaction simulation

**Backend Testing:**
- **Jest** - API and service testing
- **Supertest** - HTTP endpoint testing
- **Sinon** - Mocking and stubbing
- **NYC** - Code coverage reporting

**Database Testing:**
- **Testcontainers** - PostgreSQL test instances
- **Drizzle Kit** - Schema validation

**Performance Testing:**
- **Apache Bench** - Load testing
- **Artillery.io** - Advanced load testing
- **Lighthouse CI** - Performance auditing

## Unit Testing

### 1. Component Unit Tests

**Login Component Test Example:**
```typescript
// client/src/components/auth/__tests__/LoginForm.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginForm from '../LoginForm';

describe('LoginForm Component', () => {
  it('renders login form with all fields', () => {
    render(<LoginForm />);
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('validates email format', async () => {
    render(<LoginForm />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /login/i });
    
    await userEvent.type(emailInput, 'invalid-email');
    await userEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument();
    });
  });

  it('handles successful login', async () => {
    const mockLogin = jest.fn().mockResolvedValue({ success: true });
    render(<LoginForm onLogin={mockLogin} />);
    
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /login/i }));
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'password123'
      });
    });
  });
});
```

### 2. Utility Function Tests

**Validation Utilities:**
```typescript
// shared/utils/__tests__/validation.test.ts
import { validateEmail, validatePhone, validateZipCode } from '../validation';

describe('Validation Utilities', () => {
  describe('validateEmail', () => {
    it('accepts valid email addresses', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('test.user+tag@domain.co.uk')).toBe(true);
    });

    it('rejects invalid email addresses', () => {
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('@domain.com')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
    });
  });

  describe('validatePhone', () => {
    it('accepts valid phone numbers', () => {
      expect(validatePhone('555-123-4567')).toBe(true);
      expect(validatePhone('(555) 123-4567')).toBe(true);
      expect(validatePhone('+1 555 123 4567')).toBe(true);
    });

    it('rejects invalid phone numbers', () => {
      expect(validatePhone('123')).toBe(false);
      expect(validatePhone('abc-def-ghij')).toBe(false);
    });
  });
});
```

### 3. API Service Tests

**Authentication Service:**
```typescript
// server/services/__tests__/auth.service.test.ts
import { authService } from '../auth.service';
import { db } from '../../db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

jest.mock('../../db');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  describe('login', () => {
    it('returns token for valid credentials', async () => {
      const mockUser = {
        id: 1,
        email: 'user@example.com',
        password: 'hashedPassword'
      };
      
      (db.select as jest.Mock).mockResolvedValue([mockUser]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('mock-jwt-token');
      
      const result = await authService.login('user@example.com', 'password123');
      
      expect(result).toEqual({
        success: true,
        token: 'mock-jwt-token',
        user: expect.objectContaining({
          id: 1,
          email: 'user@example.com'
        })
      });
    });

    it('returns error for invalid credentials', async () => {
      (db.select as jest.Mock).mockResolvedValue([]);
      
      const result = await authService.login('nonexistent@example.com', 'password123');
      
      expect(result).toEqual({
        success: false,
        error: 'Invalid credentials'
      });
    });
  });
});
```

## Integration Testing

### 1. API Endpoint Testing

**Leads API Integration Test:**
```typescript
// server/routes/__tests__/leads.integration.test.ts
import request from 'supertest';
import { app } from '../../app';
import { db } from '../../db';
import { authenticateUser } from '../../test-utils';

describe('Leads API Integration', () => {
  let authToken: string;
  
  beforeEach(async () => {
    authToken = await authenticateUser('test@example.com', 'caller');
  });

  it('creates a new lead successfully', async () => {
    const leadData = {
      propertyAddress: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zip: '12345',
      ownerName: 'John Owner',
      ownerPhone: '555-123-4567',
      status: 'new'
    };

    const response = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${authToken}`)
      .send(leadData)
      .expect(201);

    expect(response.body).toMatchObject({
      success: true,
      data: expect.objectContaining(leadData)
    });

    // Verify lead was created in database
    const [lead] = await db.select().from(leads).where(eq(leads.id, response.body.data.id));
    expect(lead).toBeDefined();
    expect(lead.propertyAddress).toBe(leadData.propertyAddress);
  });

  it('validates required fields', async () => {
    const invalidData = {
      propertyAddress: '',
      city: '',
      state: '',
      zip: ''
    };

    const response = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${authToken}`)
      .send(invalidData)
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ field: 'propertyAddress' }),
        expect.objectContaining({ field: 'city' })
      ])
    });
  });

  it('filters leads by status', async () => {
    // Create test leads with different statuses
    await createTestLeads([
      { status: 'new', propertyAddress: '123 New St' },
      { status: 'contacted', propertyAddress: '456 Contacted St' },
      { status: 'new', propertyAddress: '789 Another New St' }
    ]);

    const response = await request(app)
      .get('/api/leads?status=new')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.data).toHaveLength(2);
    expect(response.body.data.every((lead: any) => lead.status === 'new')).toBe(true);
  });
});
```

### 2. Database Integration Tests

**Lead Repository Tests:**
```typescript
// server/repositories/__tests__/lead.repository.test.ts
import { LeadRepository } from '../lead.repository';
import { db } from '../../db';
import { leads } from '../../../shared/schema';

describe('LeadRepository', () => {
  let leadRepository: LeadRepository;
  
  beforeEach(() => {
    leadRepository = new LeadRepository();
  });

  afterEach(async () => {
    await db.delete(leads);
  });

  describe('create', () => {
    it('creates lead with generated leadId', async () => {
      const leadData = {
        propertyAddress: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zip: '12345',
        ownerName: 'Test Owner'
      };

      const lead = await leadRepository.create(leadData);

      expect(lead).toMatchObject({
        id: expect.any(Number),
        leadId: expect.stringMatching(/^LD-\d{4}-\d{4}$/),
        propertyAddress: leadData.propertyAddress,
        createdAt: expect.any(Date)
      });
    });
  });

  describe('findWithFilters', () => {
    it('applies multiple filters correctly', async () => {
      // Create test data
      await leadRepository.create([
        { status: 'new', assignedToUserId: 1, city: 'Anytown' },
        { status: 'contacted', assignedToUserId: 1, city: 'Anytown' },
        { status: 'new', assignedToUserId: 2, city: 'Othertown' }
      ]);

      const results = await leadRepository.findWithFilters({
        status: 'new',
        assignedToUserId: 1,
        city: 'Anytown'
      });

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('new');
      expect(results[0].assignedToUserId).toBe(1);
      expect(results[0].city).toBe('Anytown');
    });
  });
});
```

## End-to-End Testing

### 1. Critical User Flows

**Complete Lead Management Flow:**
```typescript
// cypress/e2e/lead-management.cy.ts
describe('Lead Management Flow', () => {
  beforeEach(() => {
    cy.task('db:seed'); // Reset database
    cy.login('caller@example.com', 'password123');
  });

  it('creates, edits, and manages a lead through complete lifecycle', () => {
    // Navigate to leads page
    cy.visit('/leads');
    cy.contains('Leads Management').should('be.visible');

    // Create new lead
    cy.get('[data-testid="create-lead-button"]').click();
    cy.url().should('include', '/leads/new');

    // Fill lead form
    cy.get('[data-testid="property-address"]').type('123 Test Street');
    cy.get('[data-testid="city"]').type('Test City');
    cy.get('[data-testid="state"]').select('CA');
    cy.get('[data-testid="zip"]').type('90210');
    cy.get('[data-testid="owner-name"]').type('John Test Owner');
    cy.get('[data-testid="owner-phone"]').type('555-123-4567');
    cy.get('[data-testid="status"]').select('new');
    cy.get('[data-testid="motivation-level"]').select('high');

    // Submit form
    cy.get('[data-testid="submit-lead-form"]').click();

    // Verify lead was created
    cy.url().should('include', '/leads');
    cy.contains('Lead created successfully').should('be.visible');
    cy.contains('123 Test Street').should('be.visible');

    // View lead details
    cy.get('[data-testid="lead-row"]').first().click();
    cy.url().should('include', '/leads/');
    cy.contains('John Test Owner').should('be.visible');

    // Update lead status
    cy.get('[data-testid="status-dropdown"]').click();
    cy.get('[data-testid="status-contacted"]').click();
    cy.get('[data-testid="save-lead"]').click();

    // Verify status update
    cy.contains('Lead updated successfully').should('be.visible');
    cy.get('[data-testid="current-status"]').should('contain', 'Contacted');

    // Add interaction note
    cy.get('[data-testid="add-note-button"]').click();
    cy.get('[data-testid="note-textarea"]').type('Called owner, interested in selling');
    cy.get('[data-testid="save-note"]').click();

    // Schedule follow-up
    cy.get('[data-testid="schedule-followup"]').click();
    cy.get('[data-testid="followup-date"]').type('2025-02-01');
    cy.get('[data-testid="followup-time"]').type('14:00');
    cy.get('[data-testid="schedule-button"]').click();

    // Return to leads list
    cy.get('[data-testid="back-to-leads"]').click();
    cy.url().should('include', '/leads');

    // Filter by status
    cy.get('[data-testid="status-filter"]').select('contacted');
    cy.get('[data-testid="apply-filters"]').click();

    // Verify lead appears in filtered results
    cy.contains('123 Test Street').should('be.visible');
    cy.get('[data-testid="lead-count"]').should('contain', '1 lead');
  });

  it('handles lead assignment and team collaboration', () => {
    // Login as admin
    cy.login('admin@example.com', 'password123');
    
    // Create lead as admin
    cy.visit('/leads/new');
    cy.get('[data-testid="property-address"]').type('456 Admin Street');
    // ... fill other fields
    cy.get('[data-testid="submit-lead-form"]').click();

    // Assign to team member
    cy.get('[data-testid="lead-row"]').first().click();
    cy.get('[data-testid="assigned-to-dropdown"]').select('caller@example.com');
    cy.get('[data-testid="save-lead"]').click();

    // Logout and login as caller
    cy.logout();
    cy.login('caller@example.com', 'password123');

    // Verify lead appears in assigned leads
    cy.visit('/leads');
    cy.get('[data-testid="my-leads-filter"]').click();
    cy.contains('456 Admin Street').should('be.visible');
  });
});
```

### 2. Authentication Flow Tests

**Login and Password Recovery:**
```typescript
// cypress/e2e/authentication.cy.ts
describe('Authentication Flow', () => {
  it('logs in user with valid credentials', () => {
    cy.visit('/login');
    cy.get('[data-testid="email-input"]').type('user@example.com');
    cy.get('[data-testid="password-input"]').type('password123');
    cy.get('[data-testid="login-button"]').click();

    cy.url().should('include', '/dashboard');
    cy.contains('Welcome').should('be.visible');
    cy.getCookie('auth-token').should('exist');
  });

  it('shows error for invalid credentials', () => {
    cy.visit('/login');
    cy.get('[data-testid="email-input"]').type('invalid@example.com');
    cy.get('[data-testid="password-input"]').type('wrongpassword');
    cy.get('[data-testid="login-button"]').click();

    cy.contains('Invalid email or password').should('be.visible');
    cy.url().should('include', '/login');
  });

  it('recovers password via email', () => {
    cy.visit('/login');
    cy.get('[data-testid="forgot-password"]').click();
    cy.url().should('include', '/password-recovery');

    cy.get('[data-testid="recovery-email"]').type('user@example.com');
    cy.get('[data-testid="send-recovery-email"]').click();

    cy.contains('Password reset email sent').should('be.visible');
    
    // Simulate clicking email link
    cy.task('getPasswordResetToken', 'user@example.com').then((token) => {
      cy.visit(`/reset-password/${token}`);
      cy.get('[data-testid="new-password"]').type('newpassword123');
      cy.get('[data-testid="confirm-password"]').type('newpassword123');
      cy.get('[data-testid="reset-password-button"]').click();

      cy.contains('Password reset successful').should('be.visible');
      cy.url().should('include', '/login');
    });
  });

  it('logs out user and clears session', () => {
    cy.login('user@example.com', 'password123');
    cy.visit('/dashboard');
    
    cy.get('[data-testid="user-menu"]').click();
    cy.get('[data-testid="logout-button"]').click();

    cy.url().should('include', '/login');
    cy.getCookie('auth-token').should('not.exist');
    
    // Verify protected route is inaccessible
    cy.visit('/dashboard');
    cy.url().should('include', '/login');
  });
});
```

## Performance Testing

### 1. Load Testing Scenarios

**API Load Testing:**
```typescript
// performance/api-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],   // Error rate under 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Test authentication endpoint
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, {
    email: 'test@example.com',
    password: 'password123',
  });

  check(loginRes, {
    'login successful': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  const authToken = loginRes.json('token');

  // Test leads endpoint
  const leadsRes = http.get(`${BASE_URL}/api/leads`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  check(leadsRes, {
    'leads fetched successfully': (r) => r.status === 200,
    'response contains data': (r) => r.json('data').length > 0,
  });

  sleep(1);
}
```

### 2. Frontend Performance Testing

**Component Rendering Performance:**
```typescript
// client/src/components/__tests__/performance/LeadsTable.perf.test.tsx
import { render } from '@testing-library/react';
import { measurePerformance } from '../../test-utils/performance';
import LeadsTable from '../../leads/LeadsTable';

describe('LeadsTable Performance', () => {
  const generateLeads = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      leadId: `LD-2025-${String(i + 1).padStart(4, '0')}`,
      propertyAddress: `${i + 1} Test Street`,
      city: 'Test City',
      state: 'CA',
      zip: '90210',
      ownerName: `Owner ${i + 1}`,
      status: 'new',
      motivationLevel: 'high',
      createdAt: new Date(),
    }));
  };

  it('renders 100 leads within performance budget', async () => {
    const leads = generateLeads(100);
    
    const { duration } = await measurePerformance(() => {
      render(<LeadsTable leads={leads} />);
    });

    expect(duration).toBeLessThan(100); // 100ms budget
  });

  it('renders 1000 leads with virtual scrolling', async () => {
    const leads = generateLeads(1000);
    
    const { duration } = await measurePerformance(() => {
      render(<LeadsTable leads={leads} enableVirtualization />);
    });

    expect(duration).toBeLessThan(200); // 200ms budget with virtualization
  });
});
```

## Accessibility Testing

### 1. WCAG 2.1 Compliance Tests

**Form Accessibility:**
```typescript
// client/src/components/__tests__/accessibility/LoginForm.a11y.test.tsx
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import LoginForm from '../LoginForm';

expect.extend(toHaveNoViolations);

describe('LoginForm Accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<LoginForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('provides proper labels for form inputs', () => {
    const { getByLabelText } = render(<LoginForm />);
    
    expect(getByLabelText(/email address/i)).toBeInTheDocument();
    expect(getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('supports keyboard navigation', () => {
    const { getByLabelText } = render(<LoginForm />);
    
    const emailInput = getByLabelText(/email address/i);
    const passwordInput = getByLabelText(/password/i);
    
    // Tab order testing
    emailInput.focus();
    expect(document.activeElement).toBe(emailInput);
    
    userEvent.tab();
    expect(document.activeElement).toBe(passwordInput);
  });

  it('provides error messages for screen readers', async () => {
    const { getByLabelText, getByRole, findByRole } = render(<LoginForm />);
    
    const emailInput = getByLabelText(/email address/i);
    const submitButton = getByRole('button', { name: /login/i });
    
    // Submit empty form
    userEvent.click(submitButton);
    
    const errorMessage = await findByRole('alert');
    expect(errorMessage).toHaveTextContent(/email is required/i);
    expect(errorMessage).toHaveAttribute('aria-live', 'polite');
  });
});
```

### 2. Screen Reader Testing

**Navigation Accessibility:**
```typescript
// cypress/e2e/accessibility.cy.ts
describe('Screen Reader Accessibility', () => {
  it('announces page changes to screen readers', () => {
    cy.visit('/login');
    
    // Check for skip links
    cy.get('a[href="#main-content"]').should('exist');
    
    // Login and check page announcement
    cy.login('user@example.com', 'password123');
    
    // Check for proper heading structure
    cy.get('h1').should('exist');
    cy.get('main').should('have.attr', 'role', 'main');
    
    // Check for live regions
    cy.get('[aria-live="polite"]').should('exist');
  });

  it('provides proper ARIA labels for interactive elements', () => {
    cy.login('user@example.com', 'password123');
    cy.visit('/leads');
    
    // Check data table accessibility
    cy.get('table').should('have.attr', 'role', 'table');
    cy.get('thead').should('exist');
    cy.get('th').each(($th) => {
      cy.wrap($th).should('have.attr', 'scope', 'col');
    });
    
    // Check button labels
    cy.get('button').each(($button) => {
      cy.wrap($button).should('have.attr', 'aria-label');
    });
  });
});
```

## Security Testing

### 1. Security Vulnerability Tests

**XSS Protection:**
```typescript
// server/routes/__tests__/security/xss.test.ts
import request from 'supertest';
import { app } from '../../app';

describe('XSS Protection', () => {
  it('sanitizes user input in lead creation', async () => {
    const maliciousPayload = {
      propertyAddress: '<script>alert("xss")</script>',
      city: 'Safe City',
      state: 'CA',
      zip: '12345',
      ownerName: '<img src="x" onerror="alert(\'xss\')">',
      notes: '<iframe src="javascript:alert(\'xss\')"></iframe>'
    };

    const response = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${validToken}`)
      .send(maliciousPayload)
      .expect(201);

    // Verify malicious content is escaped
    expect(response.body.data.propertyAddress).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(response.body.data.ownerName).not.toContain('<img');
    expect(response.body.data.notes).not.toContain('<iframe');
  });

  it('sets proper security headers', async () => {
    const response = await request(app)
      .get('/api/leads')
      .set('Authorization', `Bearer ${validToken}`);

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['x-xss-protection']).toBe('1; mode=block');
  });
});
```

**SQL Injection Prevention:**
```typescript
// server/routes/__tests__/security/sql-injection.test.ts
describe('SQL Injection Prevention', () => {
  it('prevents SQL injection in search queries', async () => {
    const sqlInjectionPayload = {
      search: "'; DROP TABLE leads; --"
    };

    const response = await request(app)
      .get('/api/leads')
      .query(sqlInjectionPayload)
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200);

    // Should return empty results, not crash
    expect(response.body.data).toEqual([]);
    
    // Verify table still exists
    const verifyResponse = await request(app)
      .get('/api/leads')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200);
      
    expect(verify.body.data).toBeDefined();
  });

  it('parameterizes all database queries', async () => {
    // This test verifies that the repository uses parameterized queries
    const leadRepository = new LeadRepository();
    
    const maliciousId = '1 OR 1=1';
    
    // Should not return all leads due to SQL injection
    const result = await leadRepository.findById(maliciousId);
    expect(result).toBeNull();
  });
});
```

## Test Automation & CI/CD

### 1. GitHub Actions Configuration

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '22'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run type checking
      run: npm run check
    
    - name: Run unit tests
      run: npm run test:unit
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
        REDIS_URL: redis://localhost:6379
        JWT_SECRET: test-secret
    
    - name: Run integration tests
      run: npm run test:integration
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
        REDIS_URL: redis://localhost:6379
        JWT_SECRET: test-secret
    
    - name: Run E2E tests
      run: npm run test:e2e
    
    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
        flags: unittests
        name: codecov-umbrella
```

### 2. Test Coverage Requirements

**Coverage Thresholds:**
```json
// jest.config.js
{
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    },
    "./src/components/": {
      "branches": 85,
      "functions": 85,
      "lines": 85,
      "statements": 85
    },
    "./server/routes/": {
      "branches": 90,
      "functions": 90,
      "lines": 90,
      "statements": 90
    }
  }
}
```

## Test Data Management

### 1. Test Data Factories

```typescript
// shared/test-utils/factories/lead.factory.ts
import { faker } from '@faker-js/faker';
import { InsertLead } from '../../schema';

export const createLeadFactory = (): InsertLead => ({
  propertyAddress: faker.address.streetAddress(),
  city: faker.address.city(),
  state: faker.address.stateAbbr(),
  zip: faker.address.zipCode(),
  ownerName: faker.name.fullName(),
  ownerPhone: faker.phone.number('###-###-####'),
  ownerEmail: faker.internet.email(),
  status: faker.helpers.arrayElement(['new', 'contacted', 'follow-up', 'negotiation']),
  motivationLevel: faker.helpers.arrayElement(['low', 'medium', 'high']),
  propertyType: faker.helpers.arrayElement(['single-family', 'multi-family', 'condo']),
  source: faker.helpers.arrayElement(['cold-call', 'direct-mail', 'referral', 'online']),
  notes: faker.lorem.sentence(),
  arv: faker.datatype.number({ min: 100000, max: 1000000 }),
  repairCost: faker.datatype.number({ min: 5000, max: 100000 }),
  estimatedValue: faker.datatype.number({ min: 50000, max: 800000 }),
  assignedToUserId: faker.datatype.number({ min: 1, max: 10 }),
  latitude: faker.address.latitude(),
  longitude: faker.address.longitude(),
});

export const createManyLeads = (count: number): InsertLead[] => {
  return Array.from({ length: count }, createLeadFactory);
};
```

### 2. Database Seeding for Tests

```typescript
// shared/test-utils/database/seed.ts
import { db } from '../../../server/db';
import { users, leads, calls } from '../../schema';
import { createUserFactory, createLeadFactory, createCallFactory } from '../factories';

export const seedTestDatabase = async () => {
  // Clear existing data
  await db.delete(calls);
  await db.delete(leads);
  await db.delete(users);

  // Create test users
  const testUsers = await db.insert(users).values([
    createUserFactory({ email: 'admin@example.com', role: 'admin' }),
    createUserFactory({ email: 'caller@example.com', role: 'caller' }),
    createUserFactory({ email: 'acquisitions@example.com', role: 'acquisitions' }),
  ]).returning();

  // Create test leads
  const testLeads = await db.insert(leads).values([
    ...createManyLeads(50).map((lead, index) => ({
      ...lead,
      assignedToUserId: testUsers[index % testUsers.length].id,
    })),
  ]).returning();

  // Create test calls
  await db.insert(calls).values(
    testLeads.flatMap(lead => 
      Array.from({ length: Math.floor(Math.random() * 5) }, () =>
        createCallFactory({
          leadId: lead.id,
          userId: lead.assignedToUserId!,
        })
      )
    )
  );

  return { users: testUsers, leads: testLeads };
};
```

This comprehensive testing strategy ensures:

1. **High Test Coverage** - 80%+ across all components
2. **Multiple Testing Levels** - Unit, integration, and E2E tests
3. **Performance Validation** - Load testing and optimization verification
4. **Security Assurance** - Vulnerability testing and protection validation
5. **Accessibility Compliance** - WCAG 2.1 AA standard adherence
6. **Automated Quality Gates** - CI/CD integration with coverage requirements
7. **Realistic Test Data** - Factory-based data generation for consistent testing

The testing suite