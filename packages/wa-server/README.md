# WaSphere WA Server

Standalone WhatsApp binary — runs on Linux, Windows, and Mac.
Connects to WaSphere Dashboard via IP + Port + Token.

## Quick Start

```bash
# Linux / Mac
WA_TOKEN=your-secret-here ./wa-server-linux --port 3001

# Windows
set WA_TOKEN=your-secret-here && wa-server-win.exe --port 3001

# Or via Node (dev mode)
WA_TOKEN=your-secret-here npm run dev -- --port 3001
```

Then in WaSphere Dashboard → Add WA Server:
- Host: `your-server-ip` (or `localhost` if local)
- Port: `3001`
- Token: `YOUR_SECRET_TOKEN`

## API Endpoints

All endpoints require header: `X-Api-Token: YOUR_SECRET_TOKEN`

### Sessions
| Method | Path | Description |
|---|---|---|
| GET | /api/sessions | List all sessions |
| POST | /api/sessions | Create new session (starts QR) |
| GET | /api/sessions/:id | Get session info + QR |
| DELETE | /api/sessions/:id | Delete session |
| POST | /api/sessions/:id/logout | Logout from WhatsApp |

### Messages
| Method | Path | Description |
|---|---|---|
| POST | /api/sessions/:id/messages/text | Send text |
| POST | /api/sessions/:id/messages/image | Send image |
| POST | /api/sessions/:id/messages/video | Send video |
| POST | /api/sessions/:id/messages/audio | Send audio/voice note |
| POST | /api/sessions/:id/messages/document | Send document |
| POST | /api/sessions/:id/messages/sticker | Send sticker |
| POST | /api/sessions/:id/messages/location | Send location |
| POST | /api/sessions/:id/messages/contact | Send contact card |
| POST | /api/sessions/:id/messages/buttons | Send buttons |
| POST | /api/sessions/:id/messages/list | Send list |
| POST | /api/sessions/:id/messages/poll | Send poll |
| POST | /api/sessions/:id/messages/reaction | Send reaction |
| POST | /api/sessions/:id/messages/gif | Send GIF |
| POST | /api/sessions/:id/messages/view-once | Send view-once |
| POST | /api/sessions/:id/messages/:msgId/edit | Edit message |
| DELETE | /api/sessions/:id/messages/:msgId | Delete message |
| POST | /api/sessions/:id/messages/read | Mark as read |
| POST | /api/sessions/:id/messages/typing | Send typing indicator |

### Groups
| Method | Path | Description |
|---|---|---|
| GET | /api/sessions/:id/groups | Get all groups |
| POST | /api/sessions/:id/groups | Create group |
| GET | /api/sessions/:id/groups/:gid | Get group info |
| PUT | /api/sessions/:id/groups/:gid/name | Update name |
| PUT | /api/sessions/:id/groups/:gid/description | Update description |
| POST | /api/sessions/:id/groups/:gid/participants/add | Add participants |
| POST | /api/sessions/:id/groups/:gid/participants/remove | Remove participants |
| POST | /api/sessions/:id/groups/:gid/participants/promote | Promote to admin |
| POST | /api/sessions/:id/groups/:gid/participants/demote | Demote from admin |
| POST | /api/sessions/:id/groups/:gid/leave | Leave group |
| GET | /api/sessions/:id/groups/:gid/invite-link | Get invite link |
| POST | /api/sessions/:id/groups/:gid/invite-link/revoke | Revoke invite link |
| POST | /api/sessions/:id/groups/join | Join by invite code |

### Contacts & Profile
| Method | Path | Description |
|---|---|---|
| GET | /api/sessions/:id/profile | Get own profile |
| POST | /api/sessions/:id/profile/name | Update name |
| POST | /api/sessions/:id/profile/about | Update about |
| POST | /api/sessions/:id/profile/picture | Update profile picture |
| GET | /api/sessions/:id/contacts/:num/check | Check if on WhatsApp |
| POST | /api/sessions/:id/contacts/check-bulk | Check multiple numbers |
| GET | /api/sessions/:id/contacts/:num/picture | Get profile picture |
| GET | /api/sessions/:id/contacts/:num/about | Get about/status |
| POST | /api/sessions/:id/contacts/:num/block | Block contact |
| POST | /api/sessions/:id/contacts/:num/unblock | Unblock contact |

### Health
| Method | Path | Description |
|---|---|---|
| GET | /api/health | Server health (public, no token needed) |

## Webhook Events

Set your dashboard callback URL:
```
POST /api/webhooks/callback
{ "url": "https://your-dashboard.com/wa-events" }
```

Events fired:
- `session.qr` — new QR code ready
- `session.connected` — session connected
- `session.disconnected` — session disconnected  
- `session.logged_out` — user logged out
- `session.failed` — max retries exceeded
- `session.deleted` — session deleted
- `message.received` — incoming message
- `messages.update` — message status update (sent/delivered/read)
- `message.receipt` — read receipts
- `presence.update` — contact online/typing status
- `groups.update` — group info changed
- `group.participants.update` — participants added/removed
- `contacts.update` — contact info changed
- `call` — incoming call

## Session Files

Sessions are stored in `./sessions/{sessionId}/` folder.
To migrate sessions: copy the folder to new machine, sessions auto-restore on restart.

## Environment Variables

```
PORT=3001
WA_TOKEN=your_secret_token
DASHBOARD_WEBHOOK_URL=https://your-dashboard.com/wa-events
```
