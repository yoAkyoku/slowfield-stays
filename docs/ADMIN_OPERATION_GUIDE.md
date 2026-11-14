# Admin Operation Guide

This guide covers the first-version back office workflow for site operators. The product is inquiry-first: do not treat any form submission as a paid booking or inventory hold.

## 1. Select the Current Site

1. Log in to `/admin`.
2. Use the site switcher in the left sidebar.
3. Confirm the selected site before editing CMS, stays, media, inquiries, newsletters, or email settings.

Each site has isolated content. Changes made in one site should not appear in another site.

## 2. Create a Child Site

1. Open Admin > Sites.
2. Choose Create site.
3. Fill site name, slug, domain, default language, colors, contact email, LINE, SEO title, and SEO description.
4. Choose a parent/template site if this is a same-template child site.
5. Save.

After creation, the new child site receives baseline CMS content only. Stays and media start empty.

## 3. Manage CMS Banners

1. Open Admin > CMS.
2. Choose Create banner.
3. Fill title and image first. Subtitle, CTA, order, and status can be adjusted later.
4. Use preview before publishing.
5. Move through draft, review, published, or archived.

Published banners appear in the homepage carousel from lower order to higher order.

## 4. Manage CMS Pages

1. Open Admin > CMS.
2. Choose Create page.
3. Select the fixed page slug, such as experience, privacy, dining, activities, journal, media coverage, PR, careers, or franchise.
4. Fill title, summary, body, cover image, tags, and SEO fields.
5. Preview, then publish when ready.

SEO title and description are recommended before publishing.

## 5. Manage Stays

1. Open Admin > Stays.
2. Choose Create stay.
3. Fill name, slug, destination, region, summary, story, hero image, base price, max guests, amenities, room types, gallery images, and SEO.
4. Use preview before publishing.
5. Publish only after hero image, summary, and at least one room type are ready.

Dates on the public website are inquiry conditions only. They do not reserve inventory.

## 6. Upload and Use Media

1. Open Admin > Media.
2. Upload an image and fill alt text when possible.
3. Use grid or list mode to find the image.
4. Copy the media URL into stay, banner, or page image fields.
5. Delete unused images only after checking they are not used by published content.

Deleting media removes the backend record and stored file.

## 7. Handle Inquiries

1. Open Admin > Inquiries.
2. Filter by keyword, status, or date range.
3. Read the message and reply by Email, phone, or LINE.
4. Move the status through new, contacted, quoted, and closed.
5. Export CSV when an offline handoff is needed.

Use this queue for general contact, PR, franchise, careers, and non-booking messages.

## 8. Handle Booking Requests

1. Open Admin > Booking Requests.
2. Review each lane: new, contacted, quoted, closed.
3. Confirm dates, room fit, guest count, and special requests manually.
4. Reply by Email or LINE.
5. Move the request to the next status after each operational step.

No payment or room inventory workflow exists in this version.

## 9. Configure Email and SMTP

1. Open Admin > Email.
2. Fill SMTP host, port, username, password, sender name, from email, and TLS setting.
3. Enable delivery only after the values are confirmed.
4. Save settings.
5. Send a test email to an internal mailbox.
6. Confirm the sender, delivery, and spam status.

Record the SMTP provider's sending limits before sending newsletters.

## 10. Send Newsletters

1. Open Admin > Newsletter.
2. Add subscribers and optional groups.
3. Create a campaign with subject, body, and target groups.
4. Queue the campaign.
5. Process pending emails in small batches.
6. Review sent, failed, skipped, and unsubscribed behavior.
7. Retry failed emails only after fixing the SMTP or content issue.

Every campaign email appends an unsubscribe link.

## 11. Manage Users and Roles

1. Open Admin > Users.
2. Create admin accounts with strong passwords.
3. Assign roles carefully.
4. Open Roles to review permission sets.
5. Use Site Permissions to control which users can access each site.
6. Archive users who no longer need access.

The owner role can manage all sites. Other users should receive only the access they need.

## 12. Review Login Activity

1. Open Admin > Login Analytics.
2. Filter by email, IP, result, or date range.
3. Look for repeated failures or unfamiliar IP addresses.
4. Archive unused accounts or rotate credentials if suspicious activity appears.

## 13. Pre-Publish Checklist

Before publishing public content:

- Images load correctly.
- Required fields are complete.
- SEO title and description are filled.
- Preview page looks correct.
- Correct site is selected.
- Status is changed to published only after review.

## 14. Production Notes

- Set `NEXT_PUBLIC_APP_ENV=production` in production.
- Change the bootstrap admin password after first login.
- Confirm database and media backups.
- Test SMTP with internal recipients before sending to real lists.
- Follow `docs/PRODUCTION_RUNBOOK.md` for deployment and backup tasks.
