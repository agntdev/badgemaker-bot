# Private ID Generator Bot — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A secure Telegram bot that creates ID-style images using only user-submitted photos and text fields. Submissions are stored for audit and re-download, and copies are forwarded to admin/staff chats with metadata. No auto-generated data or public access.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- business owner
- internal staff

## Success criteria

- Generates ID images with exact user-submitted content
- Forwards submissions to admin chat with metadata
- Stores submission records for 90 days by default

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu
- **/create** (command, actor: user, command: /create) — Begin ID creation process
- **Create ID** (button, actor: user, callback: create:start) — Initiate ID creation flow
  - inputs: photo, full name, additional fields (optional), template choice
  - outputs: generated ID image, admin chat notification

## Flows

### Authentication
_Trigger:_ /start or any action

1. Check if user is authorized via admin chat ID list
2. Reject unauthorized users with error message

_Data touched:_ UserRole

### ID Creation
_Trigger:_ /create or Create button

1. Request photo upload
2. Collect full name
3. Prompt for 6 optional additional fields
4. Select template (3 preloaded options)
5. Confirm submission
6. Generate ID image
7. Send to user and admin chat

_Data touched:_ Submission, Template

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **Submission** _(retention: persistent)_ — Record of an ID creation request including photo, text fields, and metadata
  - fields: uploader_id, timestamp, photo, full_name, additional_fields, template_used, image_file_ref
- **Template** _(retention: persistent)_ — Predefined visual layout for ID cards (simple, corporate, badge)
  - fields: template_name, background, photo_placement, text_styles
- **UserRole** _(retention: session)_ — User authorization status (authorized/disallowed)
  - fields: telegram_id, role

## Integrations

- **Telegram** (required) — Bot API messaging and admin notifications
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Add/remove templates
- Manage authorized staff list
- Configure retention period
- View submission logs

## Notifications

- Admin chat receives generated ID image with metadata summary

## Permissions & privacy

- Only users in authorized admin list can access bot
- Submission data stored for 90 days by default
- No personal data inferred or altered

## Edge cases

- Unauthorized users attempting access
- Missing required photo or name fields
- Invalid photo formats
- Exceeding optional field limit

## Required tests

- End-to-end test: unauthorized user receives rejection message
- Test submission flow with all required fields
- Verify admin chat receives notification with metadata
- Validate exact text rendering without modification

## Assumptions

- 3 preloaded templates cover common needs
- 6 optional fields suffice for most ID layouts
- Admin chat ID is a single chat by default
- Image generation uses basic compositing without external APIs
