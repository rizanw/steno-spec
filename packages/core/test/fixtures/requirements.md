# Requirements — login

## R1 Login with email
**User Story:** As a user, I want to log in with email, so that I can access my account.

### Acceptance Criteria
1. WHEN a user submits valid credentials THEN the system SHALL create a session.
2. IF the password is wrong THEN the system SHALL return a generic error.
3. Users SHALL find the login fast and easy.

## R2 Logout
**User Story:** As a user, I want to log out, so that my session ends.

### Acceptance Criteria
1. WHEN a user clicks logout THEN the system SHALL delete the session and SHALL redirect home.
