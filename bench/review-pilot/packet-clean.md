# Review packet — link-expiry / requirements

Reviewer: you have NO conversation history. Judge only what is below.

## requirements.md
# Requirements Document

## Introduction

Today every link the Shortener creates works forever. A link made for a one-week promotion or a temporary document keeps redirecting long after it should have stopped, and the only way to stop it is to delete it by hand, which also frees its code for someone else to claim.

Link expiry lets a Link_Creator give a link an Expiry_Time when creating it. Once that time is reached the link stops redirecting and Visitors are told it has expired, while the link itself stays on record until it is deleted. The Shortener has a single mode and English-only messages, so there are no mode or language variants.

## Glossary

- **Shortener**: the link-shortening service as seen through its HTTP interface.
- **Link**: a short code together with its target URL, click count and creation time.
- **Link_Creator**: an API client that creates, inspects and deletes Links.
- **Visitor**: anyone who follows a Link's short URL.
- **Expiry_Time**: the moment, chosen by the Link_Creator at creation, from which a Link no longer redirects.
- **Active_Link**: a Link with no Expiry_Time, or whose Expiry_Time is later than the current time.
- **Expired_Link**: a Link whose Expiry_Time is equal to or earlier than the current time.
- **Link_Details**: the description of a Link that the Shortener returns on creation and on inspection.
- **Expired_Error**: the error a Visitor receives for an Expired_Link, distinct from the error for a code that does not exist.
- **Persistent_Storage**: the optional mode in which Links are kept in a file and survive a restart.

## Requirements

### Requirement 1: Set an expiry when creating a link

**User Story:** As a Link_Creator, I want to give a link an expiry time when I create it, so that it stops working on its own when it is no longer needed.

#### Acceptance Criteria

1. WHEN a Link_Creator creates a Link with an Expiry_Time later than the current time, THE Shortener SHALL create the Link with that Expiry_Time.
2. WHEN a Link_Creator creates a Link without an Expiry_Time, THE Shortener SHALL create a Link that never expires.
3. IF the supplied Expiry_Time is not a valid ISO 8601 timestamp with a time zone, THEN THE Shortener SHALL reject the request with an invalid-expiry error and create no Link.
4. IF the supplied Expiry_Time is equal to or earlier than the current time, THEN THE Shortener SHALL reject the request with an invalid-expiry error and create no Link.

### Requirement 2: Expired links stop redirecting

**User Story:** As a Link_Creator, I want an expired link to stop sending visitors to its target, so that temporary content is not reachable through it after the deadline.

#### Acceptance Criteria

1. WHEN a Visitor follows an Active_Link, THE Shortener SHALL redirect the Visitor to the target URL and add one to the click count.
2. IF a Visitor follows an Expired_Link, THEN THE Shortener SHALL respond with the Expired_Error and no redirect.
3. IF a Visitor follows an Expired_Link, THEN THE Shortener SHALL leave the click count of that Link unchanged.
4. THE Shortener SHALL report the Expired_Error with status 410, so that a Visitor can tell an Expired_Link from a code that was never created.
5. THE Shortener SHALL decide whether a Link is an Expired_Link at the moment of each visit, without any action by the Link_Creator.

### Requirement 3: Expiry is visible in link details

**User Story:** As a Link_Creator, I want to see a link's expiry time and whether it has expired, so that I know which of my links still work.

#### Acceptance Criteria

1. WHEN a Link is created with an Expiry_Time, THE Shortener SHALL include that Expiry_Time in the Link_Details it returns.
2. WHEN a Link_Creator inspects a Link that has an Expiry_Time, THE Shortener SHALL include the Expiry_Time in the Link_Details.
3. WHEN a Link_Creator inspects a Link that has no Expiry_Time, THE Shortener SHALL return Link_Details that show no Expiry_Time.
4. WHEN a Link_Creator inspects an Expired_Link, THE Shortener SHALL return its Link_Details marked as expired instead of an error.
5. WHEN a Link_Creator inspects an Active_Link, THE Shortener SHALL return its Link_Details marked as not expired.

### Requirement 4: Expired links keep their code until deleted

**User Story:** As a Link_Creator, I want an expired link's code to stay reserved until I delete the link, so that nobody else can reuse a code my audience already knows.

#### Acceptance Criteria

1. IF a Link_Creator creates a Link with a custom code held by an Expired_Link, THEN THE Shortener SHALL reject the request with the same code-taken error used for an Active_Link.
2. THE Shortener SHALL never assign a generated code that is held by an Expired_Link.
3. WHEN a Link_Creator deletes an Expired_Link, THE Shortener SHALL remove the Link.
4. WHEN an Expired_Link has been deleted, THE Shortener SHALL accept its code for a new Link.

### Requirement 5: Expiry survives restarts and older links keep working

**User Story:** As a Link_Creator, I want expiry to hold across restarts and my existing links to keep working, so that turning the feature on changes nothing I did not ask for.

#### Acceptance Criteria

1. WHERE Persistent_Storage is enabled, THE Shortener SHALL keep the Expiry_Time of each Link across a restart.
2. WHERE Persistent_Storage is enabled, WHEN the Shortener restarts after the Expiry_Time of a Link has passed, THE Shortener SHALL treat that Link as an Expired_Link.
3. WHEN the Shortener loads a stored Link created before this feature, THE Shortener SHALL treat it as a Link that never expires.
4. THE Shortener SHALL keep the click count and creation time of a Link unchanged when the Link becomes an Expired_Link.


## traceability
R1: design -; tasks -
R2: design -; tasks -
R3: design -; tasks -
R4: design -; tasks -
R5: design -; tasks -