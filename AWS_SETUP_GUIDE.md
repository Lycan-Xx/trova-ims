# AWS Aurora PostgreSQL Setup Guide for Trova

This guide walks you through setting up Trova to connect to AWS Aurora PostgreSQL using IAM authentication via Vercel OIDC.

## Overview

Trova uses **IAM database authentication** instead of hardcoded passwords. This means:
- No database passwords stored in environment variables
- Vercel uses OIDC to assume an AWS IAM role
- That role has temporary credentials to connect to Aurora
- Connection is encrypted and auditable

## Prerequisites

- AWS Account with an Aurora PostgreSQL cluster already created
- Vercel project connected to GitHub
- AWS CLI (optional, for testing)

## Step 1: Get Your Aurora Details

In the AWS RDS console, find your Aurora cluster and note:

1. **Cluster Endpoint** (e.g., `mydb-cluster.c123abc456.eu-west-2.rds.amazonaws.com`)
   - This becomes `PGHOST`

2. **Region** (e.g., `eu-west-2`)
   - This becomes `AWS_REGION`

3. **Database Username** (e.g., `postgres`)
   - This becomes `PGUSER`
   - Make sure this user is configured for IAM authentication in RDS

4. **Database Name** (e.g., `trovadb`)
   - This becomes `PGDATABASE`

5. **AWS Account ID**
   - Go to AWS Account Settings → find your 12-digit Account ID

## Step 2: Create IAM Role for Vercel

In the AWS IAM console:

### 2.1 Create a Role

1. Go to **IAM → Roles → Create role**
2. Select **Web identity** as the trusted entity type
3. For the identity provider:
   - Choose **OpenID Connect**
   - Provider URL: `https://oidc.vercel.com`
   - Audience: `VercelOIDCToken`
4. Click **Next**
5. On the permissions page, create or attach a policy with:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "rds-db:connect"
      ],
      "Resource": [
        "arn:aws:rds:eu-west-2:YOUR_ACCOUNT_ID:db:*"
      ]
    }
  ]
}
```

Replace:
- `eu-west-2` with your Aurora region
- `YOUR_ACCOUNT_ID` with your AWS Account ID

6. Give the role a name: `VercelTrovaAuroraRole`
7. Create the role

### 2.2 Configure Trust Policy

1. Go to the role you just created
2. Click on the **Trust relationships** tab
3. Click **Edit trust policy**
4. Replace the policy with:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/oidc.vercel.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "oidc.vercel.com:aud": "VercelOIDCToken"
        },
        "StringLike": {
          "oidc.vercel.com:sub": "VercelDeployment:YOUR_VERCEL_PROJECT_ID:*"
        }
      }
    }
  ]
}
```

Replace:
- `YOUR_ACCOUNT_ID` with your AWS Account ID
- `YOUR_VERCEL_PROJECT_ID` with your Vercel project ID (found in Vercel project settings)

5. Save

## Step 3: Enable IAM Authentication on Aurora

In the AWS RDS console:

1. Select your Aurora cluster
2. Go to **Database Authentication**
3. Enable **IAM database authentication**
4. Modify your database user for IAM:

```sql
-- Connect to your Aurora database as admin
-- Modify the user to use IAM authentication
ALTER USER postgres WITH AUTH TYPE SCRAM-SHA-256;

-- Or for a new user:
CREATE USER iamuser WITH AUTH TYPE SCRAM-SHA-256;
GRANT rds_iam TO iamuser;
```

## Step 4: Set Environment Variables in Vercel

In your Vercel project settings (**Settings → Environment Variables**), add:

```
AWS_REGION=eu-west-2
AWS_ROLE_ARN=arn:aws:iam::YOUR_ACCOUNT_ID:role/VercelTrovaAuroraRole
PGHOST=mydb-cluster.c123abc456.eu-west-2.rds.amazonaws.com
PGUSER=postgres
PGDATABASE=trovadb
PGSSLMODE=require
BETTER_AUTH_SECRET=<generate-with-openssl-rand-base64-32>
MIGRATION_SECRET=<generate-with-openssl-rand-base64-32>
TRUSTED_ORIGINS=https://trova-ims.vercel.app
```

Generate the secrets:
```bash
openssl rand -base64 32
openssl rand -base64 32
```

## Step 5: Run Migrations

After deploying with all environment variables set:

1. Visit: `https://trova-ims.vercel.app/api/migrate?secret=YOUR_MIGRATION_SECRET`
2. You should see: `{"ok":true,"message":"Migration complete. 39/39 statements succeeded."}`

## Step 6: Test Signup

Try creating an account at `https://trova-ims.vercel.app/sign-up`

If it fails:
- Check Vercel logs: https://vercel.com/dashboard → your project → Deployments → latest → Logs
- Look for "Invalid origin", "BETTER_AUTH_SECRET", or AWS credential errors

## Troubleshooting

### Error: "Invalid origin"
**Fix:** Add the domain to `TRUSTED_ORIGINS` in Vercel env vars

### Error: "BETTER_AUTH_SECRET is not set"
**Fix:** Generate and add `BETTER_AUTH_SECRET` to Vercel env vars:
```bash
openssl rand -base64 32
```

### Error: "Could not assume role"
**Fix:** 
1. Check `AWS_ROLE_ARN` is correct
2. Verify the role's trust policy includes your Vercel project ID
3. Verify the role has `rds-db:connect` permission

### Error: "Connection refused" or "Network error"
**Fix:**
1. Check `PGHOST`, `PGUSER`, `PGDATABASE` are correct
2. Verify Aurora security group allows inbound on port 5432
3. Verify IAM user has `AUTH TYPE SCRAM-SHA-256` (or matching auth type)

### Error: "Authentication failed"
**Fix:**
1. Ensure the database user is configured for IAM auth
2. Run: `ALTER USER postgres WITH AUTH TYPE SCRAM-SHA-256;`
3. Redeploy Vercel project

## Testing Locally

If you want to test locally with Aurora:

1. Set up your `.env.local`:
```
AWS_REGION=eu-west-2
AWS_ROLE_ARN=arn:aws:iam::YOUR_ACCOUNT_ID:role/VercelTrovaAuroraRole
PGHOST=mydb-cluster.c123abc456.eu-west-2.rds.amazonaws.com
PGUSER=postgres
PGDATABASE=trovadb
PGSSLMODE=require
BETTER_AUTH_SECRET=<your-secret>
```

2. Your local AWS credentials (via `~/.aws/credentials` or env vars) will be used to assume the role

3. Run: `pnpm dev`

## Next Steps

- Run the migration endpoint once after deploying
- Test signup
- Configure your domain in `TRUSTED_ORIGINS` if using a custom domain
- Monitor AWS CloudTrail for IAM authentication logs
