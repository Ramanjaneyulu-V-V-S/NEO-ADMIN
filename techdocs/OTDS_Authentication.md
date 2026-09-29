# OTDS Authentication Implementation

## Overview

NBSupportApp has been updated to use **OpenText Directory Services (OTDS)** for user authentication instead of direct Documentum credentials. This integration provides enterprise-grade authentication and security compliance.

**Key Benefits:**
- Centralized user authentication via OTDS
- Support for Single Sign-On (SSO)
- Improved security posture
- Compliance with enterprise authentication standards

---

## Architecture

### Authentication Flow

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ 1. Username + Password
       ▼
┌─────────────────────────────────┐
│  LoginPage (React Frontend)     │
│  - Collects credentials         │
│  - Shows user-friendly errors   │
└──────┬──────────────────────────┘
       │ 2. POST to OTDS
       ▼
┌──────────────────────────────────────┐
│  OTDS Proxy                          │
│  (172.172.20.214/proxy/otds/...)     │
│  - Validates credentials             │
│  - Returns Bearer token              │
└──────┬───────────────────────────────┘
       │ 3. Store token + Fetch profile
       ▼
┌──────────────────────────────────┐
│  Spring Boot Backend             │
│  /api/auth/profile endpoint      │
│  - Validates token (received)    │
│  - Queries Documentum for user   │
│  - Resolves admin role           │
│  - Returns user profile          │
└──────┬───────────────────────────┘
       │ 4. Store user + token
       ▼
┌─────────────────────────────────┐
│  localStorage                   │
│  - user (user profile)          │
│  - token (OTDS bearer token)    │
└──────┬──────────────────────────┘
       │ 5. Authenticated requests
       ▼
┌─────────────────────────────────┐
│  All API Calls (with token)     │
│  Authorization: Bearer {token}  │
└─────────────────────────────────┘
```

### Components

#### Frontend
- **LoginPage.jsx** - Login UI and OTDS authentication
- **axios.js** - Request interceptor to include bearer token
- **MainLayout.jsx** - Access control based on admin_role

#### Backend
- **AuthController.java** - REST endpoints for authentication
- **AuthService.java** - Authentication logic and user profile fetching

---

## Configuration

### Environment Variables

Set these environment variables before starting the backend:

```bash
# Documentum Service Account (for fetching user profiles)
DCTM_SERVICE_USERNAME=your_service_account_username
DCTM_SERVICE_PASSWORD=your_service_account_password

# Documentum REST API Configuration
DCTM_URL=http://your-dctm-rest-url:port/dctm-rest
DCTM_REPOSITORY=NABARDUAT
```

### OTDS Endpoint Configuration

The OTDS endpoint is hardcoded in **LoginPage.jsx**:

```javascript
const otdsResponse = await fetch('http://172.172.20.214/proxy/otds/Integration/otds-proxy/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
});
```

**OTDS Parameters:**
- `username` - User's login name (e.g., "kalai")
- `password` - User's password
- `captcha_id` - Set to `dev-no-captcha` for development
- `captcha_answer` - Set to `0` for development

**Note:** For production, update captcha configuration accordingly.

---

## API Endpoints

### 1. OTDS Token Endpoint (External)

**URL:** `http://172.172.20.214/proxy/otds/Integration/otds-proxy/token`

**Method:** POST

**Content-Type:** `application/x-www-form-urlencoded`

**Payload:**
```
username=kalai&password=Testing%401234567890&captcha_id=dev-no-captcha&captcha_answer=0
```

**Success Response (200):**
```json
{
  "token": "eyJhbGc...",
  "access_token": "eyJhbGc...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

**Error Response (400/401):**
```json
{
  "error": "invalid_credentials",
  "message": "Username or password is incorrect"
}
```

---

### 2. Get User Profile

**URL:** `GET /api/auth/profile`

**Query Parameters:**
- `username` (required) - User's login name

**Headers:**
```
Authorization: Bearer {otds_token}
```

**Success Response (200):**
```json
{
  "user_login_name": "kalai",
  "user_name": "Kalai",
  "user_address": "kalai@example.com",
  "user_privileges": 2,
  "user_state": 0,
  "admin_role": "Super Admin" | "Local Admin" | "Standard User"
}
```

**Error Responses:**

- **400** - Missing username parameter
  ```json
  {
    "error": "Missing username parameter"
  }
  ```

- **401** - Missing OTDS token
  ```json
  {
    "error": "Missing authentication token",
    "message": "OTDS token not provided"
  }
  ```

- **401** - User not found
  ```json
  {
    "error": "User profile not found",
    "message": "User not found: kalai"
  }
  ```

- **500** - Server error
  ```json
  {
    "error": "Failed to fetch user profile",
    "message": "Service account authentication failed...",
    "details": "HttpClientErrorException"
  }
  ```

---

## Frontend Implementation

### LoginPage.jsx

**Key Features:**
1. Accepts username and password from user
2. Calls OTDS proxy endpoint with form-encoded payload
3. Handles authentication errors with user-friendly messages
4. Fetches user profile from backend using OTDS token
5. Stores token and user profile in localStorage
6. Redirects to dashboard on success

**Error Messages:**
- `Invalid username or password. Please try again.` - For 400/401/403 errors
- `Service unavailable. Please check your connection and try again.` - For network errors

**Code Flow:**
```javascript
1. handleSubmit(e)
   ├─ Build URLSearchParams with credentials
   ├─ POST to OTDS endpoint
   ├─ Extract token from response
   ├─ Store token in localStorage
   ├─ GET /auth/profile with token
   ├─ Store user profile in localStorage
   └─ Navigate to /dashboard

2. Error Handling
   ├─ OTDS auth failures → "Invalid username or password"
   ├─ Profile fetch failures → Specific error message
   └─ Network errors → "Service unavailable"
```

### axios.js

**Request Interceptor:**
```javascript
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

Automatically adds OTDS bearer token to all API requests.

### MainLayout.jsx

**Access Control:**
```javascript
const adminRole = storedUser.properties?.admin_role || storedUser.admin_role;
const hasAccess = adminRole === 'Super Admin' || adminRole === 'Local Admin';

if (!hasAccess) {
  return <AccessDenied />;
}
```

Only Super Admin and Local Admin users can access the application.

---

## Backend Implementation

### AuthController.java

**Endpoint: GET /api/auth/profile**

```java
@GetMapping("/profile")
public ResponseEntity<?> getUserProfile(
    @RequestParam String username,
    @RequestHeader(value = "Authorization", required = false) String bearerToken
)
```

**Responsibilities:**
1. Validate username parameter
2. Validate bearer token presence
3. Call `authService.getUserProfile(username)`
4. Return user profile with admin role
5. Handle errors with appropriate HTTP status codes

---

### AuthService.java

**Method: getUserProfile(String username)**

**Process:**
1. **Build DQL Query:**
   ```sql
   SELECT r_object_id, user_name, user_login_name, user_address, user_privileges, user_state
   FROM dm_user
   WHERE user_login_name = 'kalai'
   ```

2. **Execute Query via REST API:**
   - Uses service account credentials (Basic Auth)
   - Calls Documentum REST API endpoint
   - Parses response

3. **Resolve Admin Role:**
   - Queries user's group membership
   - Checks for `ecm_super_admin` → "Super Admin"
   - Checks for `ecm_local_admin` → "Local Admin"
   - Default → "Standard User"

4. **Return User Profile:**
   ```json
   {
     "user_login_name": "kalai",
     "user_name": "Kalai",
     "user_address": "kalai@example.com",
     "admin_role": "Super Admin"
   }
   ```

**Error Handling:**
- **Unauthorized (401):** Service account auth failed → Check env vars
- **Not Found (404):** User doesn't exist in Documentum
- **Generic Exception:** Log error and return failure response

---

## User Flow

### First-Time Login

1. **User visits login page** → `localhost:5173/login`
2. **Enters credentials:**
   - Username: `kalai`
   - Password: `Testing@1234567890`
3. **Clicks Sign In**
4. **Frontend authenticates with OTDS:**
   - Sends username + password + captcha
   - Receives OTDS token
5. **Frontend fetches user profile:**
   - Calls `/api/auth/profile?username=kalai`
   - Sends OTDS token in Authorization header
6. **Backend returns user profile:**
   - Admin role resolved from group membership
7. **Frontend stores:**
   - `localStorage.user` - User profile with admin_role
   - `localStorage.token` - OTDS bearer token
8. **Redirects to dashboard** → `localhost:5173/dashboard`

### Subsequent Requests

1. **User makes API call** (e.g., fetch users, create case)
2. **axios interceptor adds token:**
   - `Authorization: Bearer {otds_token}`
3. **Backend processes request** with authenticated context
4. **Response returned** to frontend

### Logout

1. **User clicks logout** (typically in Topbar)
2. **Frontend removes from localStorage:**
   - `localStorage.removeItem('user')`
   - `localStorage.removeItem('token')`
3. **Redirects to login page** → `localhost:5173/login`

---

## Error Handling

### Frontend Errors

| Status | Scenario | User Message |
|--------|----------|--------------|
| 400 | Invalid credentials (OTDS) | "Invalid username or password. Please try again." |
| 401 | Missing/invalid token | "Invalid username or password. Please try again." |
| 403 | Forbidden | "Invalid username or password. Please try again." |
| 404 | Profile endpoint not found | Shown in console, page won't load |
| 500 | Server error | "Service unavailable. Please check your connection and try again." |
| Network Error | Connection failed | "Service unavailable. Please check your connection and try again." |

### Backend Errors

**OTDS Authentication Failed (401):**
```
Log: "Service account authentication failed. Check DCTM_SERVICE_USERNAME and DCTM_SERVICE_PASSWORD"
Response: 401 with "Service account authentication failed" message
```

**User Not Found (404):**
```
Log: "User 'kalai' not found in Documentum"
Response: 401 with "User not found: kalai"
```

**Missing Username Parameter (400):**
```
Response: 400 with "Missing username parameter"
```

**Missing OTDS Token (401):**
```
Response: 401 with "Missing authentication token"
```

---

## Development Notes

### OTDS Configuration

**Development Settings:**
- `captcha_id = "dev-no-captcha"`
- `captcha_answer = "0"`

**For Production:**
Update `LoginPage.jsx` to handle real CAPTCHA:
```javascript
params.append('captcha_id', realCaptchaId);
params.append('captcha_answer', userProvidedAnswer);
```

### Service Account Permissions

The service account must have:
- Read access to `dm_user` objects
- Read access to group memberships (for admin role resolution)
- Access to execute DQL queries

**Typical Setup:**
```sql
GRANT READ ON TYPE dm_user TO service_account
GRANT EXECUTE ON METHOD getGroupsByUser TO service_account
```

### Debugging

**Enable Verbose Logging:**

In `application.properties`:
```properties
logging.level.com.example.backend.service.AuthService=DEBUG
logging.level.com.example.backend.controller.AuthController=DEBUG
```

**Backend Logs to Watch:**
```
[INFO] Fetching user profile for 'kalai' (login_name)
[INFO] Service account: username, Repository: NABARDUAT
[INFO] Executing DQL query for user: kalai
[INFO] Successfully fetched user profile for 'kalai' with admin role: Super Admin
```

---

## Troubleshooting

### Problem: 404 on /api/auth/profile

**Cause:** Backend not rebuilt or restarted after adding endpoint

**Solution:**
```bash
cd backend
mvn clean install
mvn spring-boot:run
```

### Problem: 401 when calling /api/auth/profile

**Cause:** Service account credentials incorrect or missing

**Solution:**
1. Verify environment variables are set
2. Check service account has read permissions on dm_user
3. Test service account login separately
4. Check backend logs for detailed error

### Problem: "User not found" error

**Cause:** Username doesn't exist in Documentum or OTDS

**Solution:**
1. Verify username is correct (check user_login_name, not user_name)
2. Confirm user exists in both OTDS and Documentum
3. Check DQL query is finding the user

### Problem: Token not being sent with requests

**Cause:** axios interceptor not working

**Solution:**
1. Check `localStorage.getItem('token')` returns a value
2. Verify axios interceptor is registered in `axios.js`
3. Check browser console for any interceptor errors

---

## Security Considerations

1. **OTDS Token Storage:** Token stored in `localStorage` (XSS vulnerable)
   - Consider moving to secure HTTP-only cookies in production
   
2. **HTTPS:** Use HTTPS in production for all OTDS and API calls
   
3. **Token Expiration:** Implement token refresh logic if OTDS token expires
   
4. **Password Security:** Never log passwords; only log authentication success/failure
   
5. **CORS:** Ensure CORS is configured correctly to allow OTDS endpoint calls

---

## Related Documentation

- [Backend Architecture](./backend-architecture.md) - Full API endpoints and service layer
- [Frontend Architecture](./frontend-architecture.md) - UI components and routing
- [User Management](./case-type-metadata.md) - User roles and permissions

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-05-12 | 1.0 | Initial OTDS authentication implementation |

