# Users & invitations

Administrators invite other people with one-time links and manage existing accounts on the *Users* page. Whoever opens a link picks their own username and password, gets the role chosen in the link, and is signed in. Sign-in, sessions and the role model itself are described in [authentication.md](authentication.md).

## User perspective

### What it does

- **Create an invite link** (admins). Choose the role (*Member* or *Admin*) and how long the link stays valid (**1 h**, **24 h** or **7 days**), then press *Create invite link*. The link is shown once, with *Copy* and, on phones, *Share*.
- **Pending links** are listed below the form with their role, creator and expiry, and can be **revoked**.
- **Accept an invite.** The invite page (`/invite/<token>`) shows who sent the link and the role. The new user picks a username and password and is signed in straight away.
- **Accounts list** (admins). Every account with its role and creation date. *Make admin* / *Make member* changes the role, *Remove* deletes the account after a confirmation.
- Changes apply immediately: a removed user is signed out on every device on their next request, and a new role applies without signing in again.

### Usage scenarios

- **Adding the household.** Create a *Member* link valid for 24 h and send it over a messenger.
- **A second administrator.** Invite someone as *Admin*, or promote an existing member.
- **Someone left, or a phone was lost.** Remove the account. All of that user's sessions stop working at once.
- **A link was sent to the wrong chat.** Revoke it in the pending list.

### Limitations

- **The link uses the address the admin is browsing from.** A link created on `http://localhost:3000` does not work on another device. Create links from the server's LAN address.
- **Share needs a secure origin** (HTTPS or `localhost`), so over plain HTTP in the LAN only *Copy* is offered. *Copy* falls back to the legacy copy command there, and if that fails too, the link is selected so it can be copied by hand.
- **No email delivery.** NodePilot only creates the link; sending it is up to you.
- **You can't remove or demote yourself.** This guarantees that at least one admin remains, but it also means an admin can only leave by asking another admin.
- **Removing a user also removes the invite links they created.**
- **No password reset for other users.** An admin can't set another user's password. Remove the account and send a new invite instead.
- **Usernames can't be changed** after the account is created.

## Developer perspective

### How it works

```
Admin ── POST /api/invitations { role, validForHours } ─► InvitationService.CreateAsync
           token = base64url(32 random bytes), store SHA-256(token) + role + expiry
           ◄── 201 { id, token, role, expiresAtUtc }   (the only time the token exists)
Web     ── builds <origin>/invite/<token>

Invitee ── GET  /api/invite/{token}         ─► PreviewAsync  → { role, invitedBy, expiresAtUtc } or 404
Invitee ── POST /api/invite/{token}/accept  ─► AcceptAsync   → new UserAccount(role), accepted_at_utc = now
           ◄── 201 + session cookie
```

- **Tokens** (`InvitationService`): 32 bytes from `RandomNumberGenerator` (256 bits), base64url without padding. Only the lowercase hex SHA-256 is stored (`invitations.token_hash`, unique index), so the database alone does not reveal usable links. Tokens longer than 128 characters are rejected before hashing.
- **Usable** means `accepted_at_utc IS NULL` and `expires_at_utc > now` (`Invitation.IsUsable`). Unknown, expired, used and revoked links all return the same `404 Invitations.InvalidOrExpired`, so the response never reveals whether a guessed token existed.
- **Lifetime:** `validForHours` must be 1–168 (`400 Invitations.InvalidLifetime`). The defaults are `Member` and 24 h.
- **Cleanup:** creating a new invitation deletes expired ones (`RemoveExpiredAsync`). Accepted invitations stay in the table as a record.
- **Accepting** validates the username and password with the same rules as setup, then runs under a static `SemaphoreSlim`. Inside it, the link is re-checked and the username is checked for uniqueness. Without the lock, two concurrent requests with one link could create two accounts. A taken username returns `409 Accounts.UsernameTaken` and leaves the link usable.
- **Users** (`AccountService`):
  - `ListUsersAsync` returns `{ id, username, role, createdAtUtc }`.
  - `ChangeRoleAsync` and `RemoveUserAsync` reject the acting user's own id with `400 Accounts.CannotModifySelf`.
  - Removal deletes the row. `invitations.created_by_user_id` cascades, so that user's links disappear too.
  - The cookie handler's per-request account check (see [authentication.md](authentication.md)) is what signs removed users out and applies new roles.
- **Authorization:** `UsersController` and `InvitationsController` carry `[Authorize(Policy = "Admin")]`. `InviteController` (`/api/invite`) is `[AllowAnonymous]`.

### Implementation details & gotchas

- **Rate limiting:** `accept` shares the `login` limiter (per IP). The preview endpoint is deliberately *not* limited: a 256-bit token can't be guessed, and limiting it would lock people out just for refreshing the invite page.
- **Invite page errors:** only a `404` shows "invalid link". Other errors (for example `429`) show a message with *Retry*, and an unreachable backend shows the offline screen.
- **`ChangeRoleRequest.Role` is nullable**, so a body without `role` is rejected instead of silently defaulting to `Admin` (enum value `0`).
- **Both semaphores are process-wide statics.** That is fine for a single backend instance with SQLite. With several instances, the unique username index is the last line of defence.
- **Logging:** creation, acceptance, role changes and removals are logged at Information level with user ids. There is no audit table.

### Configuration

There are no dedicated settings. Invite acceptance shares `Auth:LoginAttemptsPerMinute`.

### API

| Method | Path | Auth | Result |
|---|---|---|---|
| GET | `/api/users` | admin | `200 UserSummary[]` |
| PUT | `/api/users/{id}/role` | admin | `{ role }` → `200 UserSummary`, `400` (own account, invalid role), `404` |
| DELETE | `/api/users/{id}` | admin | `204`, `400` (own account), `404` |
| GET | `/api/invitations` | admin | `200 InvitationSummary[]`: unused, unexpired links |
| POST | `/api/invitations` | admin | `{ role, validForHours }` → `201 { id, token, role, expiresAtUtc }`, or `400` |
| DELETE | `/api/invitations/{id}` | admin | `204` or `404` |
| GET | `/api/invite/{token}` | public | `200 { role, invitedBy, expiresAtUtc }` or `404` |
| POST | `/api/invite/{token}/accept` | public, rate limited | `{ username, password }` → `201 { username, role }` and cookie, `400`, `404`, `409`, or `429` |

### Tests

- `InvitationServiceTests` (unit): the token is returned once and only its hash is stored, tokens are unique, lifetime limits, acceptance creates the invited role and works only once, expiry, a taken username leaves the link usable, unknown and expired tokens get the same error, revocation.
- `UsersAndInvitationsTests` (integration): an invite creates a member who can't manage users or settings, a revoked link stops working, an admin can't remove or demote themselves but can manage others, a removed user is signed out on the next request, a promoted member gets admin access without signing in again.

### Key files

- `apps/backend/src/NodePilot.Application/Accounts/Services/InvitationService.cs`
- `apps/backend/src/NodePilot.Application/Accounts/Services/AccountService.cs`
- `apps/backend/src/NodePilot.Application/Accounts/Models/Invitation.cs`
- `apps/backend/src/NodePilot.Api/Controllers/InvitationsController.cs` (also `InviteController`)
- `apps/backend/src/NodePilot.Api/Controllers/UsersController.cs`
- `apps/backend/src/NodePilot.Infrastructure/Persistence/Configurations/InvitationConfiguration.cs`
- `apps/web/src/app/(app)/users/page.tsx`
- `apps/web/src/components/users/invite-panel.tsx`
- `apps/web/src/components/users/user-list.tsx`
- `apps/web/src/app/invite/[token]/page.tsx`
