# Security Specification — Refugio Repalet

## 1. Data Invariants
1. **Default-Deny Baseline**: Every path not explicitly matched is denied for both read and write.
2. **Verified Host Whitelist Only**: Only authenticated Google users with `email_verified == true` whose lowercase email is either the bootstrap owner (`claudiocrog@gmail.com`) or present in `/access/hosts.emails` can read or write operational data.
3. **Zero PII Leakage**: Unlisted authenticated users cannot `get` or `list` `/reservations` (which contain guest names and WhatsApp numbers) or `/access/hosts` (which contains host emails).
4. **Immutable Authorship & Server Timestamps**: `createdBy` and `createdAt` cannot change after creation; `createdAt` on create and `updatedAt` on write must equal `request.time`.
5. **Bounded Types & Strict Schema**: Only explicitly allowlisted keys are permitted (`keys().hasOnly(...)`), strings enforce `.size()` bounds, dates enforce `YYYY-MM-DD` regex with `checkOut > checkIn`, and `allowedEmails` is bounded to 1–5 items containing `claudiocrog@gmail.com`.
6. **Path Variable Hardening**: All document IDs (`accessId`, `reservationId`) must match `^[a-zA-Z0-9_\-]+$` with length <= 128.
7. **Cost-Safe List Queries**: `allow list` on `/reservations` never executes `get()` or `exists()`; it enforces `request.auth.token.email.lower() in resource.data.allowedEmails`.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated List**: Anonymous/signed-out request listing `/reservations`.
2. **Unlisted Verified User List**: Signed-in Google user (`stranger@gmail.com`) listing `/reservations`.
3. **Unverified Email Spoofing**: Token with `email: 'claudiocrog@gmail.com'` and `email_verified: false`.
4. **ID Poisoning**: Creating `/reservations/bad$id/../../../x` or ID > 128 chars.
5. **Shadow / Ghost Field**: Creating a reservation with an extra `isAdmin: true` field.
6. **Missing Required Field**: Creating a reservation omitting `checklist` or `allowedEmails`.
7. **Invalid Date Range**: Creating a reservation where `checkOut <= checkIn` or malformed date `"25-11-2026"`.
8. **Oversized Notes Payload**: Creating a reservation with `notes` > 1000 characters.
9. **Client Timestamp Tampering**: Creating a reservation with client-supplied `createdAt` != `request.time`.
10. **Immutable Owner Tampering**: Updating a reservation and changing `createdBy` to another UID.
11. **Removing Bootstrap Host from Access**: Updating `/access/hosts` without `'claudiocrog@gmail.com'` in `emails`.
12. **Blanket List on Access**: Attempting to `list` `/access` collection.
