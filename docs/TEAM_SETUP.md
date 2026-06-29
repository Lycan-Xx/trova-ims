# Team Invitation System - Setup & Usage Guide

## Setup Steps

### 1. Run Database Migration
Execute the migration to create the `invitations` table:

```bash
psql $DATABASE_URL < scripts/003-add-invitations-table.sql
```

Or manually run the SQL in `scripts/003-add-invitations-table.sql` on your database.

### 2. Update Signup Handler (Already Done)
The `lib/auth/first-run.ts` is already configured to:
- Make the **first user an owner**
- Check for pending invitations
- Auto-accept invites when invited user signs up

## User Flow

### Owner Inviting Team Members

1. **Owner Signs In** → First user gets `owner` role automatically
2. **Go to Settings** (dashboard bottom menu)
3. **Team Management Section:**
   - Enter team member's email
   - Select role: 
     - **Cashier** - Can record sales
     - **Storekeeper** - Can manage inventory + sales
   - Click "Send Invitation"
4. **Invitation sent** with 7-day expiration

### Team Member Joining

1. **Receives invitation link**: `https://yourapp.com/join?token=...`
2. **Clicks link** to accept invitation
3. **Signs up with that email**
4. **Account created** with assigned role
5. **Can now log in and work!**

## Managing Team

### Updating Roles
- Click role dropdown next to team member name
- Select new role (Cashier ↔ Storekeeper)
- Changes apply immediately

### Removing Members
- Click "Remove" button
- Member account deactivated
- Can be reactivated by owner if needed

### Canceling Pending Invites
- Click "Cancel" in Pending Invitations section
- Invitation expires
- Send new one if needed

## API Reference

### Server Actions (in `app/actions/invitations.ts`)

```typescript
// Send invitation
sendInvitation(email, role) 
  // Returns: { success: true, invitationId } | { success: false, error }

// Accept invitation (called when user clicks link)
acceptInvitation(token)
  // Returns: { success: true, storeId } | { success: false, error }

// Get team members
getTeamMembers()
  // Returns: { success: true, data: TeamMember[] } | { success: false, error }

// Get pending invitations
getPendingInvitations()
  // Returns: { success: true, data: PendingInvitation[] } | { success: false, error }

// Update member role
updateMemberRole(memberId, newRole)
  // Returns: { success: true } | { success: false, error }

// Remove member
removeMember(memberId)
  // Returns: { success: true } | { success: false, error }

// Cancel pending invite
cancelInvitation(invitationId)
  // Returns: { success: true } | { success: false, error }
```

## Permissions

### Owner Can:
- ✅ Invite team members
- ✅ Change member roles
- ✅ Remove members
- ✅ View all data
- ✅ Manage store settings

### Storekeeper Can:
- ✅ View/manage inventory (batches, products)
- ✅ Record sales
- ✅ View analytics
- ❌ Manage team
- ❌ Change store settings

### Cashier Can:
- ✅ Record sales only
- ❌ Manage inventory
- ❌ View analytics
- ❌ Manage team

## Customization Ideas

### Email Notifications
In `acceptInvitation()`, add email sending:
```typescript
await sendEmail(email, 'Join StockSmart', invitationUrl)
```

### Role Permissions
Extend the permissions system in pages/actions to check roles:
```typescript
if (user.role !== 'storekeeper' && user.role !== 'owner') {
  return { success: false, error: 'Access denied' }
}
```

### Expiration Handling
Adjust expiration in `sendInvitation()`:
```typescript
const expiresAt = new Date()
expiresAt.setDate(expiresAt.getDate() + 14) // 14 days instead of 7
```

## Troubleshooting

### Invitation Link Not Working
- Check token is correct in URL
- Verify invitation hasn't expired (7 days max)
- Check user email matches invitation email exactly

### User Can't Sign In After Accepting
- Verify user signed up with same email as invitation
- Check user role is correct in database
- Ensure `is_active = true` in database

### Can't See Team Management
- Only owners can invite - check user role is 'owner'
- Refresh browser if recently promoted
