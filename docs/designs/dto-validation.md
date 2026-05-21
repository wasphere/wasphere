# DTO Validation Design

**Branch:** `fix/dto-validation`
**Scope:** v1 — WA Server (`packages/wa-server/src/`) only
**Bugs closed:** BUG-2, BUG-4, BUG-8, BUG-9, BUG-11, BUG-12
**Status:** Design approved — implementation may begin

---

## Goal

Every endpoint in `wa-server` that accepts user input must reject invalid input at the
NestJS pipe layer before it reaches a service or the Baileys adapter. This is done by:

1. Creating proper DTO classes in dedicated `*.dto.ts` files for every controller.
2. Applying decorators from `class-validator` and `class-transformer` to every field.
3. Updating the global `ValidationPipe` in `main.ts` to add `transform: true` and
   `forbidNonWhitelisted: true` (currently only `whitelist: true` is set).
4. `ValidateSessionIdPipe` source and controller wiring is already complete (added by
   security PR `fix/security-hardening-input`). BUG-11 and BUG-12 are confirmed closed.

---

## Bugs Closed

| Bug | Description | Fix |
|-----|-------------|-----|
| BUG-2 | `forEveryone` query param accepted as any string | `@Transform` to boolean + `@IsBoolean` in `DeleteMessageQueryDto` |
| BUG-4 | Poll options array has no size cap, `selectableCount` has no range | `@ArrayMinSize(2)`, `@ArrayMaxSize(12)`, per-option `@MaxLength(100)`, `@Min(1)` `@Max(12)` `@IsInt` |
| BUG-8 | `sendContact` vCard fields accept any characters enabling vCard injection | `@Matches` regex on `displayName` and `phoneNumber` |
| BUG-9 | Bulk contacts check has no array size cap — potential DoS | `@ArrayMaxSize(100)` on the `numbers` array |
| BUG-11 | `sessionId` path param validation | Closed by security PR `fix/security-hardening-input` — `src/common/validate-session-id.pipe.ts` exists and is wired to all four controllers. No action required in this PR. |
| BUG-12 | Same as BUG-11 | Confirmed fully closed by security PR. |

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

`transform: true` is required for `@Transform()` decorators (BUG-2 boolean coercion),
`@IsInt()` coercion, and `@ValidateNested` + `@Type()` on nested objects. **Approved.**

`forbidNonWhitelisted: true` rejects requests that send extra body properties with a 400
instead of silently stripping them. WaSphere is pre-1.0 with no external API consumers —
this is the right moment to enforce strict input. **Approved.**

---

## File Layout

All DTOs live in a `dto/` subdirectory inside each controller's module folder. The pipe
source goes in `src/common/`.

```
packages/wa-server/src/
  common/
    validate-session-id.pipe.ts   ← EXISTS (added by security PR — no changes needed)
    pattern.pipe.ts               ← NEW: PatternPipe factory (see Tricky Endpoints §4–6)
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

**BUG-11 / BUG-12 note:** `ValidateSessionIdPipe` is already wired to `GET /:id`,
`DELETE /:id`, and `POST /:id/logout` in this controller. Confirmed closed by security PR.

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

**Confirmed closed by security PR `fix/security-hardening-input`.**

`packages/wa-server/src/common/validate-session-id.pipe.ts` exists with the correct
implementation (regex `^[a-zA-Z0-9_-]{1,64}$`, throws `BadRequestException` with
`{ error: 'INVALID_SESSION_ID' }`). It is imported and applied to every `:sessionId` param
across all four controllers and to `:id` in `SessionsController`. No action required.

---

## Common Pipe — PatternPipe factory (NEW)

**Approved.** A single configurable `PatternPipe` factory replaces the need for three
separate pipe files (`ValidatePhoneNumberPipe`, `ValidateMessageIdPipe`,
`ValidateGroupIdPipe`). One file, used four times:

```typescript
// src/common/pattern.pipe.ts
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

export function PatternPipe(regex: RegExp, maxLength: number, errorCode = 'INVALID_PARAM') {
  @Injectable()
  class Pipe implements PipeTransform<string, string> {
    transform(value: string): string {
      if (!value || value.length > maxLength || !regex.test(value)) {
        throw new BadRequestException({ error: errorCode });
      }
      return value;
    }
  }
  return Pipe;
}

// Pre-built instances
export const ValidatePhoneNumberPipe = PatternPipe(/^[\d+@\w.]{1,40}$/, 40, 'INVALID_PHONE_NUMBER');
export const ValidateMessageIdPipe   = PatternPipe(/^[a-zA-Z0-9_-]{1,100}$/, 100, 'INVALID_MESSAGE_ID');
export const ValidateGroupIdPipe     = PatternPipe(/^[\d+@\w.]{1,40}$/, 40, 'INVALID_GROUP_ID');
```

Applied to:
- `ContactsController` — `@Param('number', ValidatePhoneNumberPipe)`
- `MessagesController` — `@Param('messageId', ValidateMessageIdPipe)` (edit + delete)
- `GroupsController` — `@Param('groupId', ValidateGroupIdPipe)`

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

### 3. URL fields — @IsUrl with NODE_ENV-aware localhost allowance

**Approved.** All fields carrying a URL (`url`, `imageUrl`) use `@IsUrl` with
`{ require_tld: true, require_protocol: true }`. This is stricter than `@IsString` alone
and prevents relative paths or `file://` URLs from reaching `safe-fetch`. It is
defence-in-depth on top of the existing SSRF guard.

`@IsUrl` rejects `localhost` and `127.0.0.1` by default. To allow local media in dev/test
environments without weakening production, apply the option conditionally:

```typescript
// shared helper — used wherever @IsUrl appears
export const URL_OPTIONS: IsURLOptions = process.env.NODE_ENV === 'production'
  ? { require_tld: true, require_protocol: true }
  : { require_tld: false, require_protocol: true, host_whitelist: [/^localhost(:\d+)?$/, /^127\.0\.0\.1(:\d+)?$/] };
```

The engineer should export this constant from a shared `src/common/validators.ts` file and
use `@IsUrl(URL_OPTIONS)` everywhere. No custom decorator wrapper is needed.

### 4. sessionId and :number path params

`ValidateSessionIdPipe` already covers `:sessionId`. The `:number` param in
`ContactsController` is guarded by `ValidatePhoneNumberPipe` from the `PatternPipe` factory
(see Common Pipe — PatternPipe factory section above). **Both in scope. Approved.**

### 5. messageId path param

`@Param('messageId')` in `MessagesController` (edit and delete) is guarded by
`ValidateMessageIdPipe` from the `PatternPipe` factory. **In scope. Approved.**

### 6. groupId path param

`@Param('groupId')` in `GroupsController` is guarded by `ValidateGroupIdPipe` from the
`PatternPipe` factory. **In scope. Approved.**

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

## Design Decisions (all resolved)

| # | Question | Decision |
|---|----------|----------|
| 1 | `forbidNonWhitelisted: true` — breaking change? | **YES, apply now.** Pre-1.0, no external consumers. |
| 2 | `transform: true` in `ValidationPipe` | **YES, required** for `@Transform`, `@IsInt`, `@ValidateNested`. |
| 3 | `ValidatePhoneNumberPipe` + `ValidateGroupIdPipe` + `ValidateMessageIdPipe` | **YES, all in scope.** Implemented via single `PatternPipe` factory. |
| 4 | `@IsUrl` on URL fields — localhost in dev? | **YES, `@IsUrl` with NODE_ENV-aware `URL_OPTIONS` constant.** See Tricky Endpoints §3. |
| 5 | 20 DTO files across 4 `dto/` folders | **YES, approved.** Optional: shared `JidDto` or `@IsJid()` decorator — not a blocker for this PR. |

### Emoji validation (Risk #4 from original design)

`@MaxLength(8)` on `sendReaction.emoji` is sufficient for this PR. A strict emoji validator
(Unicode range check, grapheme splitter) adds a dependency and is not a blocker.

**Action:** Open a GitHub issue after this PR merges: "v1.2: strict emoji validator for
sendReaction (currently length-capped only)." The engineer must not add this to this PR.

---

## Out of Scope

- Dashboard API DTOs (separate package — `packages/dashboard-api/`)
- Swagger / OpenAPI `@ApiProperty()` decorators (v1.1 item)
- Rate limiting per endpoint (v1.2 item)
- The `:messageId` param format validation beyond length (message IDs are opaque WA identifiers)
- v2 features of any kind
