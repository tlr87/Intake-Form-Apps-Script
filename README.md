# RD3 Tech — Enquiry & Lead Processing System

A Google Apps Script-based enquiry processing system for RD3 Tech.

The system receives enquiries from a website form, stores the submitted
information in Google Sheets, evaluates the submission against configurable
keyword and urgency rules, and sends:

- An internal **Admin Notification** to RD3 Tech
- A **Client Confirmation** to the person who submitted the enquiry

The system is designed to provide a consistent workflow from:

**Website Form → Google Form/Submission → Google Sheets → Evaluation → Email Notifications**

---

## Table of Contents

- [Overview](#overview)
- [What the System Does](#what-the-system-does)
- [System Architecture](#system-architecture)
- [Form Data Structure](#form-data-structure)
- [Admin Email](#admin-email)
- [Client Email](#client-email)
- [Keyword Filtering](#keyword-filtering)
- [Alert System](#alert-system)
- [Alert Taxonomy](#alert-taxonomy)
- [Taxonomy Editor](#taxonomy-editor)
- [Review Required Alerts](#review-required-alerts)
- [Urgent Alerts](#urgent-alerts)
- [Spam Detection](#spam-detection)
- [How Keyword Matching Works](#how-keyword-matching-works)
- [How to Add or Modify Keywords](#how-to-add-or-modify-keywords)
- [How to Modify Alert Categories](#how-to-modify-alert-categories)
- [How to Modify the Form Fields](#how-to-modify-the-form-fields)
- [How to Modify the Admin Email](#how-to-modify-the-admin-email)
- [How to Modify the Client Email](#how-to-modify-the-client-email)
- [Google Forms and Google Sheets](#google-forms-and-google-sheets)
- [Production Reset](#production-reset)
- [Testing](#testing)
- [Safe Development Workflow](#safe-development-workflow)
- [Troubleshooting](#troubleshooting)
- [Common Mistakes](#common-mistakes)
- [Deployment](#deployment)
- [Security Considerations](#security-considerations)
- [Maintenance](#maintenance)
- [Handover Checklist](#handover-checklist)

---

# Overview

The RD3 Tech enquiry system is intended to turn a website enquiry into a
structured, actionable lead.

The system does not simply forward the form submission.

It also evaluates the enquiry for indicators that may require additional
attention.

For example, an enquiry may contain:

- A normal service request
- A request that requires manual review
- An urgent request
- Potential spam
- Keywords associated with specific technical issues
- Multiple conditions at the same time

The resulting admin notification can therefore contain status indicators
such as:

- `NEW INQUIRY`
- `REVIEW REQUIRED`
- `URGENT INQUIRY`
- `SPAM DETECTED`

The client receives a separate confirmation email without exposing
internal evaluation information.

---

# What the System Does

At a high level:

```text
Client
  │
  ▼
Website Enquiry Form
  │
  ▼
Google Form / Submission Handler
  │
  ▼
Form Responses
  │
  ▼
Apps Script Processing
  │
  ├── Normalise submission data
  │
  ├── Evaluate keywords
  │
  ├── Evaluate urgency
  │
  ├── Evaluate spam indicators
  │
  └── Generate evaluation reasons
  │
  ├───────────────────────┐
  ▼                       ▼
Admin Email           Client Email
  │                       │
  ▼                       ▼
Internal review       Client confirmation
System Architecture

The system consists of several logical components.

1. Website Form

The website collects the enquiry information.

The final form fields are:

Timestamp
Name
Email
Phone
Address / Location
Preferred Contact
Have You Used RD3 Tech Before?
I am contacting RD3 Tech as
What sounds like your situation?
What's happening and what would you like to achieve?
How Soon Do You Need Help?

These fields are the authoritative data structure for the enquiry.

2. Form Responses

Google Forms stores the responses in the connected Google Sheet.

The response sheet is expected to be named:

Form Responses

The header order should match the form.

Do not manually invent new columns unless the submission-processing code
has also been updated to understand them.

3. Apps Script

Google Apps Script performs the processing.

Typical responsibilities include:

Reading the submission
Normalising field names
Resolving compatibility fields
Evaluating keyword rules
Evaluating urgency
Evaluating spam indicators
Creating alert/review flags
Creating evaluation reasons
Rendering the email templates
Sending the admin email
Sending the client confirmation
Form Data Structure

The form currently uses the following field structure:

Field	Purpose
Timestamp	Time the enquiry was submitted
Name	Client name
Email	Client email address
Phone	Client phone number
Address / Location	Client location
Preferred Contact	Preferred communication method
Have You Used RD3 Tech Before?	Existing/new relationship indicator
I am contacting RD3 Tech as	Client type
What sounds like your situation?	Type of problem/request
What's happening and what would you like to achieve?	Detailed request
How Soon Do You Need Help?	Requested timeframe

The field:

I am contacting RD3 Tech as

replaces the previous generic:

Category

Do not reintroduce Category unless the entire processing system is
intentionally redesigned around that name.

Expected client-type values currently include:

Home user
Small business
Community organisation
Admin Email

The admin email is the internal notification sent to RD3 Tech.

It should contain the complete form submission.

The admin notification currently presents:

Timestamp
Name
Email
Phone
Address / Location
Preferred Contact
Have You Used RD3 Tech Before?
I am contacting RD3 Tech as
What sounds like your situation?
What's happening and what would you like to achieve?
How Soon Do You Need Help?

The admin email may also contain internal evaluation information.

For example:

🚩 REVIEW REQUIRED
🚨 URGENT INQUIRY

and:

⚠ Evaluation Flag Reasons

The evaluation information is for internal use only.

Client Email

The client receives an enquiry confirmation.

The client email contains the submitted information but should not expose
internal evaluation logic.

The client-facing summary includes:

Name
Email
Phone
Address / Location
Preferred Contact
Have You Used RD3 Tech Before?
I am contacting RD3 Tech as
What sounds like your situation?
What's happening and what would you like to achieve?
How Soon Do You Need Help?

The client email also explains what happens next.

Keyword Filtering

Keyword filtering is one of the most important parts of the system.

The purpose is not to automatically reject enquiries.

The purpose is to identify enquiries that deserve additional attention.

For example, a submission might contain:

TV aerial needs tuning nintendo broken

The evaluation engine can detect relevant terms and produce an internal
reason such as:

Goal / Desired Outcome matched review keyword(s): tv aerial, tv, tuned, nintendo

The exact keywords and categories should be maintained through the
configured taxonomy rather than scattered throughout the code.

Alert System

The system supports multiple types of alerts.

Alerts should be treated as signals, not automatic conclusions.

A keyword match does not necessarily mean the enquiry is problematic.

For example:

"I need help tuning my TV."

may legitimately trigger a technical-review keyword.

The system should therefore tell the administrator:

"This enquiry contains something worth looking at."

It should not automatically conclude:

"This customer is a problem."

Alert Types

The main alert classifications are:

1. Review Required

Used when an enquiry contains terms or conditions that should be manually
reviewed.

Example:

🚩 REVIEW REQUIRED

Typical reasons might include:

Specific technical equipment
Unusual service requests
Potentially complex jobs
Services requiring clarification
Keywords associated with specialist work
2. Urgent Inquiry

Used when the customer indicates that they need assistance quickly.

Examples include:

as soon as possible
urgent
today
immediately
emergency

An example evaluation reason may be:

Urgent timeframe detected: 'as soon as possible'

Urgency should generally be evaluated separately from technical review.

A submission can therefore be:

REVIEW REQUIRED + URGENT

at the same time.

3. Spam Detection

Spam detection identifies submissions that appear suspicious or contain
configured spam indicators.

Example:

⛔ SPAM DETECTED

Spam detection should be conservative.

False positives are possible, so the system should provide the reason for
the classification.

4. Normal Inquiry

If no configured conditions are triggered, the admin email can display:

🚀 NEW INQUIRY

This indicates that no additional evaluation flag was raised.

Alert Taxonomy

The taxonomy is the classification structure used by the evaluation
system.

Think of the taxonomy as the system's vocabulary for deciding:

"What kind of thing did this enquiry contain?"

A taxonomy can contain categories such as:

Review Keywords
Urgent Keywords
Spam Keywords
Technical Keywords
Service Keywords

The exact taxonomy should be maintained centrally.

Avoid creating independent keyword lists inside unrelated functions.

Taxonomy Editor

The Taxonomy Editor is the preferred place to maintain the keyword
classification system when available in the project.

The editor should be treated as the source of truth for configurable
classification rules.

A person maintaining the system should use the Taxonomy Editor to:

Add keywords
Remove keywords
Modify categories
Review existing classifications
Add new alert terms
Adjust descriptions
Maintain the keyword taxonomy

The goal is to prevent keyword logic from becoming scattered throughout
the Apps Script project.

Taxonomy Maintenance Principles

When adding a keyword:

1. Ask why it is needed

Do not add keywords simply because they appeared once.

Determine whether the keyword represents a repeatable classification.

2. Consider false positives

For example:

TV

is extremely broad.

It may appear in legitimate enquiries that do not require special
attention.

A more specific phrase may be preferable:

TV aerial
3. Prefer meaningful phrases

When appropriate:

TV aerial
Nintendo Switch
computer won't start
data recovery

may be more useful than extremely generic terms.

4. Test after changing taxonomy

Every taxonomy change should be followed by a controlled test submission.

How Keyword Matching Works

The evaluator normally considers information from the submitted enquiry.

Relevant fields can include:

What sounds like your situation?
What's happening and what would you like to achieve?
How Soon Do You Need Help?

Depending on implementation, additional submission fields may also be
available to the evaluator.

The evaluator searches for configured terms.

When a match occurs, the system records the reason.

For example:

Goal / Desired Outcome matched review keyword(s):
tv aerial, tv, tuned, nintendo

The reason is then made available to the admin email.

How to Add or Modify Keywords

Before modifying keywords:

Open the project.
Locate the Taxonomy Editor or taxonomy configuration.
Identify the appropriate alert category.
Add or modify the keyword.
Save the change.
Run a controlled test.
Verify the admin email.
Confirm the expected alert appears.
Confirm unrelated enquiries still behave normally.

Do not immediately modify the evaluation engine itself.

Most keyword changes should be configuration changes rather than code
changes.

How to Modify Alert Categories

If a new category is required:

Existing:
Review
Urgent
Spam

You might add:

Specialist Service

The correct procedure is:

Define what the category means.
Define what should trigger it.
Add the category to the taxonomy.
Add the relevant keywords/rules.
Define how the alert should be displayed.
Add the evaluation reason.
Test positive matches.
Test negative matches.

Do not create a new category without documenting its purpose.

How to Modify the Form Fields

The form and the processing system must remain synchronized.

If you add a field to the form, you should update:

Google Form
Form Responses structure
Submission processing
Admin email template
Client email template
Any validation logic
Any evaluation logic that uses the new field
Tests

For example, adding:

Preferred Service Date

requires more than adding the field visually to the form.

The new value must travel through the entire pipeline.

How to Modify the Admin Email

The admin email template is responsible for internal notifications.

When modifying it:

Preserve the existing status logic.
Preserve evaluation reasons.
Preserve safe HTML escaping.
Add new form fields in the same order as the form.
Use the actual form field name.
Do not rename fields to generic labels without a reason.
Test with populated and empty values.

The admin template should always reflect the authoritative form structure.

How to Modify the Client Email

The client email should mirror the form data without exposing internal
evaluation information.

When modifying it:

Preserve the client-friendly language.
Preserve the RD3 Tech branding.
Add new form fields.
Keep the field order aligned with the form.
Do not display internal spam/review evaluation.
Test the email using a controlled submission.
Google Forms and Google Sheets

The Google Form manages the response destination.

The connected spreadsheet should contain:

Form Responses

with the expected headers.

Google Forms can create a new response sheet when the connection is
removed and recreated.

This behaviour is important during production cleanup.

Production Reset

During development, test submissions may accumulate in the response
sheet.

Do not rely on manually deleting rows from a Google Forms-managed response
sheet as the primary production reset mechanism.

If a clean production response sheet is required, use the Google Forms
unlink/relink process.

Final production procedure

Before accepting real customer enquiries:

Finish all form development.
Finish the Apps Script changes.
Finish the admin email.
Finish the client email.
Finish taxonomy configuration.
Deploy the final version.
Unlink the form from the existing response destination.
Reconnect the form to Google Sheets.
Allow Google Forms to create the new response sheet.
Rename the sheet to Form Responses if required.
Verify the headers.
Submit one controlled test.
Verify the admin email.
Verify the client email.
Remove/ignore the controlled test according to the final production
procedure.
Begin accepting real submissions.

Once production begins, avoid unnecessary structural changes.

Testing

Testing should cover both normal and flagged submissions.

Normal submission

Example:

Name:
Test User

I am contacting RD3 Tech as:
Home user

What sounds like your situation?:
General technology help

How Soon Do You Need Help?:
Within a week

Expected result:

NEW INQUIRY

with no unexpected evaluation flags.

Review submission

Example:

What's happening and what would you like to achieve?:
TV aerial needs tuning

Expected result:

REVIEW REQUIRED

and an evaluation reason explaining the match.

Urgent submission

Example:

How Soon Do You Need Help?:
As soon as possible

Expected result:

URGENT INQUIRY

with a reason such as:

Urgent timeframe detected: 'as soon as possible'
Combined submission

Test a submission containing both review and urgent conditions.

Expected result:

REVIEW REQUIRED
URGENT INQUIRY

Both reasons should be visible.

Client test

The client email should:

Arrive successfully.
Contain all form fields.
Not contain internal alert information.
Use the correct client name.
Display the correct enquiry information.
Maintain correct formatting.
Safe Development Workflow

When making changes:

1. Change one thing
        ↓
2. Save
        ↓
3. Run a controlled test
        ↓
4. Inspect admin email
        ↓
5. Inspect client email
        ↓
6. Check Form Responses
        ↓
7. Confirm no unrelated behaviour changed
        ↓
8. Commit to Git

Avoid changing multiple unrelated systems at the same time.

Common Mistakes
Mistake 1 — Renaming a form field without updating the templates

For example:

Category

and:

I am contacting RD3 Tech as

are not necessarily interchangeable.

The form field name should be treated as authoritative.

Mistake 2 — Adding a field to only one email

If a field exists on the form, it should normally be represented in both:

Admin Email
Client Email

unless there is a deliberate reason not to expose it to the client.

Mistake 3 — Hard-coding keywords throughout the project

Avoid:

if (message.includes('keyword1')) ...

in many unrelated functions.

Use the taxonomy/configuration system wherever possible.

Mistake 4 — Overly broad keywords

A keyword such as:

computer

may generate many false positives.

Prefer specific phrases where appropriate.

Mistake 5 — Exposing internal alerts to clients

The client should not receive internal information such as:

REVIEW REQUIRED
SPAM DETECTED
Urgent evaluation reason
Internal keyword matches

These are internal operational signals.

Mistake 6 — Manually rebuilding Google Forms response sheets

Google Forms controls its response destination.

If the response sheet becomes structurally problematic, the cleanest
solution can be to unlink and reconnect the response destination rather
than fighting the Forms-managed structure with Apps Script.

Troubleshooting
Admin email does not contain a field

Check:

Is the field present in the form?
Is the field present in Form Responses?
Is the backend receiving the field?
Is the template resolving the correct property?
Is the field name spelled correctly?
Was the template redeployed?
Client email does not contain a field

Check the client template first.

Make sure the template has:

A resolver variable.
A corresponding table row.
The correct property name.
A fallback such as Not provided.
Alert does not trigger

Check:

Is the keyword present in the Taxonomy Editor?
Is it in the correct category?
Is matching case-sensitive?
Is the evaluator checking the field containing the text?
Is the taxonomy configuration being loaded?
Has the current deployment been updated?
Too many alerts

This is usually a taxonomy problem rather than an email-template problem.

Review:

Broad keywords
Short keywords
Common words
Duplicate keywords
Overlapping categories

Reduce false positives before changing the email presentation.

Google Sheet starts at an unexpected row

If the sheet has accumulated test responses or has been recreated during
development, do not assume the Apps Script purge function is the correct
solution.

Check the Google Forms response destination.

A clean unlink/relink process may be appropriate before production.

Deployment

Before deploying:

 Form fields are final.
 Form field names are correct.
 Form Responses headers are correct.
 Admin email is correct.
 Client email is correct.
 Taxonomy is correct.
 Review keywords are correct.
 Urgent keywords are correct.
 Spam rules are correct.
 Test submissions have been reviewed.
 Client emails do not expose internal evaluation information.
 Admin emails contain all required form data.
Security Considerations

The system processes personal information.

Potentially sensitive information includes:

Names
Email addresses
Phone numbers
Locations
Enquiry details

Therefore:

Do not commit real customer data to Git.
Do not commit exported customer emails.
Do not commit production spreadsheets.
Do not commit passwords.
Do not commit API keys.
Do not commit OAuth credentials.
Do not commit private configuration containing secrets.
Use .gitignore appropriately.
Keep production credentials outside the repository.

Example .gitignore entries may include:

.env
*.env
credentials.json
token.json
service-account.json
node_modules/
.DS_Store

Never place real customer submissions in test fixtures committed to Git.

Use synthetic test data instead.

Maintenance

Routine maintenance should focus on:

Form

Review when the business process changes.

Taxonomy

Review when new service types or recurring enquiry patterns appear.

Keywords

Review when false positives or missed alerts are discovered.

Admin Email

Review when internal workflow requirements change.

Client Email

Review when customer communication or branding changes.

Google Sheet

Avoid unnecessary structural changes to the Forms-managed response sheet.

Recommended Change Hierarchy

When making changes, use this order:

FORM
  ↓
DATA STRUCTURE
  ↓
PROCESSING
  ↓
TAXONOMY / ALERT RULES
  ↓
ADMIN EMAIL
  ↓
CLIENT EMAIL
  ↓
TESTING

The form is the source of the submitted data.

The processing layer interprets that data.

The taxonomy determines how particular information is classified.

The email templates present the resulting information.

Handover Checklist

A new developer or administrator should be able to verify the following.

Form
 Understand where the form is managed.
 Understand the final field order.
 Understand that field names matter.
 Understand how the form connects to Google Sheets.
Processing
 Understand where submissions are processed.
 Understand how submission data is normalised.
 Understand how evaluation flags are generated.
Taxonomy
 Understand what the taxonomy does.
 Know where keywords are maintained.
 Understand Review keywords.
 Understand Urgent keywords.
 Understand Spam keywords.
 Understand how to test a taxonomy change.
Admin Email
 Understand the admin template.
 Understand status badges.
 Understand evaluation reasons.
 Understand that all form fields should be represented.
Client Email
 Understand the client template.
 Understand what information is safe to expose.
 Understand that internal evaluation information must remain internal.
Production
 Know how to perform the final Form Responses reset.
 Know how to reconnect Google Forms.
 Know how to verify the response sheet.
 Know how to perform a final controlled test.
Final Principle

The most important rule for maintaining this system is:

The form defines what the customer submitted. The processing system
evaluates it. The taxonomy defines how it is classified. The admin email
explains what RD3 Tech needs to know. The client email confirms what the
customer submitted.

Keep those responsibilities separate.

When the form changes, review the entire pipeline.

When the taxonomy changes, test the evaluation system.

When an email changes, verify that it still reflects the form.

When production begins, avoid unnecessary structural changes.

RD3 Tech

Your Technology Support Journey Starts Here

Website:

https://rd3tech.com/

Email:

tom@rd3tech.com
