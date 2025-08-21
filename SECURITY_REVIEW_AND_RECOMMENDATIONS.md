# Security Review and Recommendations
## LandD Air Monitoring Application

**Date:** December 2024  
**Scope:** Frontend and Backend Security Analysis  
**Current Status:** Basic security implemented with room for improvement

---

## Executive Summary

The application currently implements a solid foundation of security measures including JWT authentication, role-based access control (RBAC), and proper middleware protection. However, several areas require attention to enhance security posture and protect against common attack vectors.

**Overall Security Rating: 7/10**  
**Priority Level: Medium-High**

---

## Current Security Implementation Analysis

### ✅ Strengths

1. **JWT Authentication System**
   - Proper token-based authentication
   - Token blacklisting for logout/security
   - Automatic token refresh mechanism
   - Secure token storage in localStorage

2. **Role-Based Access Control (RBAC)**
   - Well-defined permission system
   - Granular permissions for different operations
   - Role-based middleware protection
   - Proper permission checking on routes

3. **Backend Security Middleware**
   - Authentication middleware on protected routes
   - Permission checking middleware
   - Token blacklist validation
   - CORS configuration with allowed origins

4. **Input Validation**
   - Server-side validation for critical operations
   - Proper error handling without information leakage

### ⚠️ Areas of Concern

1. **Client-Side Code Exposure**
   - Full source code visible in browser dev tools
   - API endpoints and business logic exposed
   - Authentication flow visible to users

2. **Token Security**
   - JWT tokens stored in localStorage (vulnerable to XSS)
   - No token rotation mechanism
   - Token expiration handling could be improved

3. **Rate Limiting**
   - No rate limiting on authentication endpoints
   - Potential for brute force attacks
   - No protection against automated attacks

4. **Session Management**
   - Limited session timeout controls
   - No concurrent session management
   - Missing security headers

---

## Specific Security Recommendations

### 1. **Token Security Improvements** (High Priority)

#### Current Issue:
```javascript
// frontend/src/services/api.js - Line 25
const token = localStorage.getItem("token");
```

#### Recommended Changes:

**A. Implement Secure Token Storage**
```javascript
// frontend/src/services/api.js
// Replace localStorage with httpOnly cookies or sessionStorage
const getSecureToken = () => {
  // Use sessionStorage for better security
  return sessionStorage.getItem("token") || localStorage.getItem("token");
};

// Add token rotation
const rotateToken = async (oldToken) => {
  try {
    const response = await api.post('/auth/rotate-token', { oldToken });
    const newToken = response.data.token;
    sessionStorage.setItem("token", newToken);
    return newToken;
  } catch (error) {
    // Handle token rotation failure
    throw error;
  }
};
```

**B. Backend Token Rotation Endpoint**
```javascript
// backend/routes/auth.js
router.post('/rotate-token', auth, async (req, res) => {
  try {
    const { oldToken } = req.body;
    
    // Verify old token
    const decoded = jwt.verify(oldToken, process.env.JWT_SECRET);
    
    // Blacklist old token
    await TokenBlacklist.blacklistToken(oldToken);
    
    // Generate new token
    const user = await User.findById(decoded.id);
    const newToken = user.generateAuthToken();
    
    res.json({ token: newToken });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});
```

### 2. **Rate Limiting Implementation** (High Priority)

#### Current Issue:
No rate limiting on authentication endpoints

#### Recommended Changes:

**A. Install Rate Limiting Package**
```bash
npm install express-rate-limit
```

**B. Implement Rate Limiting Middleware**
```javascript
// backend/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authRateLimit, generalRateLimit };
```

**C. Apply to Server**
```javascript
// backend/server.js
const { authRateLimit, generalRateLimit } = require('./middleware/rateLimiter');

// Apply general rate limiting
app.use(generalRateLimit);

// Apply stricter rate limiting to auth routes
app.use('/api/auth', authRateLimit);
```

### 3. **Security Headers Implementation** (Medium Priority)

#### Current Issue:
Missing security headers that protect against common attacks

#### Recommended Changes:

**A. Install Helmet Package**
```bash
npm install helmet
```

**B. Implement Security Headers**
```javascript
// backend/server.js
const helmet = require('helmet');

// Apply security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
```

### 4. **Session Management Improvements** (Medium Priority)

#### Current Issue:
Limited session timeout and no concurrent session control

#### Recommended Changes:

**A. Enhanced User Model**
```javascript
// backend/models/User.js
const userSchema = new mongoose.Schema({
  // ... existing fields ...
  lastActivity: {
    type: Date,
    default: Date.now
  },
  activeSessions: [{
    token: String,
    deviceInfo: String,
    lastActivity: Date,
    ipAddress: String
  }],
  maxConcurrentSessions: {
    type: Number,
    default: 3
  }
});

// Add method to track session activity
userSchema.methods.updateActivity = function() {
  this.lastActivity = new Date();
  return this.save();
};

// Add method to check session limits
userSchema.methods.canCreateNewSession = function() {
  const activeSessions = this.activeSessions.filter(
    session => new Date() - session.lastActivity < 24 * 60 * 60 * 1000 // 24 hours
  );
  return activeSessions.length < this.maxConcurrentSessions;
};
```

**B. Session Management Middleware**
```javascript
// backend/middleware/sessionManager.js
const sessionManager = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) return next();
    
    // Update last activity
    await user.updateActivity();
    
    // Check session timeout (8 hours of inactivity)
    const sessionTimeout = 8 * 60 * 60 * 1000; // 8 hours
    if (new Date() - user.lastActivity > sessionTimeout) {
      // Force logout
      await TokenBlacklist.blacklistToken(req.token);
      return res.status(401).json({ 
        message: 'Session expired due to inactivity',
        code: 'SESSION_TIMEOUT'
      });
    }
    
    next();
  } catch (error) {
    next();
  }
};
```

### 5. **Input Validation and Sanitization** (Medium Priority)

#### Current Issue:
Limited input validation on some endpoints

#### Recommended Changes:

**A. Install Validation Package**
```bash
npm install joi
```

**B. Create Validation Schemas**
```javascript
// backend/validators/authValidators.js
const Joi = require('joi');

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

const registerSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).required(),
  lastName: Joi.string().trim().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(128).required(),
  role: Joi.string().valid('admin', 'manager', 'employee').default('employee')
});

module.exports = { loginSchema, registerSchema };
```

**C. Apply Validation Middleware**
```javascript
// backend/middleware/validation.js
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        message: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }
    next();
  };
};

// backend/routes/auth.js
const { loginSchema, registerSchema } = require('../validators/authValidators');
const validate = require('../middleware/validation');

router.post('/login', validate(loginSchema), async (req, res) => {
  // ... existing login logic
});

router.post('/register', validate(registerSchema), async (req, res) => {
  // ... existing register logic
});
```

### 6. **Audit Logging Implementation** (Low Priority)

#### Current Issue:
Limited audit trail for security events

#### Recommended Changes:

**A. Create Audit Log Model**
```javascript
// backend/models/AuditLog.js
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true
  },
  resource: {
    type: String,
    required: true
  },
  resourceId: mongoose.Schema.Types.ObjectId,
  ipAddress: String,
  userAgent: String,
  timestamp: {
    type: Date,
    default: Date.now
  },
  details: mongoose.Schema.Types.Mixed
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
```

**B. Audit Logging Middleware**
```javascript
// backend/middleware/auditLogger.js
const AuditLog = require('../models/AuditLog');

const auditLog = (action, resource) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log after response is sent
      if (req.user) {
        AuditLog.create({
          userId: req.user._id,
          action,
          resource,
          resourceId: req.params.id || req.body.id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          details: {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode
          }
        }).catch(err => console.error('Audit logging failed:', err));
      }
      
      originalSend.call(this, data);
    };
    
    next();
  };
};
```

### 7. **Environment Security** (High Priority)

#### Current Issue:
Some sensitive information may be exposed in client-side code

#### Recommended Changes:

**A. Environment Variable Review**
```bash
# .env.example (create this file)
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-here
MONGODB_URI=mongodb://localhost:27017/your-database
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,https://app.landd.com.au
SESSION_TIMEOUT=28800000
MAX_LOGIN_ATTEMPTS=5
LOGIN_WINDOW_MS=900000
```

**B. Remove Sensitive Data from Client**
```javascript
// frontend/src/services/api.js
// Remove hardcoded URLs
const config = {
  apiUrl: process.env.REACT_APP_API_URL || '/api'
};

// Use relative URLs for better security
const api = axios.create({
  baseURL: config.apiUrl,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true
});
```

---

## Implementation Priority Matrix

| Recommendation | Priority | Effort | Impact | Timeline |
|----------------|----------|---------|---------|----------|
| Rate Limiting | High | Low | High | 1-2 days |
| Security Headers | Medium | Low | Medium | 1 day |
| Token Security | High | Medium | High | 3-5 days |
| Input Validation | Medium | Medium | Medium | 2-3 days |
| Session Management | Medium | High | Medium | 1 week |
| Audit Logging | Low | High | Low | 1-2 weeks |

---

## Testing Recommendations

### 1. **Security Testing Tools**
- **OWASP ZAP**: Automated security testing
- **Burp Suite**: Manual security testing
- **npm audit**: Dependency vulnerability scanning

### 2. **Penetration Testing Checklist**
- [ ] Authentication bypass attempts
- [ ] SQL injection testing
- [ ] XSS vulnerability testing
- [ ] CSRF token validation
- [ ] Rate limiting effectiveness
- [ ] Session hijacking attempts
- [ ] Privilege escalation testing

### 3. **Code Review Checklist**
- [ ] No hardcoded secrets in code
- [ ] Proper error handling without information leakage
- [ ] Input validation on all endpoints
- [ ] Proper authentication checks
- [ ] Secure token handling
- [ ] CORS configuration review

---

## Monitoring and Alerting

### 1. **Security Event Monitoring**
```javascript
// backend/services/securityMonitor.js
const securityMonitor = {
  trackFailedLogin: async (email, ipAddress) => {
    // Track failed login attempts
    // Alert if threshold exceeded
  },
  
  trackSuspiciousActivity: async (userId, action, details) => {
    // Track suspicious user actions
    // Generate alerts for review
  },
  
  monitorRateLimitViolations: async (ipAddress, endpoint) => {
    // Track rate limit violations
    // Implement progressive delays
  }
};
```

### 2. **Alert Thresholds**
- Failed login attempts: >5 per 15 minutes
- API rate limit violations: >10 per hour
- Unusual user activity patterns
- Authentication failures from new IP addresses

---

## Conclusion

While the current security implementation provides a solid foundation, implementing these recommendations will significantly enhance the application's security posture. The most critical improvements are rate limiting, token security enhancements, and security headers implementation.

**Next Steps:**
1. Implement rate limiting (immediate)
2. Add security headers (week 1)
3. Enhance token security (week 2)
4. Implement input validation (week 3)
5. Add session management (week 4)

**Estimated Total Effort:** 2-3 weeks  
**Security Rating After Implementation:** 9/10

---

## Resources and References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [JWT Security Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practices-security.html)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
