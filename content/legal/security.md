---
title: How we keep your data safe
titleTl: Paano namin pinoprotektahan ang data mo
version: "1.0"
---

**Your money data is personal. Here's exactly how we protect it.**

### The short version

- We never ask for your bank or e-wallet password, PIN or OTP. WaiseKa cannot touch your money.
- Your data is encrypted while it travels and while it is stored.
- Only you can see your transactions. We do not sell data and we do not run ads.
- Bank statements you upload are deleted right after they are read.
- If something ever goes wrong, we tell you within 72 hours.

### How we protect your account

- **Hashed passwords.** Passwords are stored using bcrypt, a one-way hash. Not even we can see your password.
- **Secure sessions.** You stay logged in through a signed session token in a secure, HTTP-only cookie that page scripts cannot read.
- **Login protection.** Repeated failed logins are rate-limited to slow down password guessing.

### How we protect your data

- **Encrypted in transit.** Every connection to WaiseKa uses HTTPS (TLS).
- **Encrypted at rest.** Our database storage is encrypted by our database provider, MongoDB Atlas.
- **Your data stays yours.** Every request is checked against your account, and every database query is scoped to your user ID, so one user cannot read another's records.
- **Least privilege.** The app connects to the database with an account that has only the permissions it needs.
- **No secrets in code.** Keys and passwords live in protected environment settings, never in our source code.
- **Statements deleted after parsing.** Smart Import reads your file on our server, creates draft transactions, and deletes the file. It is not stored, shared, or used to train anything.

### How we run things

- **Restricted admin access.** Only the operator can access production systems, and every admin account uses multi-factor authentication.
- **Up-to-date software.** We monitor and update the libraries WaiseKa depends on to patch known vulnerabilities.
- **Breach response.** If a breach affects your personal data, we notify you and the National Privacy Commission within 72 hours of discovering it, as required by the Data Privacy Act.

### What you can do

- Use a strong password that you don't use anywhere else.
- Never share your WaiseKa login - and remember: we will never message you asking for your password, OTP, or bank details. Anyone who does is not us.
- Don't type full card or account numbers into notes or account names.
- Log out on shared or public devices.

### Found a security issue?

Please report it privately to {{SECURITY_EMAIL}} with steps to reproduce. We will acknowledge within 3 business days, keep you updated, and credit you if you'd like once it's fixed. Please don't access other users' data, disrupt the service, or disclose the issue publicly before we've fixed it. Good-faith research that follows these rules won't be pursued legally.

> **Sa madaling salita:** Hindi namin hinahawakan ang pera mo, naka-encrypt ang data mo, at ikaw lang ang nakakakita ng transactions mo. May nakita kang butas? Sabihan mo kami nang pribado.
