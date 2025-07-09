const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const router = express.Router();
const { ultraCompressPDF } = require('../utils/pdfCompressor');
const { compressImagesInHTML } = require('../utils/imageCompressor');
const { getTemplateByType, replacePlaceholders } = require('../services/templateService');

// Create a log file for debugging
const logFile = path.join(__dirname, 'pdf-debug.log');

function writeLog(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logFile, logMessage);
  console.log(message);
}

// Load the compressed logo from frontend (23KB - good quality, reasonable size)
const logoPath = path.join(__dirname, '../../frontend/public/logo-compressed.png');
const logoBase64 = fs.readFileSync(logoPath).toString('base64');

// Load the background image using the same method as logos
const backgroundPath = path.join(__dirname, '../../frontend/public/images/clearance_front.jpg');
console.log('Background image path:', backgroundPath);
console.log('Background image exists:', fs.existsSync(backgroundPath));
const backgroundBase64 = fs.readFileSync(backgroundPath).toString('base64');
console.log('Background image loaded, base64 length:', backgroundBase64.length);

// HTML templates for asbestos clearance reports - Using the actual 7-page template structure
const HTML_TEMPLATES = {
  page1: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Asbestos Clearance Report Cover Mockup</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: "Montserrat", Arial, sans-serif;
        background: #f5f5f5;
      }
      .cover-container {
        width: 800px;
        height: 1130px;
        margin: 0;
        box-shadow: 0 4px 32px rgba(0, 0, 0, 0.12);
        position: relative;
        background: #fff;
        overflow: hidden;
      }
      .cover-bg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 0;
      }
      .cover-white-shape {
        position: absolute;
        top: 0;
        left: 0;
        width: 432px;
        height: 1130px;
        z-index: 1;
        pointer-events: none;
      }
      .cover-left {
        width: 432px;
        position: relative;
        z-index: 3;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 0;
        overflow: visible;
        min-width: 432px;
        max-width: 432px;
      }
      .green-bracket {
        position: absolute;
        top: 0;
        left: 0;
        width: 432px;
        height: 1130px;
        z-index: 4;
        pointer-events: none;
      }
      .cover-content {
        position: relative;
        z-index: 5;
        padding: 60px 20px 40px 20px;
        display: flex;
        flex-direction: column;
        height: 100%;
        justify-content: flex-start;
        margin-top: 150px;
      }
      .cover-content h1 {
        font-size: 2rem;
        font-weight: 700;
        margin: 0 0 18px 0;
        letter-spacing: 0.01em;
        line-height: 1.2;
        text-transform: uppercase;
      }
      .address {
        font-size: 1.21rem;
        margin-bottom: 32px;
        color: #222;
      }
      .cover-content p {
        font-size: 1.2rem;
        margin: 0 0 18px 0;
        color: #222;
      }
      .cover-content b {
        font-weight: 700;
        color: #111;
      }
      .cover-left .company-details {
        font-size: 0.95rem;
        color: #222;
        margin-top: 220px;
        line-height: 1.5;
        text-align: left;
      }
      .cover-logo {
        position: absolute;
        right: 32px;
        bottom: 32px;
        width: 207px;
        background: rgba(255, 255, 255, 0.95);
        padding: 5px 9px 5px 5px;
        border-radius: 6px;
        z-index: 10;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      }
      .cover-right {
        width: calc(100% - 432px);
        height: 100%;
        position: relative;
        overflow: hidden;
        z-index: 1;
        display: flex;
        align-items: flex-end;
        justify-content: flex-end;
      }
    </style>
  </head>
  <body>
    <div class="cover-container">
      <div
        class="cover-bg"
        style="background-image: var(--background-url); background-size: cover; background-position: center;"
      ></div>

      <div class="cover-left">
        <svg
          class="green-bracket"
          viewBox="0 0 432 1130"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <polyline
            points="80,-10 426,240"
            stroke="#16b12b"
            stroke-width="12"
            fill="none"
          />
          <polyline
            points="426,236 426,888"
            stroke="#16b12b"
            stroke-width="12"
            fill="none"
          />
          <polyline
            points="426,884 80,1134"
            stroke="#16b12b"
            stroke-width="12"
            fill="none"
          />
        </svg>
        <div class="cover-content">
          <h1>[REPORT_TYPE] REMOVAL<br />CLEARANCE CERTIFICATE</h1>
          <div class="address">[SITE_ADDRESS]</div>
          <p><b>Job Reference</b><br />[PROJECT_ID]</p>
          <p><b>Clearance Date</b><br />[CLEARANCE_DATE]</p>
          <div class="company-details">
            Lancaster & Dickenson Consulting Pty Ltd<br />
            4/6 Dacre Street, Mitchell ACT 2911<br />
            enquiries@landd.com.au<br />
            (02) 6241 2779
          </div>
        </div>
      </div>
              <div class="cover-logo" style="background-image: var(--logo-url); background-size: contain; background-repeat: no-repeat; background-position: center;"></div>
    </div>
  </body>
</html>`,
  page2: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Asbestos Clearance Report - Version Control</title>
    <link
      href="https://fonts.googleapis.com/css?family=Montserrat:400,700&display=swap"
      rel="stylesheet"
    />
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: "Montserrat", Arial, sans-serif;
        background: #fff;
      }
      .page {
        width: 800px;
        height: 1130px;
        margin: 40px auto;
        background: #fff;
        box-shadow: 0 4px 32px rgba(0, 0, 0, 0.12);
        position: relative;
        padding: 0 0 0 0;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 16px 48px 0 48px;
      }
      .logo {
        width: 243px;
        height: auto;
        display: block;
        background: #fff;
      }
      .company-details {
        text-align: right;
        font-size: 0.75rem;
        color: #222;
        line-height: 1.5;
        margin-top: 8px;
      }
      .company-details .website {
        color: #16b12b;
        font-weight: 500;
      }
      .green-line {
        width: calc(100% - 96px);
        height: 4px;
        background: #16b12b;
        margin: 8px auto 0 auto;
        border-radius: 2px;
      }
      .content {
        padding: 10px 48px 24px 48px;
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: flex-start;
      }
      .title {
        font-size: 1.35rem;
        font-weight: 700;
        text-transform: uppercase;
        margin: 20px 0 0 0;
        letter-spacing: 0.01em;
      }
      .address {
        font-size: 1.46rem;
        margin: 8px 0 32px 0;
        color: #222;
      }
      .section-label {
        font-weight: 700;
        text-transform: uppercase;
        margin-top: 24px;
        margin-bottom: 4px;
        font-size: 1.2rem;
        letter-spacing: 0.01em;
      }
      .section-content {
        margin-bottom: 12px;
        font-size: 1.06rem;
      }
      .details-list {
        margin: 0 0 12px 0;
        padding: 0;
        list-style: none;
        font-size: 0.795rem;
      }
      .details-list li {
        margin-bottom: 4px;
      }
      .revision-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 24px;
        margin-bottom: 32px;
      }
      .revision-table th,
      .revision-table td {
        border: 2px solid #444;
        padding: 8px 12px;
        font-size: 0.8rem;
        text-align: left;
      }
      .revision-table th {
        background: #f5f5f5;
        font-weight: 700;
        text-transform: none;
      }
      .footer {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 16px;
        width: calc(100% - 96px);
        margin: 0 auto;
        text-align: justify;
        font-size: 0.75rem;
        color: #222;
      }
      .footer-line {
        width: 100%;
        height: 4px;
        background: #16b12b;
        margin-bottom: 6px;
        border-radius: 2px;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="header">
        <img
          class="logo"
          src="[LOGO_PATH]"
          alt="Company Logo"
        />
        <div class="company-details">
          Lancaster & Dickenson Consulting Pty Ltd<br />
          4/6 Dacre Street<br />
          Mitchell ACT 2911<br />
          W: <span class="website">www.landd.com.au</span>
        </div>
      </div>
      <div class="green-line"></div>
      <div class="content" style="justify-content: flex-start; align-items: flex-start;">
        <div class="title" style="margin-top: 8px;">[REPORT_TYPE] REMOVAL<br />CLEARANCE CERTIFICATE</div>
        <div class="address">[SITE_ADDRESS]</div>

        <div class="section-label">Prepared For:</div>
        <div class="section-content">[CLIENT_NAME]</div>

        <div class="section-label">Prepared By:</div>
        <div class="section-content">
          Lancaster and Dickenson Consulting Pty Ltd<br />
          ABN 74 169 785 915
        </div>

        <div class="section-label">Document Details</div>
        <ul class="details-list">
          <li>File Name: [FILENAME]</li>
          <li>Issue Date: [CLEARANCE_DATE]</li>
          <li>Report Author: [LAA_NAME]</li>
          <li>Report Authoriser: [LAA_NAME]</li>
        </ul>

        <div class="section-label">Revision History</div>
        <table class="revision-table">
          <tr>
            <th>Reason for Revision</th>
            <th>Rev Number</th>
            <th>Approved By</th>
            <th>Date</th>
          </tr>
          <tr>
            <td style="height: 32px"></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
        </table>
      </div>
      <div class="footer">
        <div class="footer-line"></div>
        [REPORT_TYPE] Clearance Certificate: [SITE_ADDRESS]
      </div>
    </div>
  </body>
</html>`,
  page3: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Asbestos Clearance Report - Background Information</title>
    <link
      href="https://fonts.googleapis.com/css?family=Montserrat:400,700&display=swap"
      rel="stylesheet"
    />
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: "Montserrat", Arial, sans-serif;
        background: #fff;
      }
      .page {
        width: 800px;
        height: 1130px;
        margin: 40px auto;
        background: #fff;
        box-shadow: 0 4px 32px rgba(0, 0, 0, 0.12);
        position: relative;
        padding: 0 0 0 0;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 16px 48px 0 48px;
      }
      .logo {
        width: 243px;
        height: auto;
        display: block;
        background: #fff;
      }
      .company-details {
        text-align: right;
        font-size: 0.75rem;
        color: #222;
        line-height: 1.5;
        margin-top: 8px;
      }
      .company-details .website {
        color: #16b12b;
        font-weight: 500;
      }
      .header-line {
        width: calc(100% - 96px);
        height: 4px;
        background: #16b12b;
        margin: 8px auto 0 auto;
        border-radius: 2px;
      }
      .content {
        padding: 10px 48px 24px 48px;
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      .section-header {
        font-size: 0.9rem;
        font-weight: 700;
        text-transform: uppercase;
        margin: 10px 0 10px 0;
        letter-spacing: 0.01em;
        color: #222;
        text-align: justify;
      }
      .section-header.first-section {
        margin-top: 18px;
      }
      .section-header:not(.first-section) {
        margin-top: 10px;
      }
      .paragraph {
        font-size: 0.8rem;
        margin-bottom: 12px;
        color: #222;
        line-height: 1.5;
        text-align: justify;
      }
      .bullets {
        margin: 0 0 8px 16px;
        padding: 0;
        font-size: 0.8rem;
        color: #222;
        line-height: 1.5;
        text-align: justify;
      }
      .bullets li {
        margin-bottom: 4px;
        list-style-type: none;
        position: relative;
        padding-left: 20px;
        font-size: 0.8rem;
        line-height: 1.5;
        text-align: justify;
      }
      .bullets li::before {
        content: "•";
        position: absolute;
        left: 0;
        top: -0.2em;
        font-size: 2.4em;
        color: #222;
        line-height: 1;
      }
      .footer {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 16px;
        width: calc(100% - 96px);
        margin: 0 auto;
        text-align: justify;
        font-size: 0.75rem;
        color: #222;
      }
      .footer-line {
        width: 100%;
        height: 4px;
        background: #16b12b;
        margin-bottom: 6px;
        border-radius: 2px;
      }
    </style>
  </head>
  <body>
          <div class="page">
        <div class="header">
          <img
            class="logo"
            src="[LOGO_PATH]"
            alt="Company Logo"
          />
          <div class="company-details">
            Lancaster & Dickenson Consulting Pty Ltd<br />
            4/6 Dacre Street<br />
            Mitchell ACT 2911<br />
            W: <span class="website">www.landd.com.au</span>
          </div>
        </div>
        <div class="header-line"></div>
        <div class="content" style="justify-content: flex-start; align-items: flex-start;">
          <div class="section-header first-section" style="margin-top: 8px;">[BACKGROUND_INFORMATION_TITLE]</div>
          <div class="paragraph">
            [BACKGROUND_INFORMATION_CONTENT]
          </div>
          <div class="section-header">[LEGISLATIVE_REQUIREMENTS_TITLE]</div>
          <div class="paragraph">
            [LEGISLATIVE_REQUIREMENTS_CONTENT]
          </div>
          <div class="section-header">[NON_FRIABLE_CLEARANCE_CERTIFICATE_LIMITATIONS_TITLE]</div>
          <div class="paragraph">
            [NON_FRIABLE_CLEARANCE_CERTIFICATE_LIMITATIONS_CONTENT]
          </div>
      </div>
      <div class="footer">
        <div class="footer-line"></div>
        [REPORT_TYPE] Clearance Certificate: [SITE_ADDRESS]
      </div>
    </div>
  </body>
</html>`,
  page4: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Asbestos Clearance Report - Main Content</title>
    <link
      href="https://fonts.googleapis.com/css?family=Montserrat:400,700&display=swap"
      rel="stylesheet"
    />
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: "Montserrat", Arial, sans-serif;
        background: #fff;
      }
      .page {
        width: 800px;
        height: 1130px;
        margin: 40px auto;
        background: #fff;
        box-shadow: 0 4px 32px rgba(0, 0, 0, 0.12);
        position: relative;
        padding: 0 0 0 0;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 16px 48px 0 48px;
      }
      .logo {
        width: 243px;
        height: auto;
        display: block;
        background: #fff;
      }
      .company-details {
        text-align: right;
        font-size: 0.75rem;
        color: #222;
        line-height: 1.5;
        margin-top: 8px;
      }
      .company-details .website {
        color: #16b12b;
        font-weight: 500;
      }
      .header-line {
        width: calc(100% - 96px);
        height: 4px;
        background: #16b12b;
        margin: 8px auto 0 auto;
        border-radius: 2px;
      }
      .content {
        padding: 10px 48px 24px 48px;
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      .section-header {
        font-size: 0.9rem;
        font-weight: 700;
        text-transform: uppercase;
        margin: 10px 0 10px 0;
        letter-spacing: 0.01em;
        color: #222;
        text-align: justify;
      }
      .section-header.first-section {
        margin-top: 18px;
      }
      .section-header:not(.first-section) {
        margin-top: 10px;
      }
      .paragraph {
        font-size: 0.8rem;
        margin-bottom: 12px;
        color: #222;
        line-height: 1.5;
        text-align: justify;
      }
      .table-title {
        font-size: 0.8rem;
        font-weight: 700;
        margin: 0 0 12px 0;
        text-align: justify;
        line-height: 1.5;
      }
      .asbestos-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 12px;
      }
      .asbestos-table th,
      .asbestos-table td {
        border: 2px solid #444;
        padding: 6px 10px;
        font-size: 0.8rem;
        text-align: left;
        line-height: 1.5;
      }
      .asbestos-table th {
        background: #f5f5f5;
        font-weight: 700;
      }
      .bullets {
        margin: 0 0 8px 16px;
        padding: 0;
        font-size: 0.8rem;
        color: #222;
        line-height: 1.5;
        text-align: justify;
      }
      .bullets li {
        margin-bottom: 4px;
        list-style-type: none;
        position: relative;
        padding-left: 20px;
        font-size: 0.8rem;
        line-height: 1.5;
        text-align: justify;
      }
      .bullets li::before {
        content: "•";
        position: absolute;
        left: 0;
        top: -0.2em;
        font-size: 2.4em;
        color: #222;
        line-height: 1;
      }
      .signature-block {
        margin-top: 12px;
        margin-bottom: 0;
        font-size: 0.8rem;
        color: #222;
        text-align: justify;
        line-height: 1.5;
      }
      .signature-line {
        margin: 24px 0 8px 0;
        width: 180px;
        border-bottom: 2px solid #444;
        height: 24px;
      }
      .signature-name {
        font-weight: 700;
        margin-top: 8px;
        font-size: 0.8rem;
      }
      .signature-licence {
        font-size: 0.8rem;
        color: #444;
      }
      .footer {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 16px;
        width: calc(100% - 96px);
        margin: 0 auto;
        text-align: justify;
        font-size: 0.75rem;
        color: #222;
      }
      .footer-line {
        width: 100%;
        height: 4px;
        background: #16b12b;
        margin-bottom: 6px;
        border-radius: 2px;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="header">
        <img
          class="logo"
          src="[LOGO_PATH]"
          alt="Company Logo"
        />
        <div class="company-details">
          Lancaster & Dickenson Consulting Pty Ltd<br />
          4/6 Dacre Street<br />
          Mitchell ACT 2911<br />
          W: <span class="website">www.landd.com.au</span>
        </div>
      </div>
      <div class="header-line"></div>
      <div class="content" style="justify-content: flex-start; align-items: flex-start;">
        <div class="section-header first-section" style="margin-top: 8px;">[INSPECTION_DETAILS_TITLE]</div>
        <div class="paragraph">
          [INSPECTION_DETAILS_CONTENT]
        </div>
        <div class="table-title">Table 1: Asbestos Removal Areas</div>
        <table class="asbestos-table">
          <tr>
            <th>Item</th>
            <th>Location</th>
            <th>Material Description</th>
            <th>Asbestos Type</th>
          </tr>
          [REMOVAL_ITEMS_TABLE]
        </table>

        <div class="section-header">[INSPECTION_EXCLUSIONS_TITLE]</div>
        <div class="paragraph">
          [INSPECTION_EXCLUSIONS_CONTENT]
        </div>

        <div class="section-header">[CLEARANCE_CERTIFICATION_TITLE]</div>
        <div class="paragraph">
          [CLEARANCE_CERTIFICATION_CONTENT]
        </div>
        <div class="paragraph">
          [SIGN_OFF_CONTENT]
        </div>

      </div>
      <div class="footer">
        <div class="footer-line"></div>
        [FOOTER_TEXT]
      </div>
    </div>
  </body>
</html>`,
  page5: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Asbestos Clearance Report - Appendix A</title>
    <link
      href="https://fonts.googleapis.com/css?family=Montserrat:400,700&display=swap"
      rel="stylesheet"
    />
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: "Montserrat", Arial, sans-serif;
        background: #fff;
      }
      .page {
        width: 800px;
        height: 1130px;
        margin: 40px auto;
        background: #fff;
        box-shadow: 0 4px 32px rgba(0, 0, 0, 0.12);
        position: relative;
        padding: 0 0 0 0;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 16px 48px 0 48px;
      }
      .logo {
        width: 243px;
        height: auto;
        display: block;
        background: #fff;
      }
      .company-details {
        text-align: right;
        font-size: 0.75rem;
        color: #222;
        line-height: 1.5;
        margin-top: 8px;
      }
      .company-details .website {
        color: #16b12b;
        font-weight: 500;
      }
      .header-line {
        width: calc(100% - 96px);
        height: 4px;
        background: #16b12b;
        margin: 8px auto 0 auto;
        border-radius: 2px;
      }
      .content {
        padding: 10px 48px 24px 48px;
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
      }
      .centered-text {
        font-size: 1.8rem;
        text-transform: uppercase;
        color: #222;
        text-align: center;
        letter-spacing: 0.02em;
      }
      .appendix-title {
        font-weight: 700;
        color: #16b12b;
      }
      .photographs-text {
        font-weight: 400;
      }
      .footer {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 16px;
        width: calc(100% - 96px);
        margin: 0 auto;
        text-align: justify;
        font-size: 0.75rem;
        color: #222;
      }
      .footer-line {
        width: 100%;
        height: 4px;
        background: #16b12b;
        margin-bottom: 6px;
        border-radius: 2px;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="header">
        <img
          class="logo"
          src="[LOGO_PATH]"
          alt="Company Logo"
        />
        <div class="company-details">
          Lancaster & Dickenson Consulting Pty Ltd<br />
          4/6 Dacre Street<br />
          Mitchell ACT 2911<br />
          W: <span class="website">www.landd.com.au</span>
        </div>
      </div>
      <div class="header-line"></div>
      <div class="content" style="justify-content: center; align-items: center;">
        <div class="centered-text">
          <div class="appendix-title">APPENDIX A</div>
          <div class="photographs-text">PHOTOGRAPHS</div>
        </div>
      </div>
      <div class="footer">
        <div class="footer-line"></div>
        [REPORT_TYPE] Clearance Certificate: [SITE_ADDRESS]
      </div>
    </div>
  </body>
</html>`,
  page6: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Asbestos Clearance Report - Photographs</title>
    <link
      href="https://fonts.googleapis.com/css?family=Montserrat:400,700&display=swap"
      rel="stylesheet"
    />
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: "Montserrat", Arial, sans-serif;
        background: #fff;
      }
      .page {
        width: 800px;
        height: 1130px;
        margin: 40px auto;
        background: #fff;
        box-shadow: 0 4px 32px rgba(0, 0, 0, 0.12);
        position: relative;
        padding: 0 0 0 0;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 16px 48px 0 48px;
      }
      .logo {
        width: 243px;
        height: auto;
        display: block;
        background: #fff;
      }
      .company-details {
        text-align: right;
        font-size: 0.75rem;
        color: #222;
        line-height: 1.5;
        margin-top: 8px;
      }
      .company-details .website {
        color: #16b12b;
        font-weight: 500;
      }
      .header-line {
        width: calc(100% - 96px);
        height: 4px;
        background: #16b12b;
        margin: 8px auto 0 auto;
        border-radius: 2px;
      }
      .content {
        padding: 16px 48px 24px 48px;
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        height: calc(100vh - 200px);
        min-height: 800px;
      }
      .photo-container {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 50%;
        justify-content: center;
        align-items: center;
        margin-bottom: 0;
      }
      .photo-container:last-child {
        margin-bottom: 0;
      }
      .photo {
        width: 100%;
        height: 70%;
        background: #f5f5f5;
        border: 2px solid #ddd;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 16px;
        position: relative;
        box-sizing: border-box;
      }
      .photo-placeholder {
        color: #999;
        font-size: 0.9rem;
        text-align: center;
      }
      .photo img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
        margin: 0 auto;
      }
      .photo-details {
        font-size: 0.8rem;
        color: #222;
        line-height: 1.4;
        text-align: center;
        width: 100%;
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
      }
      .photo-number {
        font-weight: 700;
        color: #16b12b;
        margin-bottom: 4px;
      }
      .photo-location {
        font-weight: 600;
        margin-bottom: 2px;
      }
      .photo-materials {
        font-weight: 400;
      }
      .footer {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 16px;
        width: calc(100% - 96px);
        margin: 0 auto;
        text-align: justify;
        font-size: 0.75rem;
        color: #222;
      }
      .footer-line {
        width: 100%;
        height: 4px;
        background: #16b12b;
        margin-bottom: 6px;
        border-radius: 2px;
      }
    </style>
  </head>
  <body>
          <div class="page">
        <div class="header">
          <img
            class="logo"
            src="[LOGO_PATH]"
            alt="Company Logo"
          />
          <div class="company-details">
            Lancaster & Dickenson Consulting Pty Ltd<br />
            4/6 Dacre Street<br />
            Mitchell ACT 2911<br />
            W: <span class="website">www.landd.com.au</span>
          </div>
        </div>
        <div class="header-line"></div>
        <div class="content" style="justify-content: flex-start; align-items: flex-start;">
          [PHOTOGRAPHS_CONTENT]
        </div>
        <div class="footer">
          <div class="footer-line"></div>
          [REPORT_TYPE] Clearance Certificate: [SITE_ADDRESS]
        </div>
      </div>
    </body>
  </html>`,
  page7: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Asbestos Clearance Report - Appendix B</title>
    <link
      href="https://fonts.googleapis.com/css?family=Montserrat:400,700&display=swap"
      rel="stylesheet"
    />
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: "Montserrat", Arial, sans-serif;
        background: #fff;
      }
      .page {
        width: 800px;
        height: 1130px;
        margin: 40px auto;
        background: #fff;
        box-shadow: 0 4px 32px rgba(0, 0, 0, 0.12);
        position: relative;
        padding: 0 0 0 0;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 16px 48px 0 48px;
      }
      .logo {
        width: 243px;
        height: auto;
        display: block;
        background: #fff;
      }
      .company-details {
        text-align: right;
        font-size: 0.75rem;
        color: #222;
        line-height: 1.5;
        margin-top: 8px;
      }
      .company-details .website {
        color: #16b12b;
        font-weight: 500;
      }
      .header-line {
        width: calc(100% - 96px);
        height: 4px;
        background: #16b12b;
        margin: 8px auto 0 auto;
        border-radius: 2px;
      }
      .content {
        padding: 10px 48px 24px 48px;
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
      }
      .section-header {
        font-size: 0.9rem;
        font-weight: 700;
        text-transform: uppercase;
        margin: 10px 0 10px 0;
        letter-spacing: 0.01em;
        color: #222;
        text-align: center;
      }
      .section-header.first-section {
        margin-top: 18px;
      }
      .air-monitoring-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
      }
      .centered-text {
        font-size: 1.8rem;
        text-transform: uppercase;
        color: #222;
        text-align: center;
        letter-spacing: 0.02em;
      }
      .appendix-title {
        font-weight: 700;
        color: #16b12b;
      }
      .photographs-text {
        font-weight: 400;
      }
      .report-content {
        width: 100%;
        height: 100%;
        border: none;
      }
      .footer {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 16px;
        width: calc(100% - 96px);
        margin: 0 auto;
        text-align: justify;
        font-size: 0.75rem;
        color: #222;
      }
      .footer-line {
        width: 100%;
        height: 4px;
        background: #16b12b;
        margin-bottom: 6px;
        border-radius: 2px;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="header">
        <img
          class="logo"
          src="[LOGO_PATH]"
          alt="Company Logo"
        />
        <div class="company-details">
          Lancaster & Dickenson Consulting Pty Ltd<br />
          4/6 Dacre Street<br />
          Mitchell ACT 2911<br />
          W: <span class="website">www.landd.com.au</span>
        </div>
      </div>
      <div class="header-line"></div>
      <div class="content">
        [AIR_MONITORING_CONTENT]
      </div>
      <div class="footer">
        <div class="footer-line"></div>
        [REPORT_TYPE] Clearance Certificate: [SITE_ADDRESS]
      </div>
    </div>
  </body>
</html>`,
  page8: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Asbestos Clearance Report - Site Plan</title>
    <link
      href="https://fonts.googleapis.com/css?family=Montserrat:400,700&display=swap"
      rel="stylesheet"
    />
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: "Montserrat", Arial, sans-serif;
        background: #fff;
      }
      .page {
        width: 800px;
        height: 1130px;
        margin: 40px auto;
        background: #fff;
        box-shadow: 0 4px 32px rgba(0, 0, 0, 0.12);
        position: relative;
        padding: 0 0 0 0;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 16px 48px 0 48px;
      }
      .logo {
        width: 243px;
        height: auto;
        display: block;
        background: #fff;
      }
      .company-details {
        text-align: right;
        font-size: 0.75rem;
        color: #222;
        line-height: 1.5;
        margin-top: 8px;
      }
      .company-details .website {
        color: #16b12b;
        font-weight: 500;
      }
      .header-line {
        width: calc(100% - 96px);
        height: 4px;
        background: #16b12b;
        margin: 8px auto 0 auto;
        border-radius: 2px;
      }
      .content {
        padding: 10px 48px 24px 48px;
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
      }
      .section-header {
        font-size: 0.9rem;
        font-weight: 700;
        text-transform: uppercase;
        margin: 10px 0 10px 0;
        letter-spacing: 0.01em;
        color: #222;
        text-align: center;
      }
      .section-header.first-section {
        margin-top: 18px;
      }
      .site-plan-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
      }
      .centered-text {
        font-size: 1.8rem;
        text-transform: uppercase;
        color: #222;
        text-align: center;
        letter-spacing: 0.02em;
      }
      .appendix-title {
        font-weight: 700;
        color: #16b12b;
      }
      .photographs-text {
        font-weight: 400;
      }
      .report-content {
        width: 100%;
        height: 100%;
        border: none;
      }
      .footer {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 16px;
        width: calc(100% - 96px);
        margin: 0 auto;
        text-align: justify;
        font-size: 0.75rem;
        color: #222;
      }
      .footer-line {
        width: 100%;
        height: 4px;
        background: #16b12b;
        margin-bottom: 6px;
        border-radius: 2px;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="header">
        <img
          class="logo"
          src="[LOGO_PATH]"
          alt="Company Logo"
        />
        <div class="company-details">
          Lancaster & Dickenson Consulting Pty Ltd<br />
          4/6 Dacre Street<br />
          Mitchell ACT 2911<br />
          W: <span class="website">www.landd.com.au</span>
        </div>
      </div>
      <div class="header-line"></div>
      <div class="content">
        [SITE_PLAN_CONTENT]
      </div>
      <div class="footer">
        <div class="footer-line"></div>
        [REPORT_TYPE] Clearance Certificate: [SITE_ADDRESS]
      </div>
    </div>
  </body>
</html>`
};

/**
 * Populate HTML template with data
 * @param {string} htmlTemplate - HTML template string
 * @param {Object} data - Data to populate
 * @returns {string} - Populated HTML string
 */
// Function to generate main content pages with overflow detection
/**
 * Generate site plan page HTML
 * @param {Object} data - Clearance data
 * @param {string} appendixLetter - Appendix letter (B, C, etc.)
 * @param {string} logoBase64 - Base64 encoded logo
 * @returns {string} - HTML for site plan page
 */
const generateSitePlanPage = (data, appendixLetter = 'B', logoBase64) => {
  // Determine the file type and create appropriate HTML
  const fileType = data.sitePlanFile.startsWith('/9j/') ? 'image/jpeg' : 
                  data.sitePlanFile.startsWith('iVBORw0KGgo') ? 'image/png' : 
                  'application/pdf';
  
  let sitePlanContent = '';
  
  if (fileType.startsWith('image/')) {
    // For images, embed directly with caption
    sitePlanContent = `
      <div class="site-plan-container" style="text-align: center; margin-top: 20px;">
        <img src="data:${fileType};base64,${data.sitePlanFile}" 
             alt="Site Plan" 
             style="max-width: 100%; max-height: 60%; object-fit: contain; margin-bottom: 15px;" />
        <div style="font-size: 14px; font-weight: 600; color: #222; margin-top: 10px;">
          Figure 1: Asbestos Removal Site Plan
        </div>
      </div>
    `;
  } else {
    // For PDFs, show a placeholder (PDFs will be merged separately)
    sitePlanContent = `
      <div class="site-plan-content">
        <div class="centered-text">
          <div class="appendix-title">APPENDIX ${appendixLetter}</div>
          <div class="photographs-text">SITE PLAN</div>
          <div class="site-plan-note">Site plan document attached</div>
        </div>
      </div>
    `;
  }
  
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Asbestos Clearance Report - Site Plan</title>
        <link
          href="https://fonts.googleapis.com/css?family=Montserrat:400,700&display=swap"
          rel="stylesheet"
        />
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: "Montserrat", Arial, sans-serif;
            background: #fff;
          }
          .page {
            width: 800px;
            height: 1130px;
            margin: 40px auto;
            background: #fff;
            box-shadow: 0 4px 32px rgba(0, 0, 0, 0.12);
            position: relative;
            padding: 0 0 0 0;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: 16px 48px 0 48px;
          }
          .logo {
            width: 243px;
            height: auto;
            display: block;
            background: #fff;
          }
          .company-details {
            text-align: right;
            font-size: 0.75rem;
            color: #222;
            line-height: 1.5;
            margin-top: 8px;
          }
          .company-details .website {
            color: #16b12b;
            font-weight: 500;
          }
          .header-line {
            width: calc(100% - 96px);
            height: 4px;
            background: #16b12b;
            margin: 8px auto 0 auto;
            border-radius: 2px;
          }
          .content {
            padding: 10px 48px 24px 48px;
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
          }
          .footer {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 16px;
            width: calc(100% - 96px);
            margin: 0 auto;
            text-align: justify;
            font-size: 0.75rem;
            color: #222;
          }
          .footer-line {
            width: 100%;
            height: 4px;
            background: #16b12b;
            margin-bottom: 6px;
            border-radius: 2px;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <img
              class="logo"
              src="data:image/png;base64,${logoBase64}"
              alt="Company Logo"
            />
            <div class="company-details">
              Lancaster & Dickenson Consulting Pty Ltd<br />
              4/6 Dacre Street<br />
              Mitchell ACT 2911<br />
              W: <span class="website">www.landd.com.au</span>
            </div>
          </div>
          <div class="header-line"></div>
          <div class="content">
            ${sitePlanContent}
          </div>
          <div class="footer">
            <div class="footer-line"></div>
            ${data.clearanceType || 'Non-friable'} Clearance Certificate: ${data.projectId?.name || data.project?.name || 'Unknown Site'}
          </div>
        </div>
      </body>
    </html>
  `;
};

const generateMainContentPages = async (data) => {
  // Generate the main content (page 4) with overflow detection
  const mainContentTemplate = HTML_TEMPLATES.page4;
  
  // Split the content into two parts: main content and signature section
  const mainContentEnd = mainContentTemplate.indexOf('Please do not hesitate to contact');
  const signatureSectionStart = mainContentTemplate.indexOf('<div class="paragraph">\n          Please do not hesitate to contact');
  
  if (mainContentEnd === -1 || signatureSectionStart === -1) {
    // Fallback: return original template if we can't find the split point
    return [await populateTemplate(mainContentTemplate, data)];
  }
  
  // Estimate content height to determine if we need to split
  const clearanceItems = data.clearanceItems || data.removalItems || data.asbestosItems || [];
  const itemsCount = clearanceItems.length;
  
  // More accurate estimation: each table row adds about 35px, plus base content height
  const baseContentHeight = 650; // Approximate height of fixed content (reduced from 800)
  const tableRowHeight = 35; // Approximate height per table row (reduced from 40)
  const estimatedContentHeight = baseContentHeight + (itemsCount * tableRowHeight);
  
  // If estimated content height exceeds page capacity, split the page
  const pageContentCapacity = 1000; // Available space for content (increased from 900)
  const needsSplit = estimatedContentHeight > pageContentCapacity;
  
  console.log(`Content height estimation: ${estimatedContentHeight}px (${itemsCount} items), page capacity: ${pageContentCapacity}px, needs split: ${needsSplit}`);
  
  // console.log(`Content height estimation: ${estimatedContentHeight}px (${itemsCount} items), page capacity: ${pageContentCapacity}px, needs split: ${needsSplit}`);
  
  if (needsSplit) {
    // Create the main content page (everything up to "Please do not hesitate...")
    const mainContentPage = mainContentTemplate.substring(0, signatureSectionStart);
    
    // Create a proper signature page template
    const signaturePageTemplate = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Asbestos Clearance Report - Signature</title>
          <link
            href="https://fonts.googleapis.com/css?family=Montserrat:400,700&display=swap"
            rel="stylesheet"
          />
          <style>
            body {
              margin: 0;
              padding: 0;
              font-family: "Montserrat", Arial, sans-serif;
              background: #fff;
            }
            .page {
              width: 800px;
              height: 1130px;
              margin: 40px auto;
              background: #fff;
              box-shadow: 0 4px 32px rgba(0, 0, 0, 0.12);
              position: relative;
              padding: 0 0 0 0;
              display: flex;
              flex-direction: column;
              justify-content: flex-start;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              padding: 16px 48px 0 48px;
            }
            .logo {
              width: 243px;
              height: auto;
              display: block;
              background: #fff;
            }
            .company-details {
              text-align: right;
              font-size: 0.75rem;
              color: #222;
              line-height: 1.5;
              margin-top: 8px;
            }
            .company-details .website {
              color: #16b12b;
              font-weight: 500;
            }
            .header-line {
              width: calc(100% - 96px);
              height: 4px;
              background: #16b12b;
              margin: 8px auto 0 auto;
              border-radius: 2px;
            }
            .content {
              padding: 10px 48px 24px 48px;
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: flex-start;
            }
            .paragraph {
              font-size: 0.8rem;
              margin-bottom: 12px;
              color: #222;
              line-height: 1.5;
              text-align: justify;
            }
            .signature-block {
              margin-top: 12px;
              margin-bottom: 0;
              font-size: 0.8rem;
              color: #222;
              text-align: justify;
              line-height: 1.5;
            }
            .signature-line {
              margin: 24px 0 8px 0;
              width: 180px;
              border-bottom: 2px solid #444;
              height: 24px;
            }
            .signature-name {
              font-weight: 700;
              margin-top: 8px;
              font-size: 0.8rem;
            }
            .signature-licence {
              font-size: 0.8rem;
              color: #444;
            }
            .footer {
              position: absolute;
              left: 0;
              right: 0;
              bottom: 16px;
              width: calc(100% - 96px);
              margin: 0 auto;
              text-align: justify;
              font-size: 0.75rem;
              color: #222;
            }
            .footer-line {
              width: 100%;
              height: 4px;
              background: #16b12b;
              margin-bottom: 6px;
              border-radius: 2px;
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header">
              <img
                class="logo"
                src="[LOGO_PATH]"
                alt="Company Logo"
              />
              <div class="company-details">
                Lancaster & Dickenson Consulting Pty Ltd<br />
                4/6 Dacre Street<br />
                Mitchell ACT 2911<br />
                W: <span class="website">www.landd.com.au</span>
              </div>
            </div>
            <div class="header-line"></div>
            <div class="content" style="justify-content: flex-start; align-items: flex-start;">
              ${mainContentTemplate.substring(signatureSectionStart)}
            </div>
            <div class="footer">
              <div class="footer-line"></div>
              [FOOTER_TEXT]
            </div>
          </div>
        </body>
      </html>
    `;
    
    // Populate both templates with data
    const populatedMainContent = await populateTemplate(mainContentPage, data);
    const populatedSignaturePage = await populateTemplate(signaturePageTemplate, data);
    
    return [populatedMainContent, populatedSignaturePage];
  } else {
    // No split needed, return original template
    return [await populateTemplate(mainContentTemplate, data)];
  }
};

const populateTemplate = async (htmlTemplate, data, appendixLetter = 'B') => {
  
  // Determine template type based on clearance type
  let templateType = 'asbestosClearanceNonFriable'; // default
  if (data.clearanceType === 'Friable') {
    templateType = 'asbestosClearanceFriable';
  }
  
  // Fetch template content based on clearance type
  let templateContent = null;
  try {
    console.log(`[DEBUG] Attempting to fetch template for type: ${templateType}`);
    templateContent = await getTemplateByType(templateType);
    console.log(`[DEBUG] Template content fetched successfully for ${templateType}`);
    console.log(`[DEBUG] Template content has standardSections:`, !!templateContent?.standardSections);
    if (templateContent?.standardSections) {
      console.log(`[DEBUG] Available sections:`, Object.keys(templateContent.standardSections));
    }
  } catch (error) {
    console.error('[DEBUG] Error fetching template content:', error);
    // Continue with hardcoded content as fallback
  }

  // Look up user's Asbestos Assessor licence number
  let laaLicenceNumber = 'AA00031'; // Default fallback
  let userSignature = null;
  if (data.LAA) {
    try {
      console.log('[DEBUG] LAA value from clearance:', data.LAA);
      const User = require('../models/User');
      const user = await User.findOne({
        $or: [
          { firstName: { $regex: new RegExp(data.LAA.split(' ')[0], 'i') }, lastName: { $regex: new RegExp(data.LAA.split(' ')[1] || '', 'i') } },
          { firstName: { $regex: new RegExp(data.LAA, 'i') } },
          { lastName: { $regex: new RegExp(data.LAA, 'i') } }
        ]
      });
      if (user) {
        console.log('[DEBUG] User found for LAA:', user.firstName, user.lastName, user.email);
        
        // Get user's signature
        if (user.signature) {
          userSignature = user.signature;
          console.log('[DEBUG] Found signature for user:', user.firstName, user.lastName);
        }
        
        if (user.licences && user.licences.length > 0) {
          const asbestosAssessorLicence = user.licences.find(licence => 
            licence.licenceType === 'Asbestos Assessor' || 
            licence.licenceType === 'LAA'
          );
          if (asbestosAssessorLicence) {
            laaLicenceNumber = asbestosAssessorLicence.licenceNumber;
            console.log('[DEBUG] Found LAA licence:', laaLicenceNumber);
          } else {
            console.log('[DEBUG] No Asbestos Assessor licence found for user');
          }
        } else {
          console.log('[DEBUG] No licences found for user');
        }
      } else {
        console.log('[DEBUG] No user found for LAA:', data.LAA);
      }
    } catch (error) {
      console.error('[DEBUG] Error looking up user licence:', error);
    }
  }
  console.log('[DEBUG] LAA_LICENSE used in template:', laaLicenceNumber);
  
  // Replace logo placeholders with actual img tags
  let templateWithLogoPath = htmlTemplate.replace(/\[LOGO_PATH\]/g, '');
  
  try {
    templateWithLogoPath = templateWithLogoPath.replace(
      /<img\s+class="logo"[^>]*>/g,
      '<img class="logo" src="data:image/png;base64,' + logoBase64 + '" alt="Company Logo" />'
    );

  } catch (error) {
    writeLog('Logo img replacement failed: ' + error.message);
  }
  
  try {
    templateWithLogoPath = templateWithLogoPath.replace(
      /<div\s+class="logo"[^>]*>/g,
      '<img class="logo" src="data:image/png;base64,' + logoBase64 + '" alt="Company Logo" />'
    );
    console.log('Logo div replacement successful');
  } catch (error) {
    console.error('Logo div replacement failed:', error);
  }
  
  // Debug: Check what's in the template before replacement (only for page1)
  if (htmlTemplate.includes('cover-bg')) {
    console.log('=== PAGE1 BACKGROUND DEBUG ===');
    const backgroundDivMatch = templateWithLogoPath.match(/<div\s+class="cover-bg"[^>]*>/);
    console.log('Background div found in template:', !!backgroundDivMatch);
    if (backgroundDivMatch) {
      console.log('Background div content:', backgroundDivMatch[0]);
    }
  }
  
  // Add background image as simple img tag for cover page
  if (htmlTemplate.includes('cover-bg')) {
    console.log('=== BACKGROUND REPLACEMENT DEBUG ===');
    console.log('Template contains cover-bg:', htmlTemplate.includes('cover-bg'));
    console.log('Background base64 available:', !!backgroundBase64);
    console.log('Background base64 length:', backgroundBase64?.length);
    
    try {
      // Remove the original background div completely
      const beforeRemoval = templateWithLogoPath.includes('cover-bg');
      templateWithLogoPath = templateWithLogoPath.replace(
        /<div\s+class="cover-bg"[^>]*><\/div>/g,
        ''
      );
      const afterRemoval = templateWithLogoPath.includes('cover-bg');
      console.log('Background div removal - before:', beforeRemoval, 'after:', afterRemoval);
      
      // Add simple background image at the start of cover-container
      const beforeAddition = templateWithLogoPath.includes('cover-container');
      templateWithLogoPath = templateWithLogoPath.replace(
        /<div class="cover-container">/g,
        '<div class="cover-container"><img src="data:image/jpeg;base64,' + backgroundBase64 + '" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;" /><svg style="position: absolute; top: 0; left: 0; width: 432px; height: 100%; z-index: 1; fill: white;" viewBox="0 0 432 1130" xmlns="http://www.w3.org/2000/svg"><polygon points="80,-10 426,240 426,884 80,1134 0,1134 0,0" /></svg>'
      );
      const afterAddition = templateWithLogoPath.includes('data:image/jpeg;base64');
      console.log('Background image addition - before:', beforeAddition, 'after:', afterAddition);
      
      console.log('Simple background image added successfully');
    } catch (error) {
      console.error('Background image addition failed:', error);
    }
  }
  
  // Debug: Check if background replacement worked
  if (htmlTemplate.includes('cover-bg')) {
    console.log('Background replacement check:', templateWithLogoPath.includes('cover-background'));
  }
  
  // Replace cover logo div with img tag (handle inline styles)
  try {
    templateWithLogoPath = templateWithLogoPath.replace(
      /<div\s+class="cover-logo"[^>]*style="[^"]*"[^>]*><\/div>/g,
      '<img class="cover-logo" src="data:image/png;base64,' + logoBase64 + '" alt="Company Logo" />'
    );
    console.log('Cover logo replacement successful');
  } catch (error) {
    console.error('Cover logo replacement failed:', error);
  }
  
  // Generate removal items table from actual data
  const generateRemovalItemsTable = () => {
    // Use actual clearance items if provided, otherwise use sample data
    const clearanceItems = data.clearanceItems || data.removalItems || data.asbestosItems || [
      { item: '1', location: 'Laundry wall sheet', material: 'Fibre cement', type: 'Non-friable' },
      { item: '2', location: 'Bathroom wall sheet', material: 'Fibre cement', type: 'Non-friable' }
    ];
    

    
    return clearanceItems.map((item, index) => 
      `<tr>
        <td>${item.item || item.itemNumber || (index + 1)}</td>
        <td>${item.locationDescription || item.location || item.area || 'Unknown Location'}</td>
        <td>${item.materialDescription || item.material || 'Unknown Material'}</td>
        <td>${item.asbestosType || item.type || 'Non-friable'}</td>
      </tr>`
    ).join('');
  };

  const generatePhotographsContent = () => {
    // Use actual clearance items if provided, otherwise use sample data
    const clearanceItems = data.clearanceItems || data.removalItems || data.asbestosItems || [
      { 
        locationDescription: 'Kitchen Area - North Wall', 
        materialDescription: 'Non-friable asbestos cement sheeting removed from kitchen wall. Area cleaned and prepared for re-cladding.',
        photograph: null
      },
      { 
        locationDescription: 'Laundry - West Wall', 
        materialDescription: 'Non-friable asbestos cement sheeting removed from laundry wall. Surface cleaned and ready for new cladding installation.',
        photograph: null
      }
    ];
    
    // Filter out items that don't have photographs
    const itemsWithPhotos = clearanceItems.filter(item => 
      item.photograph && item.photograph.trim() !== ''
    );
    
    // Only generate content for the first 2 photos (first photo page)
    const firstPageItems = itemsWithPhotos.slice(0, 2);
    
    return firstPageItems.map((item, index) => {
      const photoNumber = index + 1;
      
      return `
        <!-- Photo ${photoNumber} -->
        <div class="photo-container">
          <div class="photo">
            <img src="${item.photograph}" alt="Photograph ${photoNumber}" style="width: 100%; height: 100%; object-fit: contain;" />
          </div>
          <div class="photo-details">
            <div class="photo-number">Photograph ${photoNumber}</div>
            <div class="photo-location">
              ${item.locationDescription || 'Unknown Location'}
            </div>
            <div class="photo-materials">
              ${item.materialDescription || 'Unknown Material'}
            </div>
          </div>
        </div>
      `;
    }).join('');
  };

  const generateAirMonitoringContent = (appendixLetter = 'B') => {
    // Always show placeholder since the actual report is appended as a separate page
    return `
      <div class="air-monitoring-content">
        <div class="centered-text">
          <div class="appendix-title">APPENDIX ${appendixLetter}</div>
          <div class="photographs-text">AIR MONITORING REPORT</div>
        </div>
      </div>
    `;
  };

  const generateSitePlanContent = (appendixLetter = 'B') => {
    // Always show placeholder since the actual site plan is appended as a separate page
    return `
      <div class="site-plan-content">
        <div class="centered-text">
          <div class="appendix-title">APPENDIX ${appendixLetter}</div>
          <div class="photographs-text">SITE PLAN</div>
        </div>
      </div>
    `;
  };



  // Debug: Log only the LAA value for troubleshooting
  console.log('[LAA DEBUG] LAA value from clearance:', data.LAA);

  // Replace placeholders with actual data
  const replacements = {
    '[REPORT_TITLE]': `${data.clearanceType || 'Non-friable'} Asbestos Removal Clearance Certificate`,
    '[SITE_NAME]': data.projectId?.name || data.project?.name || data.siteName || 'Unknown Site',
    '[SITE_ADDRESS]': data.projectId?.name || data.project?.name || data.siteName || 'Unknown Site',
    '[PROJECT_ID]': data.projectId?.projectID || data.project?.projectID || data.projectId || 'Unknown Project',
    '[FILENAME]': (() => {
      const projectId = data.projectId?.projectID || data.project?.projectID || data.projectId || 'Unknown';
      const siteName = data.projectId?.name || data.project?.name || data.siteName || 'Unknown';
      const clearanceDate = data.clearanceDate ? new Date(data.clearanceDate).toLocaleDateString('en-GB').replace(/\//g, '-') : 'Unknown';
      const clearanceType = data.clearanceType || 'Non-friable';
      return `${projectId}: ${clearanceType} Asbestos Clearance Report - ${siteName} (${clearanceDate}).pdf`;
    })(),
    '[CLEARANCE_DATE]': data.clearanceDate 
      ? new Date(data.clearanceDate).toLocaleDateString('en-GB')
      : 'Unknown Date',
    '[CLIENT_NAME]': data.projectId?.client?.name || data.project?.client?.name || data.clientName || 'Unknown Client',
    '[ASBESTOS_TYPE]': data.clearanceType?.toLowerCase() || 'non-friable',
    '[ASBESTOS_REMOVALIST]': data.asbestosRemovalist || 'Unknown Removalist',
    '[LAA_NAME]': data.LAA || data.laaName || 'Unknown LAA',
    '[LAA_LICENSE]': laaLicenceNumber,
    '[INSPECTION_TIME]': data.inspectionTime || 'Inspection Time',
    '[INSPECTION_DATE]': data.clearanceDate 
      ? new Date(data.clearanceDate).toLocaleDateString('en-GB')
      : 'Unknown Date',
    '[REPORT_TYPE]': data.clearanceType || 'Non-friable',
    '[REMOVAL_ITEMS_TABLE]': generateRemovalItemsTable(),
    '[PHOTOGRAPHS_CONTENT]': generatePhotographsContent(),
    '[AIR_MONITORING_CONTENT]': generateAirMonitoringContent(appendixLetter),
    '[SITE_PLAN_CONTENT]': generateSitePlanContent(appendixLetter),
    // Dynamic Appendix text based on what's included
    '[APPENDIX_B_TEXT]': (() => {
      const hasSitePlan = data.sitePlan && data.sitePlanFile;
      const hasAirMonitoring = data.airMonitoring;
      
      if (hasSitePlan && hasAirMonitoring) {
        return 'Photographs of the Asbestos Removal Area, Site Plan, and Air Monitoring Report are presented in Appendix A, Appendix B, and Appendix C respectively.';
      } else if (hasSitePlan) {
        return 'Photographs of the Asbestos Removal Area and Site Plan are presented in Appendix A and Appendix B respectively.';
      } else if (hasAirMonitoring) {
        return 'Photographs of the Asbestos Removal Area and Air Monitoring Report are presented in Appendix A and Appendix B respectively.';
      } else {
        return 'Photographs of the Asbestos Removal Area are presented in Appendix A.';
      }
    })(),
    
    // Signature placeholder
    '[SIGNATURE_IMAGE]': userSignature ? `<img src="${userSignature}" alt="Signature" style="max-width: 150px; max-height: 75px;" />` : '[SIGNATURE_PLACEHOLDER]',
    
    // Template content placeholders
    '[BACKGROUND_INFORMATION_TITLE]': templateContent?.standardSections?.backgroundInformationTitle || 'Background Information Regarding Non-Friable Clearance Inspections',
    '[BACKGROUND_INFORMATION_CONTENT]': templateContent ? await replacePlaceholders(templateContent.standardSections.backgroundInformationContent, data) : 'Background information content not available',
    '[LEGISLATIVE_REQUIREMENTS_TITLE]': templateContent?.standardSections?.legislativeRequirementsTitle || 'Legislative Requirements',
    '[LEGISLATIVE_REQUIREMENTS_CONTENT]': templateContent ? await replacePlaceholders(templateContent.standardSections.legislativeRequirementsContent, data) : 'Legislative requirements content not available',
    
    // Handle limitations based on clearance type
    '[NON_FRIABLE_CLEARANCE_CERTIFICATE_LIMITATIONS_TITLE]': data.clearanceType === 'Friable' 
      ? (templateContent?.standardSections?.friableClearanceCertificateLimitationsTitle || 'Friable Clearance Certificate Limitations')
      : (templateContent?.standardSections?.nonFriableClearanceCertificateLimitationsTitle || 'Non-Friable Clearance Certificate Limitations'),
    '[NON_FRIABLE_CLEARANCE_CERTIFICATE_LIMITATIONS_CONTENT]': data.clearanceType === 'Friable'
      ? (templateContent ? await replacePlaceholders(templateContent.standardSections.friableClearanceCertificateLimitationsContent, data) : 'Friable clearance certificate limitations content not available')
      : (templateContent ? await replacePlaceholders(templateContent.standardSections.nonFriableClearanceCertificateLimitationsContent, data) : 'Non-friable clearance certificate limitations content not available'),
    '[INSPECTION_DETAILS_TITLE]': templateContent?.standardSections?.inspectionDetailsTitle || 'Inspection Details',
    '[INSPECTION_DETAILS_CONTENT]': templateContent ? await replacePlaceholders(templateContent.standardSections.inspectionDetailsContent, data) : 'Inspection details content not available',
    '[INSPECTION_EXCLUSIONS_TITLE]': templateContent?.standardSections?.inspectionExclusionsTitle || 'Inspection Exclusions',
    '[INSPECTION_EXCLUSIONS_CONTENT]': 'PLACEHOLDER_FOR_EXCLUSIONS',
    '[CLEARANCE_CERTIFICATION_TITLE]': templateContent?.standardSections?.clearanceCertificationTitle || 'Clearance Certification',
    '[CLEARANCE_CERTIFICATION_CONTENT]': templateContent ? await replacePlaceholders(templateContent.standardSections.clearanceCertificationContent, data) : 'Clearance certification content not available',
    '[SIGN_OFF_CONTENT]': templateContent ? await replacePlaceholders(templateContent.standardSections.signOffContent, data) : 'Sign-off content not available',
    '[FOOTER_TEXT]': templateContent ? await replacePlaceholders(templateContent.standardSections.footerText, data) : `${data.clearanceType || 'Non-friable'} Clearance Certificate: ${data.projectId?.name || data.project?.name || 'Unknown Site'}`,
    
    // Dynamic conditional text based on site plan and air monitoring
    '[SITE_PLAN_TEXT]': (() => {
      const hasSitePlan = data.sitePlan && data.sitePlanFile;
      return hasSitePlan ? 'A site plan of the Asbestos Removal Area is presented in Appendix B.' : '';
    })(),
    '[AIR_MONITORING_TEXT]': (() => {
      const hasAirMonitoring = data.airMonitoring;
      const hasSitePlan = data.sitePlan && data.sitePlanFile;
      const appendixLetter = hasSitePlan ? 'C' : 'B';
      return hasAirMonitoring ? `Results of air monitoring were satisfactory (below the recommended control limit of 0.01 fibres per mL). The air monitoring report for this clearance is presented in Appendix ${appendixLetter} of this report.` : '';
    })(),
    // Template service placeholder for appendix references
    '{APPENDIX_REFERENCES}': (() => {
      const hasSitePlan = data.sitePlan && data.sitePlanFile;
      const hasAirMonitoring = data.airMonitoring;
      
      console.log('[DEBUG] Appendix references - hasSitePlan:', hasSitePlan, 'hasAirMonitoring:', hasAirMonitoring);
      
      if (hasSitePlan && hasAirMonitoring) {
        const text = 'Photographs of the Asbestos Removal Area, Site Plan, and Air Monitoring Report are presented in Appendix A, Appendix B, and Appendix C respectively.';
        console.log('[DEBUG] Appendix text (both):', text);
        return text;
      } else if (hasSitePlan) {
        const text = 'Photographs of the Asbestos Removal Area and Site Plan are presented in Appendix A and Appendix B respectively.';
        console.log('[DEBUG] Appendix text (site plan only):', text);
        return text;
      } else if (hasAirMonitoring) {
        const text = 'Photographs of the Asbestos Removal Area and Air Monitoring Report are presented in Appendix A and Appendix B respectively.';
        console.log('[DEBUG] Appendix text (air monitoring only):', text);
        return text;
      } else {
        const text = 'Photographs of the Asbestos Removal Area are presented in Appendix A.';
        console.log('[DEBUG] Appendix text (neither):', text);
        return text;
      }
    })(),
    '[APPENDIX_REFERENCES]': (() => {
      const hasSitePlan = data.sitePlan && data.sitePlanFile;
      const hasAirMonitoring = data.airMonitoring;
      
      console.log('[DEBUG] Appendix references (square brackets) - hasSitePlan:', hasSitePlan, 'hasAirMonitoring:', hasAirMonitoring);
      
      if (hasSitePlan && hasAirMonitoring) {
        const text = 'Photographs of the Asbestos Removal Area, Site Plan, and Air Monitoring Report are presented in Appendix A, Appendix B, and Appendix C respectively.';
        console.log('[DEBUG] Appendix text (both):', text);
        return text;
      } else if (hasSitePlan) {
        const text = 'Photographs of the Asbestos Removal Area and Site Plan are presented in Appendix A and Appendix B respectively.';
        console.log('[DEBUG] Appendix text (site plan only):', text);
        return text;
      } else if (hasAirMonitoring) {
        const text = 'Photographs of the Asbestos Removal Area and Air Monitoring Report are presented in Appendix A and Appendix B respectively.';
        console.log('[DEBUG] Appendix text (air monitoring only):', text);
        return text;
      } else {
        const text = 'Photographs of the Asbestos Removal Area are presented in Appendix A.';
        console.log('[DEBUG] Appendix text (neither):', text);
        return text;
      }
    })(),
  };

  let populatedHTML = templateWithLogoPath;
  Object.entries(replacements).forEach(([placeholder, value]) => {
    populatedHTML = populatedHTML.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  });

  // Handle exclusions content with job-specific exclusions
  let exclusionsContent = templateContent ? await replacePlaceholders(templateContent.standardSections.inspectionExclusionsContent, data) : 'Inspection exclusions content not available';
  
  // Append job-specific exclusions if they exist
  if (data.jobSpecificExclusions && data.jobSpecificExclusions.trim() !== '') {
    console.log('[DEBUG] Adding job-specific exclusions:', data.jobSpecificExclusions);
    exclusionsContent += '\n\n' + data.jobSpecificExclusions;
  } else {
    console.log('[DEBUG] No job-specific exclusions found');
  }
  
  // Replace the placeholder with the final exclusions content
  populatedHTML = populatedHTML.replace(/PLACEHOLDER_FOR_EXCLUSIONS/g, exclusionsContent);

  return populatedHTML;
};

/**
 * Merge two PDFs together
 * @param {Buffer} pdf1Buffer - First PDF buffer (clearance report)
 * @param {string} pdf2Base64 - Second PDF as base64 string (air monitoring report)
 * @returns {Promise<Buffer>} - Merged PDF as buffer
 */
const mergePDFs = async (pdf1Buffer, pdf2Base64) => {
  try {
    console.log('=== PDF MERGING DEBUG ===');
    console.log('pdf1Buffer length:', pdf1Buffer.length);
    console.log('pdf2Base64 length:', pdf2Base64 ? pdf2Base64.length : 'null/undefined');
    console.log('pdf2Base64 starts with:', pdf2Base64 ? pdf2Base64.substring(0, 50) : 'N/A');
    
    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();
    console.log('Created merged PDF document');
    
    // Load the first PDF (clearance report)
    const pdf1Doc = await PDFDocument.load(pdf1Buffer);
    console.log('Loaded clearance PDF, pages:', pdf1Doc.getPageCount());
    const pdf1Pages = await mergedPdf.copyPages(pdf1Doc, pdf1Doc.getPageIndices());
    pdf1Pages.forEach((page) => mergedPdf.addPage(page));
    console.log('Added clearance pages to merged PDF');
    
    // Load the second PDF (air monitoring report) from base64
    // Handle both pure base64 and data URL formats
    let cleanBase64 = pdf2Base64;
    if (pdf2Base64.startsWith('data:')) {
      cleanBase64 = pdf2Base64.split(',')[1];
      console.log('Removed data URL prefix from air monitoring report');
    }
    const pdf2Buffer = Buffer.from(cleanBase64, 'base64');
    console.log('Converted base64 to buffer, length:', pdf2Buffer.length);
    const pdf2Doc = await PDFDocument.load(pdf2Buffer);
    console.log('Loaded air monitoring PDF, pages:', pdf2Doc.getPageCount());
    const pdf2Pages = await mergedPdf.copyPages(pdf2Doc, pdf2Doc.getPageIndices());
    pdf2Pages.forEach((page) => mergedPdf.addPage(page));
    console.log('Added air monitoring pages to merged PDF');
    
    // Save the merged PDF
    const mergedPdfBytes = await mergedPdf.save();
    console.log('Saved merged PDF, total pages:', mergedPdf.getPageCount());
    console.log('=== PDF MERGING COMPLETED ===');
    return Buffer.from(mergedPdfBytes);
  } catch (error) {
    console.error('Error in mergePDFs:', error);
    console.error('Error stack:', error.stack);
    throw error;
  }
};

/**
 * Generate PDF from HTML templates using Puppeteer
 * @param {string} templateType - Type of template (e.g., 'asbestos-clearance')
 * @param {Object} data - Clearance data
 * @returns {Promise<Buffer>} - Generated PDF as buffer
 */
const generatePDFFromHTML = async (templateType, data) => {
  let browser;
  try {
    writeLog('Starting server-side PDF generation with 7-page template...');
    writeLog('Template type: ' + templateType);
    writeLog('Data received for project: ' + (data.projectId?.name || 'Unknown project'));
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    writeLog('Populating all 7 template pages...');
    writeLog('Number of templates available: ' + Object.keys(HTML_TEMPLATES).length);
    
    // Create complete HTML document with dynamic pages
    writeLog('Available templates: ' + Object.keys(HTML_TEMPLATES).join(', '));
    
    // Generate all pages content first
    const templates = Object.values(HTML_TEMPLATES);
    const clearanceItems = data.clearanceItems || data.removalItems || data.asbestosItems || [];
    
    // Filter out items that don't have photographs
    const itemsWithPhotos = clearanceItems.filter(item => 
      item.photograph && item.photograph.trim() !== ''
    );
    
    const photosPerPage = 2;
    const totalPhotoPages = Math.ceil(itemsWithPhotos.length / photosPerPage);
    writeLog(`Need ${totalPhotoPages} photo pages for ${itemsWithPhotos.length} items with photos (out of ${clearanceItems.length} total items)`);
    
    let pagesContent = '';
    
    // Process pages 1-2 (cover, version control)
    for (let i = 0; i < 2; i++) {
      writeLog(`Template ${i + 1} contains cover-bg: ${templates[i].includes('cover-bg')}`);
      const populatedTemplate = await populateTemplate(templates[i], data);
      pagesContent += `<div class="page-break">${populatedTemplate}</div>`;
    }
    
    // Generate main content pages (page 4 with potential overflow handling) - now page 3
    const mainContentPages = await generateMainContentPages(data);
    mainContentPages.forEach(page => {
      pagesContent += `<div class="page-break">${page}</div>`;
    });
    
    // Add background information page (page 3) - now page 4
    const populatedBackgroundTemplate = await populateTemplate(templates[2], data);
    pagesContent += `<div class="page-break">${populatedBackgroundTemplate}</div>`;
    
    // Add Appendix A (page 5)
    const populatedTemplate = await populateTemplate(templates[4], data);
    pagesContent += `<div class="page-break">${populatedTemplate}</div>`;
    
    // Add first photo page (page 6)
    const populatedPhotoTemplate = await populateTemplate(templates[5], data);
    pagesContent += `<div class="page-break">${populatedPhotoTemplate}</div>`;
    
    // Add extra photo pages before Appendix B
    if (totalPhotoPages > 1) {
      for (let pageIndex = 1; pageIndex < totalPhotoPages; pageIndex++) {
        const startIndex = pageIndex * photosPerPage;
        const endIndex = Math.min(startIndex + photosPerPage, itemsWithPhotos.length);
        const pageItems = itemsWithPhotos.slice(startIndex, endIndex);
        
        const photoContent = pageItems.map((item, index) => {
          const photoNumber = startIndex + index + 1;
          
          return `
            <!-- Photo ${photoNumber} -->
            <div class="photo-container">
              <div class="photo">
                <img src="${item.photograph}" alt="Photograph ${photoNumber}" style="width: 100%; height: 100%; object-fit: contain;" />
              </div>
              <div class="photo-details">
                <div class="photo-number">Photograph ${photoNumber}</div>
                <div class="photo-location">
                  ${item.locationDescription || 'Unknown Location'}
                </div>
                <div class="photo-materials">
                  ${item.materialDescription || 'Unknown Material'}
                </div>
              </div>
            </div>
          `;
        }).join('');
        
        // Use populateTemplate to ensure logo and other data are included
        const extraPhotoPageTemplate = HTML_TEMPLATES.page6.replace('[PHOTOGRAPHS_CONTENT]', photoContent);
        const populatedExtraPhotoPage = await populateTemplate(extraPhotoPageTemplate, data);
        pagesContent += `<div class="page-break">${populatedExtraPhotoPage}</div>`;
      }
    }
    
    // Determine appendix numbering based on what's included
    const hasSitePlan = data.sitePlan && data.sitePlanFile;
    const hasAirMonitoring = data.airMonitoring;
    
    console.log('[DEBUG] Site plan check:', {
      sitePlan: data.sitePlan,
      sitePlanFile: !!data.sitePlanFile,
      hasSitePlan: hasSitePlan
    });
    
    // Add Site Plan as Appendix B (if present)
    if (hasSitePlan) {
      console.log('[DEBUG] Adding site plan page as Appendix B');
      // Use the new site plan template for cover page
      const populatedSitePlanTemplate = await populateTemplate(HTML_TEMPLATES.page8, data, 'B');
      pagesContent += `<div class="page-break">${populatedSitePlanTemplate}</div>`;
      // Then add the actual site plan content page
      const sitePlanPage = generateSitePlanPage(data, 'B', logoBase64);
      pagesContent += `<div class="page-break">${sitePlanPage}</div>`;
    } else {
      console.log('[DEBUG] No site plan to add');
    }
    
    // Add Air Monitoring Report as Appendix B or C (depending on site plan presence)
    if (hasAirMonitoring) {
      const appendixLetter = hasSitePlan ? 'C' : 'B';
      const populatedAirMonitoring = await populateTemplate(templates[6], data, appendixLetter);
      pagesContent += `<div class="page-break">${populatedAirMonitoring}</div>`;
    }

    const completeHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Asbestos Clearance Report</title>
        <link href="https://fonts.googleapis.com/css?family=Montserrat:400,700&display=swap" rel="stylesheet">
        <style>
          .logo {
            width: 243px !important;
            height: 80px !important;
            min-width: 243px !important;
            min-height: 80px !important;
            max-width: 243px !important;
            max-height: 80px !important;
            display: block !important;
            object-fit: contain !important;
          }
          .cover-logo {
            width: 180px !important;
            height: 60px !important;
            display: block !important;
            object-fit: contain !important;
          }
          .cover-background {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
            z-index: -1 !important;
          }

          body {
            margin: 0;
            padding: 0;
            font-family: "Montserrat", Arial, sans-serif;
          }
          .page-break {
            page-break-after: always;
            margin: 0;
            padding: 0;
          }
          .page-break:last-child {
            page-break-after: avoid;
          }
          /* Remove all margins and padding from page containers */
          .page-break > div {
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Ensure cover container starts at top */
          .cover-container {
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Remove margins from all page elements */
          .page {
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Override all page containers */
          .page, .cover-container {
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Ensure all content starts at top */
          body > div {
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Make header-line match green-line positioning */
          .header-line {
            margin: 8px auto 0 auto !important;
          }
          /* Fix logo sizing and positioning */
          .logo {
            width: 243px !important;
            height: auto !important;
            max-height: 80px !important;
          }
          /* Override any inline height/width attributes */
          .logo[height], .logo[width] {
            height: auto !important;
            width: 243px !important;
          }
        </style>
      </head>
      <body>
        ${pagesContent}
      </body>
      </html>
    `;

    console.log('Complete HTML generated, length:', completeHTML.length);
    
    // Compress images in HTML to reduce file size
    console.log('Compressing images in HTML to 100KB each...');
    const compressedHTML = await compressImagesInHTML(completeHTML, 100);
    console.log('Image compression completed, HTML length:', compressedHTML.length);
    

    
    console.log('Generating PDF with clearance pages and air monitoring report...');
    
    // Set content and generate PDF
    await page.setContent(compressedHTML, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0',
        right: '0',
        bottom: '0',
        left: '0'
      },
      preferCSSPageSize: false,
      // Optimize for smaller file size
      displayHeaderFooter: false,
      omitBackground: false,
      // Additional optimization settings
      scale: 1.0,
      landscape: false
    });

    console.log('PDF generation completed successfully');
    console.log('PDF buffer size:', pdf.length);
    
    // If there's an air monitoring report, merge it with the generated PDF
    if (data.airMonitoringReport) {
      console.log('=== AIR MONITORING REPORT DEBUG ===');
      console.log('airMonitoringReport exists:', !!data.airMonitoringReport);
      console.log('airMonitoringReport type:', typeof data.airMonitoringReport);
      console.log('airMonitoringReport length:', data.airMonitoringReport ? data.airMonitoringReport.length : 'N/A');
      console.log('airMonitoringReport starts with:', data.airMonitoringReport ? data.airMonitoringReport.substring(0, 100) : 'N/A');
      
      try {
        console.log('Merging air monitoring report with clearance PDF...');
        const mergedPdf = await mergePDFs(pdf, data.airMonitoringReport);
        console.log('PDFs merged successfully, new size:', mergedPdf.length);
        return mergedPdf; // Return merged PDF immediately
      } catch (error) {
        console.error('Error merging PDFs:', error);
        console.log('Returning original PDF without air monitoring report');
      }
    } else {
      console.log('No air monitoring report found in data');
    }

    // If there's a site plan PDF, merge it with the generated PDF
    if (data.sitePlan && data.sitePlanFile && !data.sitePlanFile.startsWith('/9j/') && !data.sitePlanFile.startsWith('iVBORw0KGgo')) {
      console.log('=== SITE PLAN PDF DEBUG ===');
      console.log('sitePlanFile exists:', !!data.sitePlanFile);
      console.log('sitePlanFile type:', typeof data.sitePlanFile);
      console.log('sitePlanFile length:', data.sitePlanFile ? data.sitePlanFile.length : 'N/A');
      
      try {
        console.log('Merging site plan PDF with clearance PDF...');
        const mergedPdf = await mergePDFs(pdf, data.sitePlanFile);
        console.log('PDFs merged successfully, new size:', mergedPdf.length);
        return mergedPdf;
      } catch (error) {
        console.error('Error merging site plan PDFs:', error);
        console.log('Returning PDF without site plan');
        return pdf;
      }
    } else {
      console.log('No site plan PDF found in data or site plan is an image');
    }
    
    return pdf;
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

// Test route to verify server is using updated code
router.get('/test', (req, res) => {
  res.json({ 
    message: 'PDF route updated', 
    templateCount: Object.keys(HTML_TEMPLATES).length,
    templates: Object.keys(HTML_TEMPLATES),
    timestamp: new Date().toISOString()
  });
});

// Route to generate asbestos clearance PDF
router.post('/generate-asbestos-clearance', async (req, res) => {
  try {
    writeLog('=== PDF GENERATION REQUEST RECEIVED ===');
    writeLog('Request received for clearance ID: ' + req.body.clearanceData?._id);
    const { clearanceData } = req.body;
    
    if (!clearanceData) {
      console.log('ERROR: No clearance data provided');
      return res.status(400).json({ error: 'Clearance data is required' });
    }

    writeLog('Clearance data received for: ' + (clearanceData.projectId?.name || 'Unknown project'));
    
    const clearanceItems = clearanceData.items || [];
    writeLog('Clearance items found: ' + clearanceItems.length);
    
    // Add clearance items to the data
    const enrichedData = {
      ...clearanceData,
      clearanceItems: clearanceItems
    };
    
    writeLog('Generating PDF with 7-page template and clearance items...');
    
    // Generate PDF
    const pdfBuffer = await generatePDFFromHTML('asbestos-clearance', enrichedData);
    
    console.log('PDF generated successfully, buffer size:', pdfBuffer.length);
    
    // Skip compression since it's not effective - focus on source optimization
    console.log('Skipping PDF compression - using source optimization instead');
    const compressedPdfBuffer = pdfBuffer;
    
    console.log('Using original PDF buffer, size:', compressedPdfBuffer.length);
    
    // Generate filename
    const fileName = `asbestos-clearance-${clearanceData.projectId?.name || 'report'}-${new Date().toISOString().split('T')[0]}.pdf`;
    
    console.log('Sending compressed PDF response with filename:', fileName);
    
    // Set response headers with CORS support
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', compressedPdfBuffer.length);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Send compressed PDF buffer
    res.send(compressedPdfBuffer);
    
    console.log('=== PDF GENERATION COMPLETED SUCCESSFULLY ===');
    
  } catch (error) {
    console.error('Error in PDF generation route:', error);
    res.status(500).json({ error: 'Failed to generate PDF', details: error.message });
  }
});

// Handle preflight requests for CORS
router.options('/generate-asbestos-clearance', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma, Expires');
  res.status(200).end();
});

module.exports = router; 