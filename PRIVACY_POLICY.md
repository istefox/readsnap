# ReadSnap — Privacy Policy

**Last updated:** March 12, 2026

## Overview

ReadSnap is a Chrome extension that captures screenshots of web pages, extracts text using OCR, and saves the result to Readwise Reader. Your privacy is important — this policy explains what data ReadSnap accesses and how it is handled.

## Data Collection and Usage

### Data stored locally
- **Readwise API token**: stored in your browser's local storage (`chrome.storage.local`) to authenticate with the Readwise API. It never leaves your browser except to communicate with Readwise.
- **User preferences**: OCR language, default tags, and toggle settings. Stored locally only.

### Data processed locally
- **Screenshots**: captured images of web pages are processed entirely within your browser for cropping, stitching, and OCR text extraction. OCR is powered by Tesseract.js running locally — no image or text data is sent to any third-party OCR service.

### Data sent to third parties
- **Readwise Reader**: when you trigger a capture, the resulting screenshot and/or extracted text are sent to the Readwise Reader API (`readwise.io`) using your personal API token. This is the core functionality of the extension and only happens when you initiate a capture.

## Data NOT collected
ReadSnap does **not** collect, store, or transmit:
- Personal identification information
- Browsing history
- Health, financial, or payment data
- Analytics or telemetry data
- Any data to advertising networks

## No remote code
All code runs locally within the extension. No remote scripts are loaded or executed.

## No tracking
ReadSnap contains no analytics, tracking pixels, or telemetry of any kind.

## Data retention
All locally stored data (API token, preferences) can be cleared at any time by removing the extension. No data is retained on any server controlled by ReadSnap.

## Changes to this policy
Any changes will be reflected in this document with an updated date.

## Contact
For questions about this privacy policy, open an issue at the project repository.
