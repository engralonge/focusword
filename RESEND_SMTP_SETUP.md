# Resend SMTP setup

Citizens Bible Community uses Supabase Auth for confirmation, password-reset,
magic-link, and invitation email. Resend is configured in Supabase; the mobile
app never receives the Resend API key.

## 1. Create and secure the Resend account

1. Create an account at <https://resend.com>.
2. Enable multi-factor authentication for the account.
3. In **API Keys**, create a key named `Supabase Auth - Production`.
4. Grant **Sending access** only. Copy the key once and keep it in a password
   manager until it is entered in Supabase.

Do not put this key in `.env.local`, an `EXPO_PUBLIC_*` variable, EAS, GitHub,
the Expo app, or a Supabase Edge Function secret. For SMTP, Supabase stores it.

## 2. Verify the sending domain

A verified domain is required to send production email to community members.
Resend's test domain is limited and is not suitable for public signup.

Prefer a dedicated authentication subdomain, for example:

```text
auth.citizensbiblecommunity.org
```

In **Resend Dashboard -> Domains -> Add Domain**, add the subdomain. Copy every
DKIM, SPF/MX, and recommended DMARC record into the domain's DNS provider.
Wait until Resend reports the domain as **Verified**.

Use a sender such as:

```text
no-reply@auth.citizensbiblecommunity.org
```

Keep authentication mail separate from newsletters or marketing campaigns.

## 3. Configure Supabase SMTP

Open **Supabase Dashboard -> Authentication -> SMTP Settings**, enable custom
SMTP, and enter:

| Setting | Value |
| --- | --- |
| Sender email | `no-reply@auth.citizensbiblecommunity.org` |
| Sender name | `Citizens Bible Community` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | The restricted Resend API key |

Port `465` uses implicit TLS. Resend also supports port `587` with STARTTLS if
the Supabase connection has difficulty on `465`.

Save the settings. In **Authentication -> Rate Limits**, choose an email limit
that fits the Resend plan and expected signup volume. Supabase initially applies
a low custom-SMTP limit; increase it cautiously and never above the provider's
allowance.

## 4. Configure Supabase Auth URLs

In **Authentication -> URL Configuration**, keep these redirect URLs:

```text
focusword://auth/callback
focusword://auth/reset-password
```

Keep **Confirm email** enabled. Do not enable automatic confirmation to work
around delivery problems.

Review the **Confirm signup** and **Reset password** templates. Keep them short,
transactional, and clearly branded. Preserve Supabase's confirmation variables
and avoid marketing copy, multiple links, or large images.

## 5. Test safely

1. Install a development, preview, or production build. Expo Go does not provide
   a stable custom-scheme callback.
2. Sign up with a new address on a different email provider.
3. Confirm that Resend shows a delivered message and that the email is not in
   spam.
4. Tap the confirmation link. It should open Citizens Bible Community and
   establish the verified session.
5. Sign out and sign back in.
6. Test **Forgot password** and the in-app **Resend confirmation email** action.
7. Repeat with Gmail, Outlook, and Yahoo/iCloud addresses before release.

If delivery fails, inspect Supabase Auth logs and Resend's email activity. Do
not repeatedly press resend because per-address and project rate limits still
apply.

## Production safeguards

- Enable Supabase CAPTCHA before opening public signup.
- Keep email confirmations enabled.
- Monitor bounces and complaints in Resend.
- Publish working support and privacy-policy URLs.
- Rotate the Resend key immediately if it is exposed.
- Use a separate sending domain and credentials for marketing email.
