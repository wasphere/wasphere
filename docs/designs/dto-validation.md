# DTO Validation Design

**Branch:** `fix/dto-validation`
**Scope:** v1 — WA Server (`packages/wa-server/src/`) only
**Bugs closed:** BUG-2, BUG-4, BUG-8, BUG-9, BUG-11, BUG-12

---

## Goal

Every endpoint in `wa-server` that accepts user input must reject invalid input at the
NestJS pipe layer before it reaches a service or the Baileys adapter. This is done by:

1. Creating proper DTO classes in dedicated `*.dto.ts` files for every controller.
2. Applying decorators from `class-validator` and `class-transformer` to every field.
3. Confirming that the global `ValidationPipe` (already in `main.ts`) is correctly
   configured to enforce the DTOs.
4. Creating the missing `ValidateSessionIdPipe` TypeScript source file and wiring it
   to every `:sessionId` path parameter.

---

## Bugs Closed

| Bug | Description | Fix |
|-----|-------------|-----|
| BUG-2 | `forEveryone` query param accepted as any string | `@Transform` to boolean + `@IsBoolean` in `DeleteMessageQueryDto` |
| BUG-4 | Poll options array has no size cap, `selectableCount` has no range | `@ArrayMinSize(2)`, `@ArrayMaxSize(12)`, per-option `@MaxLength(100)`, `@Min(1)` `@Max(12)` `@IsInt` |
| BUG-8 | `sendContact` vCard fields accept any characters enabling vCard injection | `@Matches` regex on `displayName` and `phoneNumber` |
| BUG-9 | Bulk contacts check has no array size cap — potential DoS | `@ArrayMaxSize(100)` on the `numbers` array |
| BUG-11 | `sessionId` path param is not validated in source — pipe exists only in `dist/` and is never applied | Create `src/common/validate-session-id.pipe.ts`, apply via `@Param('sessionId', ValidateSessionIdPipe)` on all controllers |
| BUG-12 | Already closed by `ValidateSessionIdPipe` (security PR `fix/security-hardening-input`) | Confirmed below — the compiled pipe logic is correct; only the source file and wiring are missing |

---

## Global Setup — ValidationPipe in main.ts

`main.ts` already registers the global pipe:

```typescript
app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
```

Two options must be added:

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,        // strip unknown properties
    forbidNonWhitelisted: true, // 400 on unknown properties instead of silently stripping
    transform: true,        // enable @Transform() decorators + auto class coercion
  }),
);
```

`transform: true` is required for `@Transform()` decorators (BUG-2 boolean coercion) and
for query-param DTOs to work correctly. `forbidNonWhitelisted: true` adds defence-in-depth.

---

## File Layout

All DTOs live in a `dto/` subdirectory inside each controller's module folder. The pipe
source goes in `src/common/`.

```
packages/wa-server/src/
  common/
    validate-session-id.pipe.ts   ← NEW: moved from dist-only to proper source
  sessions/
    dto/
      create-session.dto.ts       ← MOVE: inline class in controller → dedicated file
  messages/
    dto/
      send-text.dto.ts
      send-media.dto.ts           ← shared base for image/video/audio/gif/view-once/sticker
      send-document.dto.ts
      send-location.dto.ts
      send-contact.dto.ts
      send-buttons.dto.ts
      send-list.dto.ts
      send-poll.dto.ts
      send-reaction.dto.ts
      edit-message.dto.ts
      delete-message-query.dto.ts
      mark-read.dto.ts            ← MOVE: inline class in controller → dedicated file
      send-typing.dto.ts
      send-presence.dto.ts
  groups/
    dto/
      create-group.dto.ts
      update-group-picture.dto.ts
      update-group-name.dto.ts
      update-group-description.dto.ts
      join-group.dto.ts           ← MOVE: inline class in controller → dedicated file
      participants.dto.ts         ← shared for add/remove/promote/demote
      update-settings.dto.ts
  contacts/
    dto/
      update-name.dto.ts
      update-about.dto.ts
      update-profile-picture.dto.ts
      check-bulk.dto.ts
  webhooks/
    dto/
      set-callback.dto.ts         ← MOVE: inline class in controller → dedicated file
```

Controllers import their DTOs from these files; inline DTO classes in controllers are
removed.

---

## Sessions Controller DTOs

**File:** `packages/wa-server/src/sessions/sessions.controller.ts`

| Endpoint | Input source | DTO class | Note |
|----------|-------------|-----------|------|
| `POST /sessions` | `@Body()` | `CreateSessionDto` | Already exists inline — move to file |
| `GET /sessions/:id` | `@Param('id')` | — | Pipe-only validation (no body); `ValidateSessionIdPipe` applied |
| `DELETE /sessions/:id` | `@Param('id')` | — | Same as above |
| `POST /sessions/:id/logout` | `@Param('id')` | — | Same as above |

### CreateSessionDto

```typescript
// sessions/dto/create-session.dto.ts
import { IsString, IsNotEmpty, MaxLength, Matches } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'id may only contain letters, numbers, hyphens and underscores',
  })
  id: string;
}
```

This is already correct inline in the controller. Move it to its own file; no field changes.

**BUG-11 / BUG-12 note:** The `id` field in `CreateSessionDto` covers the body, but the
`:id` path param on `GET`, `DELETE`, and `POST .../logout` has no source-level pipe applied.
The compiled `dist/common/validate-session-id.pipe.js` exists but its `.ts` source does not
exist in `src/` and it is never used in the controller. This must be fixed (see Common Pipe
section below).

---

## Messages Controller DTOs

**File:** `packages/wa-server/src/messages/messages.controller.ts`

| Endpoint | DTO class | Key fields |
|----------|-----------|------------|
| `POST .../text` | `SendTextDto` | `to`, `text`, `quotedId?` |
| `POST .../image` | `SendMediaDto` | `to`, `url`, `caption?` |
| `POST .../video` | `SendMediaDto` | `to`, `url`, `caption?` |
| `POST .../audio` | `SendAudioDto` | `to`, `url`, `isVoiceNote?` |
| `POST .../document` | `SendDocumentDto` | `to`, `url`, `fileName`, `mimetype` |
| `POST .../sticker` | `SendStickerDto` | `to`, `url` |
| `POST .../location` | `SendLocationDto` | `to`, `latitude`, `longitude`, `name?`, `address?` |
| `POST .../contact` | `SendContactDto` | `to`, `displayName`, `phoneNumber` |
| `POST .../buttons` | `SendButtonsDto` | `to`, `text`, `footer`, `buttons[]` |
| `POST .../list` | `SendListDto` | `to`, `title`, `text`, `buttonText`, `sections[]` |
| `POST .../poll` | `SendPollDto` | `to`, `name`, `options[]`, `selectableCount?` |
| `POST .../reaction` | `SendReactionDto` | `to`, `messageId`, `emoji` |
| `POST .../gif` | `SendMediaDto` | `to`, `url`, `caption?` |
| `POST .../view-once` | `SendMediaDto` | `to`, `url`, `caption?` |
| `POST .../:messageId/edit` | `EditMessageDto` | `to`, `text` |
| `DELETE .../:messageId` | `DeleteMessageQueryDto` | `to` (query), `forEveryone` (query) |
| `POST .../read` | `MarkReadDto` | `to`, `messageIds[]` |
| `POST .../typing` | `SendTypingDto` | `to`, `isGroup?` |
| `POST .../presence` | `SendPresenceDto` | `to`, `presence` (enum) |

### Common JID field

Every DTO that has a `to` field uses the same shape. A WhatsApp JID has the form
`<digits>@s.whatsapp.net` or `<digits>@g.us`. Maximum realistic length is 40 characters.

```typescript
@IsString()
@IsNotEmpty()
@MaxLength(40)
to: string;
```

Do not use `@IsPhoneNumber` — JIDs already include the `@` suffix and are not bare phone
numbers. `@Matches` against a JID pattern is optional hardening (see Tricky Endpoints).

### SendTextDto

```typescript
export class SendTextDto {
  @IsString() @IsNotEmpty() @MaxLength(40)
  to: string;

  @IsString() @IsNotEmpty() @MaxLength(65536)   // WA message character limit
  text: string;

  @IsOptional() @IsString() @MaxLength(100)
  quotedId?: string;
}
```

### SendMediaDto (image / video / gif / view-once / sticker)

```typescript
export class SendMediaDto {
  @IsString() @IsNotEmpty() @MaxLength(40)
  to: string;

  @IsUrl({ require_tld: true, require_protocol: true })
  @MaxLength(2048)
  url: string;

  @IsOptional() @IsString() @MaxLength(1024)
  caption?: string;
}
```

`SendStickerDto` is identical to `SendMediaDto` minus `caption` (sticker has none).

### SendAudioDto

```typescript
export class SendAudioDto {
  @IsString() @IsNotEmpty() @MaxLength(40)
  to: string;

  @IsUrl({ require_tld: true, require_protocol: true })
  @MaxLength(2048)
  url: string;

  @IsOptional() @IsBoolean()
  isVoiceNote?: boolean;
}
```

### SendDocumentDto

```typescript
export class SendDocumentDto {
  @IsString() @IsNotEmpty() @MaxLength(40)
  to: string;

  @IsUrl({ require_tld: true, require_protocol: true })
  @MaxLength(2048)
  url: string;

  @IsString() @IsNotEmpty() @MaxLength(255)
  fileName: string;

  @IsString() @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_.+]*$/)
  @MaxLength(127)
  mimetype: string;
}
```

### SendLocationDto

```typescript
export class SendLocationDto {
  @IsString() @IsNotEmpty() @MaxLength(40)
  to: string;

  @IsNumber() @Min(-90) @Max(90)
  latitude: number;

  @IsNumber() @Min(-180) @Max(180)
  longitude: number;

  @IsOptional() @IsString() @MaxLength(255)
  name?: string;

  @IsOptional() @IsString() @MaxLength(512)
  address?: string;
}
```

### SendContactDto (BUG-8)

vCard injection is possible when `displayName` or `phoneNumber` contain newlines or colons
that break out of the vCard field. The fix is a `@Matches` allowlist.

```typescript
export class SendContactDto {
  @IsString() @IsNotEmpty() @MaxLength(40)
  to: string;

  // Allow: letters (any Unicode word char), digits, spaces, +, -, (, ), comma, period
  // Block: colon, newline, CR — the characters that break vCard structure
  @IsString() @IsNotEmpty() @MaxLength(100)
  @Matches(/^[\w\s\+\-\(\)\.,]+$/u, {
    message: 'displayName contains disallowed characters',
  })
  displayName: string;

  // Phone numbers: digits, +, -, spaces only
  @IsString() @IsNotEmpty() @MaxLength(30)
  @Matches(/^[\d\+\-\s]+$/, {
    message: 'phoneNumber must contain only digits, +, -, and spaces',
  })
  phoneNumber: string;
}
```

### SendButtonsDto (Tricky — see Tricky Endpoints section)

```typescript
export class ButtonItemDto {
  @IsString() @IsNotEmpty() @MaxLength(20)   // WA button ID limit ~20 chars
  id: string;

  @IsString() @IsNotEmpty() @MaxLength(20)   // WA button text display limit
  text: string;
}

export class SendButtonsDto {
  @IsString() @IsNotEmpty() @MaxLength(40)
  to: string;

  @IsString() @IsNotEmpty() @MaxLength(1024)
  text: string;

  @IsString() @IsNotEmpty() @MaxLength(60)
  footer: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)           // WhatsApp allows max 3 buttons
  @ValidateNested({ each: true })
  @Type(() => ButtonItemDto)
  buttons: ButtonItemDto[];
}
```

### SendListDto (Tricky — see Tricky Endpoints section)

```typescript
export class ListRowDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  id: string;

  @IsString() @IsNotEmpty() @MaxLength(24)   // WA row title limit
  title: string;

  @IsOptional() @IsString() @MaxLength(72)
  description?: string;
}

export class ListSectionDto {
  @IsString() @IsNotEmpty() @MaxLength(24)
  title: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ListRowDto)
  rows: ListRowDto[];
}

export class SendListDto {
  @IsString() @IsNotEmpty() @MaxLength(40)
  to: string;

  @IsString() @IsNotEmpty() @MaxLength(60)
  title: string;

  @IsString() @IsNotEmpty() @MaxLength(1024)
  text: string;

  @IsString() @IsNotEmpty() @MaxLength(20)
  buttonText: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)           // WA allows up to 10 sections
  @ValidateNested({ each: true })
  @Type(() => ListSectionDto)
  sections: ListSectionDto[];
}
```

### SendPollDto (BUG-4)

```typescript
export class SendPollDto {
  @IsString() @IsNotEmpty() @MaxLength(40)
  to: string;

  @IsString() @IsNotEmpty() @MaxLength(255)
  name: string;

  @IsArray()
  @ArrayMinSize(2)           // WA requires at least 2 options
  @ArrayMaxSize(12)          // WA allows at most 12 options
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  options: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  selectableCount?: number;
}
```

### SendReactionDto

```typescript
export class SendReactionDto {
  @IsString() @IsNotEmpty() @MaxLength(40)
  to: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  messageId: string;

  // Allow empty string (to remove a reaction) or a single emoji
  @IsString() @MaxLength(8)
  emoji: string;
}
```

### EditMessageDto

```typescript
export class EditMessageDto {
  @IsString() @IsNotEmpty() @MaxLength(40)
  to: string;

  @IsString() @IsNotEmpty() @MaxLength(65536)
  text: string;
}
```

### DeleteMessageQueryDto (BUG-2)

The `deleteMessage` endpoint uses `@Query()` params. Currently `forEveryone` is compared
as a raw string (`=== 'true'`), so any truthy-looking string passes. The fix uses a DTO
with `@Transform` and `@IsBoolean`.

```typescript
import { Transform } from 'class-transformer';
import { IsBoolean, IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class DeleteMessageQueryDto {
  @IsString() @IsNotEmpty() @MaxLength(40)
  to: string;

  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  forEveryone: boolean;
}
```

The controller method becomes:

```typescript
@Delete(':messageId')
deleteMessage(
  @Param('sessionId', ValidateSessionIdPipe) sid: string,
  @Param('messageId') messageId: string,
  @Query() query: DeleteMessageQueryDto,
) {
  return this.messagesService.deleteMessage(sid, query.to, messageId, query.forEveryone);
}
```

The manual `if (!to) throw new BadRequestException` is removed — the DTO handles it.

### MarkReadDto

Already exists inline. Move to `messages/dto/mark-read.dto.ts` and add missing caps:

```typescript
export class MarkReadDto {
  @IsString() @IsNotEmpty() @MaxLength(40)
  to: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)         // cap: bulk read at most 100 message IDs at once
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  messageIds: string[];
}
```

### SendTypingDto

```typescript
export class SendTypingDto {
  @IsString() @IsNotEmpty() @MaxLength(40)
  to: string;

  @IsOptional() @IsBoolean()
  isGroup?: boolean;
}
```

### SendPresenceDto

```typescript
export enum PresenceType {
  Available = 'available',
  Unavailable = 'unavailable',
  Composing = 'composing',
  Recording = 'recording',
  Paused = 'paused',
}

export class SendPresenceDto {
  @IsString() @IsNotEmpty() @MaxLength(40)
  to: string;

  @IsEnum(PresenceType)
  presence: PresenceType;
}
```

---

## Groups Controller DTOs

**File:** `packages/wa-server/src/groups/groups.controller.ts`

| Endpoint | DTO class | Key fields |
|----------|-----------|------------|
| `POST /groups` | `CreateGroupDto` | `name`, `participants[]` |
| `PUT /:groupId/picture` | `UpdateGroupPictureDto` | `imageUrl` |
| `PUT /:groupId/name` | `UpdateGroupNameDto` | `name` |
| `PUT /:groupId/description` | `UpdateGroupDescriptionDto` | `description` |
| `POST /join` | `JoinGroupDto` | `inviteCode` |
| `POST /:groupId/participants/add` | `ParticipantsDto` | `participants[]` |
| `POST /:groupId/participants/remove` | `ParticipantsDto` | `participants[]` |
| `POST /:groupId/participants/promote` | `ParticipantsDto` | `participants[]` |
| `POST /:groupId/participants/demote` | `ParticipantsDto` | `participants[]` |
| `PUT /:groupId/settings` | `UpdateSettingsDto` | `setting` (enum) |

### CreateGroupDto

```typescript
export class CreateGroupDto {
  @IsString() @IsNotEmpty() @MaxLength(100)   // WA group name limit
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1024)        // WA group max participants
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  participants: string[];
}
```

### UpdateGroupPictureDto

```typescript
export class UpdateGroupPictureDto {
  @IsUrl({ require_tld: true, require_protocol: true })
  @MaxLength(2048)
  imageUrl: string;
}
```

### UpdateGroupNameDto

```typescript
export class UpdateGroupNameDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  name: string;
}
```

### UpdateGroupDescriptionDto

```typescript
export class UpdateGroupDescriptionDto {
  @IsString() @MaxLength(512)
  description: string;
}
```

`@IsNotEmpty()` is intentionally omitted — setting an empty description clears it, which
is a valid operation.

### JoinGroupDto

Already exists inline. Move to file, no field changes:

```typescript
export class JoinGroupDto {
  @IsString() @IsNotEmpty() @MaxLength(512)
  inviteCode: string;
}
```

### ParticipantsDto (shared for add/remove/promote/demote)

```typescript
export class ParticipantsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)         // WA limit for batch participant operations
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  participants: string[];
}
```

### UpdateSettingsDto

```typescript
export enum GroupSetting {
  Announcement = 'announcement',
  NotAnnouncement = 'not_announcement',
  Locked = 'locked',
  Unlocked = 'unlocked',
}

export class UpdateSettingsDto {
  @IsEnum(GroupSetting)
  setting: GroupSetting;
}
```

---

## Contacts Controller DTOs

**File:** `packages/wa-server/src/contacts/contacts.controller.ts`

| Endpoint | Input source | DTO class | Key fields |
|----------|-------------|-----------|------------|
| `POST /profile/name` | `@Body()` | `UpdateNameDto` | `name` |
| `POST /profile/about` | `@Body()` | `UpdateAboutDto` | `about` |
| `POST /profile/picture` | `@Body()` | `UpdateProfilePictureDto` | `imageUrl` |
| `POST /contacts/check-bulk` | `@Body()` | `CheckBulkDto` | `numbers[]` |
| `GET /contacts/:number/picture` | `@Query()` | `GetProfilePictureQueryDto` | `highRes?` |

Path params `/:number` are validated via a `ValidatePhoneNumberPipe` (see Common Pipe note).

### UpdateNameDto

```typescript
export class UpdateNameDto {
  @IsString() @IsNotEmpty() @MaxLength(25)   // WA profile name limit
  name: string;
}
```

### UpdateAboutDto

```typescript
export class UpdateAboutDto {
  @IsString() @MaxLength(139)   // WA about/status limit
  about: string;
}
```

### UpdateProfilePictureDto

```typescript
export class UpdateProfilePictureDto {
  @IsUrl({ require_tld: true, require_protocol: true })
  @MaxLength(2048)
  imageUrl: string;
}
```

### CheckBulkDto (BUG-9)

```typescript
export class CheckBulkDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)         // cap bulk check at 100 numbers to prevent DoS
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  numbers: string[];
}
```

### GetProfilePictureQueryDto

```typescript
export class GetProfilePictureQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  highRes?: boolean;
}
```

Same `@Transform` pattern as BUG-2 — query params arrive as strings.

---

## Webhooks Controller DTOs

**File:** `packages/wa-server/src/webhooks/webhooks.controller.ts`

| Endpoint | DTO class | Key fields |
|----------|-----------|------------|
| `POST /webhooks/callback` | `SetCallbackDto` | `url` |

### SetCallbackDto

The existing inline class only has `@IsString()`. Move to file and add `@IsUrl`:

```typescript
export class SetCallbackDto {
  @IsUrl({ require_tld: true, require_protocol: true })
  @MaxLength(2048)
  url: string;
}
```

---

## Common Pipe — ValidateSessionIdPipe (BUG-11 / BUG-12)

**Critical finding:** `ValidateSessionIdPipe` exists only as compiled JavaScript in
`packages/wa-server/dist/common/validate-session-id.pipe.js`. The TypeScript source
`packages/wa-server/src/common/validate-session-id.pipe.ts` does not exist. The pipe is
never imported or applied in any controller.

**Required action:**

1. Create `packages/wa-server/src/common/validate-session-id.pipe.ts` with the correct
   implementation (regex `^[a-zA-Z0-9_-]{1,64}$`, throws `BadRequestException` with
   `{ error: 'INVALID_SESSION_ID' }`).

2. Apply it to every `:sessionId` path param in all controllers:
   - `MessagesController` — `@Param('sessionId', ValidateSessionIdPipe)`
   - `GroupsController` — `@Param('sessionId', ValidateSessionIdPipe)`
   - `ContactsController` — `@Param('sessionId', ValidateSessionIdPipe)`

3. Apply it to `:id` in `SessionsController` for `GET`, `DELETE`, and `POST .../logout`.
   (The `POST /sessions` body is covered by `CreateSessionDto`.)

**BUG-12 status:** The security PR `fix/security-hardening-input` included the correct
compiled pipe logic. However, because the source was never added to `src/` and the pipe was
never wired to controllers, BUG-12 is only nominally closed. This PR (`fix/dto-validation`)
formally closes it by adding the source file and wiring.

---

## Tricky Endpoints

### 1. Discriminated message types (buttons vs list vs poll)

**Problem:** `sendButtons`, `sendList`, and `sendPoll` have fundamentally different shapes.
They are currently separate endpoints — this is already the correct approach. No union type
is needed. Each gets its own DTO class as designed above.

**Approach:** Keep separate endpoints. Use `@ValidateNested({ each: true })` + `@Type()`
for nested arrays (buttons, sections/rows).

### 2. Nested objects in sendList and sendButtons

`@ValidateNested` from `class-validator` does not recurse automatically; it requires
`@Type(() => NestedClass)` from `class-transformer` on the same property. Both packages
must be installed. `transform: true` in the global `ValidationPipe` must be set (covered
in Global Setup).

**Required import:** `import { Type } from 'class-transformer';`

### 3. URL fields — @IsUrl vs @IsString + @MaxLength

All fields that are supposed to carry a URL (`url`, `imageUrl`) use `@IsUrl` with
`{ require_tld: true, require_protocol: true }`. This is stricter than `@IsString` alone
and prevents relative paths or `file://` URLs from reaching `safe-fetch`. It is
defence-in-depth on top of the existing SSRF guard.

### 4. sessionId and :number path params

Path params arrive as strings and bypass `@Body()` DTO validation. They must be handled
by pipes. `ValidateSessionIdPipe` covers `:sessionId`. The `:number` param in
`ContactsController` should be guarded by a `ValidatePhoneNumberPipe` that checks the
value matches `^[\d+@\w.]+$` and has a max length of 40. This pipe is a separate small
file: `src/common/validate-phone-number.pipe.ts`.

### 5. messageId path param

`@Param('messageId')` in `MessagesController` (edit and delete) is a WhatsApp message ID
(alphanumeric + underscores, max ~100 chars). A `ValidateMessageIdPipe` using
`/^[a-zA-Z0-9_-]{1,100}$/` should be applied. Can share structure with
`ValidateSessionIdPipe` — a single `PatternPipe` factory may be cleaner.

### 6. groupId path param

`@Param('groupId')` in `GroupsController` is a JID with the form `<digits>@g.us`. Max
length ~40 chars. A `ValidateGroupIdPipe` or the shared JID regex `^[\d+@\w.]+$` is
sufficient.

---

## Implementation Notes

- `class-validator` and `class-transformer` are already present in NestJS projects by
  default. Confirm they are listed as dependencies in
  `packages/wa-server/package.json` before implementation begins.
- All DTO files use named exports — no default exports.
- `@ApiProperty()` Swagger decorators are out of scope for this ticket (v1.1 item).
- The `forbidNonWhitelisted: true` change to the global `ValidationPipe` will cause a 400
  on any request that currently sends extra body fields. Waqas should confirm this is
  acceptable before implementation.
- `@IsInt()` requires `transform: true` in `ValidationPipe` to coerce numeric JSON values
  to integers correctly.

---

## Implementation Agents

| Agent | Work | Can run in parallel? |
|-------|------|----------------------|
| `backend-engineer` | Create all DTO files; update controllers to use named imports; add pipe source file; wire pipes to params; update `main.ts` ValidationPipe options | No — sequential file edits |

This is a single-agent job. No database migration is needed. No frontend changes are needed.

---

## Edge Cases and Failure Modes

| Case | Expected behaviour |
|------|--------------------|
| `forEveryone` query param missing entirely | `DeleteMessageQueryDto` must mark it `@IsOptional()` with a default of `false` via `@Transform(({ value }) => value === 'true')` — if absent, `value` is `undefined`, `=== 'true'` evaluates to `false` |
| `selectableCount` on a poll set to 0 | Rejected by `@Min(1)` |
| `selectableCount` on a poll set higher than `options.length` | This is a WhatsApp-level constraint, not validated at the DTO level. The service or adapter must check this separately |
| Empty `description` on `updateGroupDescription` | Allowed — clears the group description. `@IsString() @MaxLength(512)` without `@IsNotEmpty()` |
| `emoji` field on `sendReaction` set to empty string | Allowed — empty emoji removes an existing reaction. `@IsString() @MaxLength(8)` without `@IsNotEmpty()` |
| Bulk contact check with 0 numbers | Rejected by `@ArrayMinSize(1)` |
| `numbers` array with 101 entries | Rejected by `@ArrayMaxSize(100)` |
| `buttons` array with 4 entries | Rejected by `@ArrayMaxSize(3)` |
| `url` field containing `file://` | Rejected by `@IsUrl({ require_protocol: true })` |
| `url` field containing a relative path | Rejected by `@IsUrl({ require_tld: true })` |
| Unknown body properties sent by API consumer | Stripped silently (`whitelist: true`) then rejected with 400 (`forbidNonWhitelisted: true`) |
| `sessionId` path param with path traversal chars (`../`) | Rejected by `ValidateSessionIdPipe` before reaching service |

---

## Risks and Open Questions

| # | Risk / Question | Owner |
|---|-----------------|-------|
| 1 | `forbidNonWhitelisted: true` is a breaking change for API consumers sending extra fields. Waqas must decide: apply now or defer to v1.1 after announcing the change. | Waqas |
| 2 | WA field limits (button text ≤ 20 chars, row title ≤ 24 chars) are based on known Baileys/WA constraints. If the actual limits differ, `@MaxLength` values need adjustment. Waqas should verify against live WA behaviour. | Waqas |
| 3 | `ValidatePhoneNumberPipe` and `ValidateMessageIdPipe` / `ValidateGroupIdPipe` are new pipes not originally in scope. They are low-effort (< 20 lines each) but Waqas should confirm they are in scope for this PR. | Waqas |
| 4 | The `emoji` field on `sendReaction` is difficult to validate strictly (Unicode emoji range is complex). `@MaxLength(8)` limits damage but allows non-emoji strings. A custom validator could check `grapheme-splitter` or a Unicode emoji range, but adds a dependency. Waqas must decide: basic length cap only, or strict emoji validator. | Waqas |
| 5 | `@IsUrl` rejects localhost URLs by default. If the WA server is expected to fetch media from `localhost` in development or integration tests, `@IsUrl({ allow_underscores: true, require_tld: false })` may be needed, or a custom env-aware validator. Waqas should decide. | Waqas |

---

## Out of Scope

- Dashboard API DTOs (separate package — `packages/dashboard-api/`)
- Swagger / OpenAPI `@ApiProperty()` decorators (v1.1 item)
- Rate limiting per endpoint (v1.2 item)
- The `:messageId` param format validation beyond length (message IDs are opaque WA identifiers)
- v2 features of any kind
