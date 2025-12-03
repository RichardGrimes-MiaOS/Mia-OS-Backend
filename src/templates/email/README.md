# Email Templates

This directory contains HTML email templates for automated email notifications.

## Available Templates

### application-received.html

Sent to applicants when they submit an application through the landing page.

**Template Variables:**
- `{{firstName}}` - Applicant's first name
- `{{lastName}}` - Applicant's last name
- `{{email}}` - Applicant's email address
- `{{organization}}` - Organization name
- `{{primaryState}}` - Primary state
- `{{submittedDate}}` - Date of submission (formatted)
- `{{currentYear}}` - Current year for copyright

**Theme Colors:**
- Primary Background: `#000000` (Black)
- Primary Accent: `#00E5FF` (Vice Blue)
- Secondary Accent: `#FF00E6` (Vice Pink)

## Customization

### Adding Your Logo

Replace line 85 in `application-received.html`:

```html
<!-- Current placeholder -->
<div style="font-family: 'Arial Black', Arial, sans-serif; font-size: 32px; font-weight: 900; color: #00E5FF; letter-spacing: 2px;">
    MIA
</div>

<!-- Replace with your logo image -->
<img src="https://yourdomain.com/logo.png" alt="MIA Logo" width="120" style="display: block; margin: 0 auto;">
```

### Modifying Text Content

Edit the HTML file directly. Key sections:
- **Hero Icon**: Line 95 (checkmark symbol)
- **Main Heading**: Line 105 ("Application Received!")
- **Body Text**: Line 118 (confirmation message)
- **Info Box**: Line 127 ("What happens next?")
- **Footer**: Line 233 (copyright and legal text)

### Testing Changes

After making changes, test the email:

1. Send a test application through the API
2. Or use the email service test endpoint (if implemented)
3. Check rendering in multiple email clients:
   - Gmail (web & mobile)
   - Outlook (desktop & web)
   - Apple Mail (iOS & macOS)
   - Android native email app

## Email Client Compatibility

The template is built for maximum compatibility:

✅ Gmail (web, iOS, Android)
✅ Outlook (2007-2021, 365, web)
✅ Apple Mail (iOS, macOS)
✅ Yahoo Mail
✅ AOL Mail
✅ Samsung Email
✅ Thunderbird

## Best Practices

1. **Always test after changes** - Email HTML is fragile
2. **Keep images small** - Large images slow loading
3. **Use inline styles** - Email clients strip `<style>` tags
4. **Provide alt text** - For accessibility and when images don't load
5. **Include plain text version** - Auto-generated in EmailService
6. **Test on mobile** - 50%+ of emails are opened on mobile

## Technical Notes

- Uses table-based layout (required for email)
- Inline CSS for maximum compatibility
- Responsive design with media queries
- Includes MSO conditional comments for Outlook
- Gradient background fallback for older clients
- Maximum width: 600px (industry standard)
