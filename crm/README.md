# Enquiry CRM (Google Sheet)

Every contact-form submission is saved as a row in a Google Sheet, then WhatsApp opens as before.

## One-time setup

1. Create a new Google Sheet (e.g. "ISHQ KNOT Leads").
2. **Extensions → Apps Script**. Delete the sample code and paste in `apps-script.gs`. Save.
3. In the function dropdown pick `setup` and click **Run** (approve the permissions prompt).
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the Web app URL (ends in `/exec`) and paste it into `CRM_URL` at the bottom of `script.js`.
6. Deploy the site (`npx wrangler deploy`).

If you later edit the script, use **Deploy → Manage deployments → Edit → New version** so the URL stays the same.

## Using it

Each lead arrives with Status **New**. Move it through
New → Contacted → Quoted → Booked → Shot → Delivered (or Lost),
and use the Follow-up and Notes columns. Filter or sort by Status / Follow-up to see what needs attention.
