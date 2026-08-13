RD3 Tech

System Documentation

Documentation

*   [Overview](#overview)
*   [System Architecture](#system-architecture)
*   [Form Data Structure](#form-data)
*   [Admin Email](#admin-email)
*   [Client Email](#client-email)
*   [Keyword Filtering](#keyword-filtering)
*   [Alert System](#alert-system)
*   [Alert Taxonomy](#taxonomy)
*   [Taxonomy Editor](#taxonomy-editor)
*   [Review Alerts](#review-alerts)
*   [Urgent Alerts](#urgent-alerts)
*   [Spam Detection](#spam-alerts)
*   [Keyword Matching](#keyword-matching)
*   [Modify Keywords](#modify-keywords)
*   [Modify Alert Categories](#modify-alerts)
*   [Modify Form Fields](#modify-form)
*   [Modify Admin Email](#modify-admin)
*   [Modify Client Email](#modify-client)
*   [Google Forms & Sheets](#google-forms)
*   [Production Reset](#production-reset)
*   [Testing](#testing)
*   [Development Workflow](#workflow)
*   [Troubleshooting](#troubleshooting)
*   [Common Mistakes](#common-mistakes)
*   [Deployment](#deployment)
*   [Security](#security)
*   [Maintenance](#maintenance)
*   [Handover Checklist](#handover)

![RD3 Tech Logo](https://i0.wp.com/rd3tech.com/wp-content/uploads/2023/03/cropped-RD3Logo.png?resize=50%2C50&ssl=1)

RD3 Tech — Enquiry & Lead Processing System
===========================================

Technical documentation and handover guide for the RD3 Tech enquiry processing system, including form handling, Google Sheets, keyword filtering, alert taxonomy, email templates, testing, deployment and production maintenance.

Production Handover Documentation

Overview
--------

The RD3 Tech enquiry system receives enquiries from the website, stores the submitted information, evaluates the submission against configurable rules, and sends the appropriate email notifications.

The system is designed to provide a consistent workflow from the initial customer submission through to internal review.

### Admin Notification

Provides RD3 Tech with the complete enquiry together with internal review, urgency and spam indicators where applicable.

### Client Confirmation

Confirms receipt of the enquiry and displays the information supplied by the customer without exposing internal evaluation information.

System Architecture
-------------------

The overall processing flow is:

Website Form

→

Google Form

→

Form Responses

→

Apps Script

→

Evaluation

→

Admin + Client Email

### Processing responsibilities

*   Receive the submitted enquiry.
*   Normalise submission data.
*   Resolve the expected field names.
*   Evaluate keyword rules.
*   Evaluate urgency.
*   Evaluate spam indicators.
*   Generate internal evaluation reasons.
*   Render the admin email.
*   Render the client confirmation email.

Form Data Structure
-------------------

The form is the authoritative source for the customer's submitted information.

#

Field

Purpose

1

Timestamp

Time the enquiry was submitted.

2

Name

Client name.

3

Email

Client email address.

4

Phone

Client phone number.

5

Address / Location

Client location.

6

Preferred Contact

Preferred communication method.

7

Have You Used RD3 Tech Before?

Existing/new relationship indicator.

8

I am contacting RD3 Tech as

Client type.

9

What sounds like your situation?

Type of problem or request.

10

What's happening and what would you like to achieve?

Detailed request.

11

How Soon Do You Need Help?

Requested timeframe.

**Important** The field `I am contacting RD3 Tech as` replaces the previous generic `Category` field.

Current client-type values include:

*   Home user
*   Small business
*   Community organisation

Admin Email
-----------

The admin email is the internal notification sent to RD3 Tech.

It should contain the complete form submission in the same logical order as the form.

### Required admin fields

1.  Timestamp
2.  Name
3.  Email
4.  Phone
5.  Address / Location
6.  Preferred Contact
7.  Have You Used RD3 Tech Before?
8.  I am contacting RD3 Tech as
9.  What sounds like your situation?
10.  What's happening and what would you like to achieve?
11.  How Soon Do You Need Help?

### Internal status indicators

🚀 NEW INQUIRY 🚩 REVIEW REQUIRED 🚨 URGENT INQUIRY ⛔ SPAM DETECTED

Evaluation reasons should also be shown when a submission has been flagged.

Client Email
------------

The client email confirms receipt of the enquiry and presents the information supplied by the customer.

The client email should contain the relevant form data but should **never expose internal evaluation information.**

### Client-facing information

*   Name
*   Email
*   Phone
*   Address / Location
*   Preferred Contact
*   Have You Used RD3 Tech Before?
*   I am contacting RD3 Tech as
*   What sounds like your situation?
*   What's happening and what would you like to achieve?
*   How Soon Do You Need Help?

Keyword Filtering
-----------------

Keyword filtering is used to identify enquiries that may require additional attention.

Keyword matching does not automatically mean that an enquiry is bad, suspicious or problematic.

**Important principle** A keyword match is a signal for human review, not necessarily an automatic decision about the customer.

For example:

    TV aerial needs tuning nintendo broken

could produce an internal reason such as:

    Goal / Desired Outcome matched review keyword(s):
    tv aerial, tv, tuned, nintendo

Alert System
------------

The alert system classifies submissions according to configured rules.

### Review Required

Indicates that the enquiry contains something that should be manually reviewed.

### Urgent Inquiry

Indicates that the customer has requested rapid assistance.

### Spam Detected

Indicates that configured spam indicators were detected.

### New Inquiry

Indicates that no additional evaluation condition was triggered.

Multiple alert conditions can apply to the same submission.

For example:

    REVIEW REQUIRED + URGENT INQUIRY

Alert Taxonomy
--------------

The taxonomy defines how enquiry content is classified.

Think of the taxonomy as the system's vocabulary for determining what type of information appeared in an enquiry.

### Possible taxonomy categories

*   Review Keywords
*   Urgent Keywords
*   Spam Keywords
*   Technical Keywords
*   Service Keywords

The exact taxonomy should be maintained centrally rather than duplicated throughout unrelated functions.

Taxonomy Editor
---------------

The Taxonomy Editor should be treated as the preferred place for maintaining configurable keyword classifications.

It should be used to:

*   Add keywords.
*   Remove keywords.
*   Modify categories.
*   Review existing classifications.
*   Add new alert terms.
*   Maintain descriptions.
*   Review the overall alert taxonomy.

**Design principle** Keep configurable business rules in the taxonomy instead of scattering hard-coded keyword checks throughout the application.

Review Required Alerts
----------------------

Review alerts identify enquiries that should receive additional human attention.

Possible reasons include:

*   Specific technical equipment.
*   Unusual service requests.
*   Potentially complex work.
*   Specialist services.
*   Keywords associated with particular technical problems.

Example:

    🚩 REVIEW REQUIRED

Urgent Alerts
-------------

Urgent alerts are normally generated from the timeframe selected by the customer.

Examples include:

    as soon as possible
    urgent
    today
    immediately
    emergency

Example evaluation reason:

    Urgent timeframe detected: 'as soon as possible'

Urgency should be evaluated separately from technical review.

Spam Detection
--------------

Spam detection identifies submissions that contain configured suspicious indicators.

    ⛔ SPAM DETECTED

**False positives** Spam detection should be conservative. A suspicious indicator should normally result in review rather than an irreversible decision.

How Keyword Matching Works
--------------------------

The evaluator examines relevant submission fields and compares their content against the configured taxonomy.

Important fields commonly include:

*   What sounds like your situation?
*   What's happening and what would you like to achieve?
*   How Soon Do You Need Help?

When a configured term is detected, the system records an evaluation reason.

How to Add or Modify Keywords
-----------------------------

1.  Open the project.
2.  Locate the Taxonomy Editor or taxonomy configuration.
3.  Identify the appropriate alert category.
4.  Add or modify the keyword.
5.  Save the change.
6.  Run a controlled test submission.
7.  Verify the admin email.
8.  Verify the evaluation reason.
9.  Confirm unrelated enquiries still behave normally.

### Keyword quality

Avoid overly broad terms where possible.

For example:

    computer

may create many false positives.

A more specific phrase may be preferable:

    computer won't start

How to Modify Alert Categories
------------------------------

Before adding a new alert category, define exactly what the category means and what should trigger it.

1.  Define the purpose of the category.
2.  Define the trigger conditions.
3.  Add it to the taxonomy.
4.  Add the relevant keywords or rules.
5.  Define how the alert is displayed.
6.  Define the evaluation reason.
7.  Test positive matches.
8.  Test negative matches.

How to Modify the Form Fields
-----------------------------

The form and processing system must remain synchronized.

If a field is added, removed or renamed, review the entire pipeline.

1.  Google Form.
2.  Form Responses.
3.  Submission processing.
4.  Admin email template.
5.  Client email template.
6.  Validation logic.
7.  Evaluation logic.
8.  Tests.

**Do not change field names casually** Field names are part of the data contract between the form, spreadsheet, Apps Script and email templates.

How to Modify the Admin Email
-----------------------------

The admin email should always reflect the authoritative form data.

1.  Preserve the status logic.
2.  Preserve evaluation reasons.
3.  Preserve HTML escaping.
4.  Add fields in form order.
5.  Use the actual field name.
6.  Test populated values.
7.  Test empty values.

How to Modify the Client Email
------------------------------

The client email should remain customer-friendly and should not expose internal processing information.

1.  Preserve the RD3 Tech branding.
2.  Preserve the client-friendly language.
3.  Add new form fields where appropriate.
4.  Keep the field order aligned with the form.
5.  Do not expose internal alert information.
6.  Test the resulting email.

Google Forms & Google Sheets
----------------------------

Google Forms manages its response destination.

The expected response sheet is:

    Form Responses

During development, Google Forms may create a new response sheet when the form is disconnected and reconnected.

**Important** Do not assume that manually deleting rows from a Forms-managed response sheet is the safest way to reset production data.

Production Reset
----------------

Before production begins, test submissions should not be mixed with real customer submissions.

### Recommended final procedure

1.  Finish all form development.
2.  Finish the Apps Script processing.
3.  Finish the admin email.
4.  Finish the client email.
5.  Finish the taxonomy configuration.
6.  Finish the keyword rules.
7.  Deploy the final version.
8.  Unlink the form from the existing response destination.
9.  Reconnect the form to Google Sheets.
10.  Allow Google Forms to create the new response sheet.
11.  Rename the response sheet to `Form Responses` if required.
12.  Verify the headers.
13.  Submit one controlled test.
14.  Verify the admin email.
15.  Verify the client email.
16.  Confirm the production response structure is correct.

**Production principle** Once the final form and templates are confirmed, avoid unnecessary structural changes to the production form and response destination.

Testing
-------

### Normal enquiry

    I am contacting RD3 Tech as:
    Home user
    
    What sounds like your situation?:
    General technology help
    
    How Soon Do You Need Help?:
    Within a week

Expected result:

    🚀 NEW INQUIRY

### Review enquiry

    What's happening and what would you like to achieve?:
    TV aerial needs tuning

Expected result:

    🚩 REVIEW REQUIRED

### Urgent enquiry

    How Soon Do You Need Help?:
    As soon as possible

Expected result:

    🚨 URGENT INQUIRY

### Combined enquiry

Test a submission containing both a review condition and an urgent condition.

    🚩 REVIEW REQUIRED
    🚨 URGENT INQUIRY

### Client email verification

*   Email arrives successfully.
*   Client name is correct.
*   All expected form fields are displayed.
*   Values are correct.
*   Internal evaluation information is not exposed.
*   Formatting remains intact.

Safe Development Workflow
-------------------------

Change One Thing

→

Save

→

Test

→

Inspect Admin

→

Inspect Client

→

Verify Sheet

→

Commit

Avoid changing several unrelated systems at the same time.

Troubleshooting
---------------

### Admin email is missing a field

1.  Check that the field exists on the form.
2.  Check that the field exists in Form Responses.
3.  Check that the backend receives the value.
4.  Check the template property name.
5.  Check spelling and capitalisation.
6.  Verify that the current deployment is being used.

### Client email is missing a field

1.  Check the client template.
2.  Check the data resolver.
3.  Check the corresponding table row.
4.  Check the property name.
5.  Check the fallback value.

### Alert does not trigger

1.  Check the Taxonomy Editor.
2.  Check the keyword category.
3.  Check the spelling.
4.  Check which form field is being evaluated.
5.  Check that the taxonomy configuration is loaded.
6.  Check the active deployment.

### Too many alerts

This is usually a taxonomy issue rather than an email-template issue.

Review:

*   Overly broad keywords.
*   Short keywords.
*   Common words.
*   Duplicate keywords.
*   Overlapping categories.

Common Mistakes
---------------

### Renaming a field without updating the system

For example:

    Category

is not automatically equivalent to:

    I am contacting RD3 Tech as

The field name should be treated as part of the system's data contract.

### Adding a field to only one email

If a field exists on the form, it should normally be represented in both admin and client templates unless there is a deliberate reason not to expose it to the client.

### Hard-coding keywords everywhere

Avoid creating independent keyword checks throughout unrelated functions.

Use the taxonomy/configuration system wherever possible.

### Using overly broad keywords

Generic terms can produce unnecessary alerts.

### Exposing internal alerts to clients

The client should never receive internal information such as:

*   Review Required.
*   Spam Detected.
*   Internal keyword matches.
*   Internal evaluation reasons.

### Manually fighting the Forms response sheet

Google Forms controls its response destination. If the response structure becomes problematic during development, the unlink/relink process may be safer than attempting to delete all Forms-managed rows programmatically.

Deployment
----------

*   Form fields are final.
*   Form field names are correct.
*   Form Responses headers are correct.
*   Admin email is correct.
*   Client email is correct.
*   Taxonomy is correct.
*   Review keywords are correct.
*   Urgent keywords are correct.
*   Spam rules are correct.
*   Test submissions have been reviewed.
*   Client emails do not expose internal evaluation information.
*   Admin emails contain all required form data.
*   Final production response sheet is clean.

Security Considerations
-----------------------

The system processes customer information.

This can include:

*   Names.
*   Email addresses.
*   Phone numbers.
*   Locations.
*   Enquiry details.

**Never commit customer data to Git** Production submissions, customer emails, spreadsheets and other personally identifiable information must not be committed to the repository.

Do not commit:

*   Passwords.
*   API keys.
*   OAuth credentials.
*   Production spreadsheets.
*   Customer submissions.
*   Private configuration containing secrets.

### Example .gitignore

    .env
    *.env
    credentials.json
    token.json
    service-account.json
    node_modules/
    .DS_Store

Maintenance
-----------

### Form

Review when the customer-facing business process changes.

### Taxonomy

Review when new service types or recurring enquiry patterns appear.

### Keywords

Review when false positives or missed alerts are discovered.

### Admin Email

Review when internal workflow requirements change.

### Client Email

Review when customer communication or branding changes.

### Google Sheet

Avoid unnecessary structural changes to the Forms-managed response sheet.

Recommended Change Hierarchy
----------------------------

FORM

→

DATA STRUCTURE

→

PROCESSING

→

TAXONOMY

→

ADMIN EMAIL

→

CLIENT EMAIL

→

TESTING

**Core principle** The form defines what the customer submitted. The processing layer interprets it. The taxonomy classifies it. The admin email explains what RD3 Tech needs to know. The client email confirms what the customer submitted.

Handover Checklist
------------------

### Form

*   Understand where the form is managed.
*   Understand the final field order.
*   Understand that field names matter.
*   Understand how the form connects to Google Sheets.

### Processing

*   Understand where submissions are processed.
*   Understand how submission data is normalised.
*   Understand how evaluation flags are generated.

### Taxonomy

*   Understand what the taxonomy does.
*   Know where keywords are maintained.
*   Understand Review keywords.
*   Understand Urgent keywords.
*   Understand Spam keywords.
*   Know how to test taxonomy changes.

### Admin Email

*   Understand the admin template.
*   Understand status badges.
*   Understand evaluation reasons.
*   Understand that all form fields should be represented.

### Client Email

*   Understand the client template.
*   Understand what information is safe to expose.
*   Understand that internal evaluation remains internal.

### Production

*   Know how to perform the final response-sheet reset.
*   Know how to reconnect Google Forms.
*   Know how to verify the response sheet.
*   Know how to perform a final controlled test.

Final Principle
---------------

**The form defines what the customer submitted.**

The processing system evaluates that information.

The taxonomy defines how information is classified.

The admin email explains what RD3 Tech needs to know.

The client email confirms what the customer submitted.

Keep those responsibilities separate.

**RD3 Tech**  
Your Technology Support Journey Starts Here  
  
[rd3tech.com](https://rd3tech.com/)  |  [tom@rd3tech.com](mailto:tom@rd3tech.com)
