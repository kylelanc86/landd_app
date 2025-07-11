const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const router = express.Router();
const { ultraCompressPDF } = require('../utils/pdfCompressor');
const { compressImagesInHTML } = require('../utils/imageCompressor');
const { getTemplateByType, replacePlaceholders } = require('../services/templateService');
const { generateRiskAssessmentTable } = require('../models/defaultcontent/RiskAssessmentTable');

// Function to process Risk Assessment content and create a proper table
const processRiskAssessmentContent = (content) => {
  if (!content) return content;
  
  // Split content into parts before and after the table
  const parts = content.split('Each ACM is categorised into one of four (4) risk categories:');
  if (parts.length !== 2) {
    return content;
  }
  
  const beforeTable = parts[0];
  const afterTable = parts[1];
  
  // Use the new table generation system
  const tableHTML = generateRiskAssessmentTable();
  
  // Find where the table content ends (look for the next section or end)
  const remainingContent = afterTable.split('\n\n').slice(1).join('\n\n');
  
  // Combine the content
  const result = beforeTable + 'Each ACM is categorised into one of four (4) risk categories:' + tableHTML + (remainingContent ? '\n\n' + remainingContent : '');
  
  return result;
};

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
  // Generate the main content (page 3) with conditional block-based overflow detection
  const mainContentTemplate = HTML_TEMPLATES.page4;
  
  // Define the logical blocks for page 3 (in order of appearance)
  const blocks = [
    {
      name: 'Inspection Details',
      startMarker: '[INSPECTION_DETAILS_TITLE]',
      endMarker: '[REMOVAL_ITEMS_TABLE]',
      overflowProbability: 'Very Low'
    },
    {
      name: 'Table of Asbestos Removal Areas',
      startMarker: '[REMOVAL_ITEMS_TABLE]',
      endMarker: '[INSPECTION_EXCLUSIONS_TITLE]',
      overflowProbability: 'Very Low'
    },
    {
      name: 'Inspection Exclusions',
      startMarker: '[INSPECTION_EXCLUSIONS_TITLE]',
      endMarker: '[CLEARANCE_CERTIFICATION_TITLE]',
      overflowProbability: 'Low'
    },
    {
      name: 'Clearance Certification',
      startMarker: '[CLEARANCE_CERTIFICATION_TITLE]',
      endMarker: '[SIGN_OFF_CONTENT]',
      overflowProbability: 'Low'
    },
    {
      name: 'Sign-off Content',
      startMarker: '[SIGN_OFF_CONTENT]',
      endMarker: '[FOOTER_TEXT]',
      overflowProbability: 'Medium (5% of jobs)'
    }
  ];
  
  // Estimate content height for each block
  const clearanceItems = data.clearanceItems || data.removalItems || data.asbestosItems || [];
  const itemsCount = clearanceItems.length;
  
  // Base heights for each block (approximate)
  const blockHeights = {
    'Inspection Details': 150, // Fixed height
    'Table of Asbestos Removal Areas': 100 + (itemsCount * 35), // Header + rows
    'Inspection Exclusions': 200, // Variable based on content
    'Clearance Certification': 150, // Variable based on content
    'Sign-off Content': 300 // Variable based on content
  };
  
  // Calculate cumulative height as we add each block
  let cumulativeHeight = 0;
  const blocksForFirstPage = [];
  const blocksForSecondPage = [];
  
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const blockHeight = blockHeights[block.name];
    const pageContentCapacity = 1000; // Available space for content
    
    // Check if this block would cause overflow
    if (cumulativeHeight + blockHeight > pageContentCapacity || data.forcePageSplit) {
      // Only this specific block goes to second page, not all remaining blocks
      console.log(`Block "${block.name}" would cause overflow (${cumulativeHeight + blockHeight}px > ${pageContentCapacity}px)`);
      blocksForSecondPage.push(block);
      
      // Continue checking remaining blocks to see if they fit on first page
      let remainingHeight = cumulativeHeight;
      for (let j = i + 1; j < blocks.length; j++) {
        const nextBlock = blocks[j];
        const nextBlockHeight = blockHeights[nextBlock.name];
        
        if (remainingHeight + nextBlockHeight <= pageContentCapacity) {
          // This block can fit on first page
          blocksForFirstPage.push(nextBlock);
          remainingHeight += nextBlockHeight;
        } else {
          // This block also overflows, goes to second page
          console.log(`Block "${nextBlock.name}" also overflows, moving to second page`);
          blocksForSecondPage.push(nextBlock);
        }
      }
      break;
    } else {
      // This block fits on first page
      blocksForFirstPage.push(block);
      cumulativeHeight += blockHeight;
    }
  }
  
  console.log(`Page 3 block analysis: ${blocksForFirstPage.length} blocks on first page, ${blocksForSecondPage.length} blocks on second page`);
  console.log('First page blocks:', blocksForFirstPage.map(b => b.name));
  console.log('Second page blocks:', blocksForSecondPage.map(b => b.name));
  
  // If no blocks need to go to second page, return single page
  if (blocksForSecondPage.length === 0) {
    console.log('NO SPLIT NEEDED: All blocks fit on single page');
    return [await populateTemplate(mainContentTemplate, data)];
  }
  
    // Create dynamic templates based on which blocks are on each page
  const createPageTemplate = (pageBlocks, pageNumber) => {
    const hasInspectionDetails = pageBlocks.some(b => b.name === 'Inspection Details');
    const hasTable = pageBlocks.some(b => b.name === 'Table of Asbestos Removal Areas');
    const hasExclusions = pageBlocks.some(b => b.name === 'Inspection Exclusions');
    const hasCertification = pageBlocks.some(b => b.name === 'Clearance Certification');
    const hasSignOff = pageBlocks.some(b => b.name === 'Sign-off Content');
    
    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Asbestos Clearance Report - Main Content (Page ${pageNumber})</title>
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
              ${hasInspectionDetails ? `
                <div class="section-header first-section" style="margin-top: 8px;">[INSPECTION_DETAILS_TITLE]</div>
                <div class="paragraph">
                  [INSPECTION_DETAILS_CONTENT]
                </div>
              ` : ''}
              
              ${hasTable ? `
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
              ` : ''}
              
              ${hasExclusions ? `
                <div class="section-header">[INSPECTION_EXCLUSIONS_TITLE]</div>
                <div class="paragraph">
                  [INSPECTION_EXCLUSIONS_CONTENT]
                </div>
              ` : ''}
              
              ${hasCertification ? `
                <div class="section-header">[CLEARANCE_CERTIFICATION_TITLE]</div>
                <div class="paragraph">
                  [CLEARANCE_CERTIFICATION_CONTENT]
                </div>
              ` : ''}
              
              ${hasSignOff ? `
                <div class="paragraph">
                  [SIGN_OFF_CONTENT]
                </div>
              ` : ''}
            </div>
            <div class="footer">
              <div class="footer-line"></div>
              [FOOTER_TEXT]
            </div>
          </div>
        </body>
      </html>
    `;
  };
  
  // Create templates for each page based on their blocks
  const firstPageTemplate = createPageTemplate(blocksForFirstPage, 1);
  const secondPageTemplate = createPageTemplate(blocksForSecondPage, 2);
  
  // Populate both templates with data
  console.log('SPLITTING PAGE 3: Populating first page...');
  const populatedFirstPage = await populateTemplate(firstPageTemplate, data);
  console.log('SPLITTING PAGE 3: Populating second page...');
  const populatedSecondPage = await populateTemplate(secondPageTemplate, data);
  
  console.log('SPLITTING PAGE 3: Returning 2 pages for main content');
  return [populatedFirstPage, populatedSecondPage];
};

const populateTemplate = async (htmlTemplate, data, appendixLetter = 'B', logoBase64Param = null, backgroundBase64Param = null) => {
  
  // Determine template type based on clearance type
  let templateType = 'asbestosClearanceNonFriable'; // default
  if (data.clearanceType === 'Friable') {
    templateType = 'asbestosClearanceFriable';
  }
  
  // Fetch template content based on clearance type
  let templateContent = null;
  try {
    templateContent = await getTemplateByType(templateType);
  } catch (error) {
    console.error('Error fetching template content:', error);
    // Continue with hardcoded content as fallback
  }

  // Look up user's Asbestos Assessor licence number
  let laaLicenceNumber = 'AA00031'; // Default fallback
  let userSignature = null;
  
  // Handle both clearance (LAA) and assessment (assessorId) user lookups
  let userIdentifier = data.LAA || data.assessorId;
  
  // Handle assessorId object structure for assessments
  if (data.assessorId && typeof data.assessorId === 'object') {
    userIdentifier = data.assessorId.firstName + ' ' + data.assessorId.lastName;
  }
  
  console.log('[USER LOOKUP DEBUG] userIdentifier:', userIdentifier);
  console.log('[USER LOOKUP DEBUG] data.assessorId:', data.assessorId);
  console.log('[USER LOOKUP DEBUG] data.LAA:', data.LAA);
  
  if (userIdentifier) {
    try {
      const User = require('../models/User');
      
      // Check if userIdentifier is a valid ObjectId (24 hex characters)
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(userIdentifier);
      
      const queryConditions = [
        { firstName: { $regex: new RegExp(userIdentifier.split(' ')[0], 'i') }, lastName: { $regex: new RegExp(userIdentifier.split(' ')[1] || '', 'i') } },
        { firstName: { $regex: new RegExp(userIdentifier, 'i') } },
        { lastName: { $regex: new RegExp(userIdentifier, 'i') } }
      ];
      
      // Only add ObjectId condition if it's a valid ObjectId
      if (isValidObjectId) {
        queryConditions.push({ _id: userIdentifier });
      }
      
      const user = await User.findOne({
        $or: queryConditions
      });
      if (user) {
        console.log('[USER LOOKUP DEBUG] Found user:', user.firstName, user.lastName);
        console.log('[USER LOOKUP DEBUG] User signature:', !!user.signature);
        console.log('[USER LOOKUP DEBUG] User licences:', user.licences?.length || 0);
        
        // Get user's signature
        if (user.signature) {
          userSignature = user.signature;
          console.log('[USER LOOKUP DEBUG] User signature found, length:', userSignature.length);
        } else {
          console.log('[USER LOOKUP DEBUG] No signature found for user');
          console.log('[USER LOOKUP DEBUG] User object keys:', Object.keys(user));
          console.log('[USER LOOKUP DEBUG] User signature field:', user.signature);
        }
        
        if (user.licences && user.licences.length > 0) {
          console.log('[USER LOOKUP DEBUG] User licences:', user.licences.map(l => ({ type: l.licenceType, number: l.licenceNumber })));
          
          // Look specifically for Asbestos Assessor licence first, then LAA
          const asbestosAssessorLicence = user.licences.find(licence => 
            licence.licenceType === 'Asbestos Assessor'
          );
          
          if (asbestosAssessorLicence) {
            laaLicenceNumber = asbestosAssessorLicence.licenceNumber;
            console.log('[USER LOOKUP DEBUG] Found Asbestos Assessor licence:', laaLicenceNumber);
          } else {
            // Fallback to LAA if no Asbestos Assessor licence found
            const laaLicence = user.licences.find(licence => 
              licence.licenceType === 'LAA'
            );
            if (laaLicence) {
              laaLicenceNumber = laaLicence.licenceNumber;
              console.log('[USER LOOKUP DEBUG] Found LAA licence:', laaLicenceNumber);
            }
          }
        }
      } else {
        console.log('[USER LOOKUP DEBUG] No user found for identifier:', userIdentifier);
      }
    } catch (error) {
      console.error('Error looking up user licence:', error);
    }
  }
  
  // Replace logo placeholders with actual img tags
  let templateWithLogoPath = htmlTemplate.replace(/\[LOGO_PATH\]/g, '');
  
  // Use passed logoBase64 parameter or fall back to global variable
  const logoToUse = logoBase64Param || logoBase64;
  
  // Simple fix: replace [LOGO_PATH] with base64 logo everywhere
  if (logoToUse) {
    templateWithLogoPath = templateWithLogoPath.replace(/\[LOGO_PATH\]/g, 'data:image/png;base64,' + logoToUse);
  }
  
  // Concise debug log for logo
  if (logoToUse) {
    console.log('[LOGO DEBUG] logoToUse length:', logoToUse.length, 'start:', logoToUse.slice(0, 10), 'end:', logoToUse.slice(-10));
  } else {
    console.log('[LOGO DEBUG] logoToUse is null or empty');
  }
  console.log('[LOGO DEBUG] logoBase64Param provided:', !!logoBase64Param);
  console.log('[LOGO DEBUG] Using global logoBase64:', !logoBase64Param);
  
  try {
    templateWithLogoPath = templateWithLogoPath.replace(
      /<img\s+class="logo"[^>]*>/g,
      '<img class="logo" src="data:image/png;base64,' + logoToUse + '" alt="Company Logo" />'
    );
  } catch (error) {
    writeLog('Logo img replacement failed: ' + error.message);
  }
  
  try {
    templateWithLogoPath = templateWithLogoPath.replace(
      /<div\s+class="logo"[^>]*>/g,
      '<img class="logo" src="data:image/png;base64,' + logoToUse + '" alt="Company Logo" />'
    );
  } catch (error) {
    console.error('Logo div replacement failed:', error);
  }
  
  // Add background image as simple img tag for cover page
  if (htmlTemplate.includes('cover-bg')) {
    try {
      // Use passed backgroundBase64 parameter or fall back to global variable
      const backgroundToUse = backgroundBase64Param || backgroundBase64;
      
      // Remove the original background div completely
      templateWithLogoPath = templateWithLogoPath.replace(
        /<div\s+class="cover-bg"[^>]*><\/div>/g,
        ''
      );
      
      // Add simple background image at the start of cover-container
      templateWithLogoPath = templateWithLogoPath.replace(
        /<div class="cover-container">/g,
        '<div class="cover-container"><img src="data:image/jpeg;base64,' + backgroundToUse + '" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;" /><svg style="position: absolute; top: 0; left: 0; width: 432px; height: 100%; z-index: 1; fill: white;" viewBox="0 0 432 1130" xmlns="http://www.w3.org/2000/svg"><polygon points="80,-10 426,240 426,884 80,1134 0,1134 0,0" /></svg>'
      );
    } catch (error) {
      console.error('Background image addition failed:', error);
    }
  }
  
  // Replace cover logo div with img tag (handle inline styles)
  try {
    templateWithLogoPath = templateWithLogoPath.replace(
      /<div\s+class="cover-logo"[^>]*style="[^"]*"[^>]*><\/div>/g,
      '<img class="cover-logo" src="data:image/png;base64,' + logoToUse + '" alt="Company Logo" />'
    );
  } catch (error) {
    console.error('Cover logo replacement failed:', error);
  }
  
  // Replace cover logo img tag with actual logo (for assessment templates)
  try {
    console.log('[LOGO DEBUG] Looking for cover-logo img tag with [LOGO_PATH]');
    const beforeReplacement = templateWithLogoPath.includes('cover-logo');
    console.log('[LOGO DEBUG] Template contains cover-logo before replacement:', beforeReplacement);
    
    // Check if the template contains the [LOGO_PATH] placeholder
    const hasLogoPath = templateWithLogoPath.includes('[LOGO_PATH]');
    console.log('[LOGO DEBUG] Template contains [LOGO_PATH] placeholder:', hasLogoPath);
    
    if (hasLogoPath) {
      templateWithLogoPath = templateWithLogoPath.replace(
        /<img\s+class="cover-logo"[^>]*src="\[LOGO_PATH\]"[^>]*>/g,
        '<img class="cover-logo" src="data:image/png;base64,' + logoToUse + '" alt="Company Logo" />'
      );
      
      // Fix: also match unescaped [LOGO_PATH] (as in the template)
      templateWithLogoPath = templateWithLogoPath.replace(
        /<img\s+class="cover-logo"[^>]*src="\[LOGO_PATH\]"[^>]*>/g,
        '<img class="cover-logo" src="data:image/png;base64,' + logoToUse + '" alt="Company Logo" />'
      );
      templateWithLogoPath = templateWithLogoPath.replace(
        /<img\s+class="cover-logo"[^>]*src="\[LOGO_PATH\]"[^>]*>/g,
        '<img class="cover-logo" src="data:image/png;base64,' + logoToUse + '" alt="Company Logo" />'
      );
      // Also replace any standalone [LOGO_PATH] placeholders
      templateWithLogoPath = templateWithLogoPath.replace(
        /\[LOGO_PATH\]/g,
        'data:image/png;base64,' + logoToUse
      );
      
      // Additional fix for assessment templates: replace img tags with [LOGO_PATH] src
      templateWithLogoPath = templateWithLogoPath.replace(
        /<img\s+class="cover-logo"[^>]*src="\[LOGO_PATH\]"[^>]*>/g,
        '<img class="cover-logo" src="data:image/png;base64,' + logoToUse + '" alt="Company Logo" />'
      );
    }
    
    const afterReplacement = templateWithLogoPath.includes('data:image/png;base64,');
    console.log('[LOGO DEBUG] Template contains base64 logo after replacement:', afterReplacement);
  } catch (error) {
    console.error('Cover logo img replacement failed:', error);
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

  // Debug final values
  console.log('[FINAL VALUES DEBUG] laaLicenceNumber:', laaLicenceNumber);
  console.log('[FINAL VALUES DEBUG] userSignature:', !!userSignature);
  console.log('[FINAL VALUES DEBUG] userSignature length:', userSignature ? userSignature.length : 'null');
  console.log('[FINAL VALUES DEBUG] CLIENT_NAME:', data.projectId?.client?.name || data.project?.client?.name || data.clientName || 'Unknown Client');
  
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
    '[CLIENT_NAME]': data.CLIENT_NAME || data.projectId?.client?.name || data.project?.client?.name || data.clientName || 'Unknown Client',
    '[ASBESTOS_TYPE]': data.clearanceType?.toLowerCase() || 'non-friable',
    '[ASBESTOS_REMOVALIST]': data.asbestosRemovalist || 'Unknown Removalist',
    '[LAA_NAME]': data.LAA || data.AUTHOR_NAME || data.assessorId?.firstName + ' ' + data.assessorId?.lastName || data.laaName || 'Unknown LAA',
    '[LAA_LICENSE]': laaLicenceNumber,
    '[LAA_LICENCE]': laaLicenceNumber, // British spelling for assessment templates
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
    '[SIGNATURE_IMAGE]': userSignature ? `<img src="${userSignature}" alt="Signature" style="max-width: 150px; max-height: 75px;" />` : 'Signature not available',
    
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
    
    // Assessment-specific placeholders
    '[JOB_REFERENCE]': data.JOB_REFERENCE || data.projectId?.projectID || data.project?.projectID || data.projectId || 'Unknown Reference',
    '[ASSESSMENT_DATE]': data.ASSESSMENT_DATE || (data.assessmentDate 
      ? new Date(data.assessmentDate).toLocaleDateString('en-GB')
      : 'Unknown Date'),
    '[ASSESSMENT_SCOPE_BULLETS]': data.assessmentScopeBullets || '<li>No areas specified</li>',
    '[IDENTIFIED_ASBESTOS_ITEMS]': data.identifiedAsbestosItems || '<li>No asbestos-containing materials identified</li>',
    '[SAMPLE_REFERENCE]': data.sampleReference || 'N/A',
    '[LOCATION_DESCRIPTION]': data.locationDescription || 'N/A',
    '[MATERIAL_TYPE]': data.materialType || 'N/A',
    '[ASBESTOS_CONTENT]': data.asbestosContent || 'N/A',
    '[ASBESTOS_TYPE]': data.asbestosType || 'N/A',
    '[CONDITION]': data.condition || 'N/A',
    '[RISK]': data.risk || 'N/A',
    '[COMMENTS]': data.recommendationActions || 'N/A',
    '[PHOTO_URL]': data.photograph || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    '[AUTHOR_NAME]': data.AUTHOR_NAME || data.assessorId?.firstName + ' ' + data.assessorId?.lastName || 'Unknown Author',
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

  // Log the template file path (if available)
  if (typeof htmlTemplatePath !== 'undefined') {
    console.log('[TEMPLATE DEBUG] Using template file:', htmlTemplatePath);
  }

  // After all replacements, log if the cover logo is present
  const coverLogoMatches = (templateWithLogoPath.match(/<img[^>]+class="cover-logo"[^>]+src="data:image\/png;base64,[^"]*"/g) || []).length;
  console.log('[COVER LOGO DEBUG] Number of cover logo img tags with base64 src:', coverLogoMatches);

  // Log template content to debug missing cover logo
  console.log('[TEMPLATE DEBUG] Template content starts with:', htmlTemplate.substring(0, 200));
  console.log('[TEMPLATE DEBUG] Template contains "cover-logo":', htmlTemplate.includes('cover-logo'));
  console.log('[TEMPLATE DEBUG] Template contains "[LOGO_PATH]":', htmlTemplate.includes('[LOGO_PATH]'));

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
 * Generate Assessment PDF from HTML templates using Puppeteer
 * @param {string} templateType - Type of template (e.g., 'asbestos-assessment')
 * @param {Object} data - Assessment data
 * @returns {Promise<Buffer>} - Generated PDF as buffer
 */
const generateAssessmentPDFFromHTML = async (templateType, data) => {
  let browser;
  try {
    writeLog('Starting assessment PDF generation...');
    writeLog('Template type: ' + templateType);
    writeLog('Data received for project: ' + (data.projectId?.name || 'Unknown project'));
    
    // Generate sample register items
    const assessmentItems = data.assessmentItems || [];
    
    // Fetch template content from database
    let templateContent = null;
    try {
      templateContent = await getTemplateByType('asbestosAssessment');
    } catch (error) {
      console.error('Error fetching template content:', error);
      // Continue with hardcoded content as fallback
    }
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable'
    });
    
    const page = await browser.newPage();
    
    const fs = require('fs');
    const path = require('path');
    
    // Load assessment-specific templates
    const coverTemplate = fs.readFileSync(path.join(__dirname, '../templates/AsbestosAssessment/AsbestosAssessmentCoverMockup-Page1.html'), 'utf8');
    const versionControlTemplate = fs.readFileSync(path.join(__dirname, '../templates/AsbestosAssessment/AsbestosAssessmentVersionControlMockup-page2.html'), 'utf8');
    const sampleRegisterTemplate = fs.readFileSync(path.join(__dirname, '../templates/AsbestosAssessment/AsbestosAssessmentReportPage3.html'), 'utf8');
    const discussionTemplate = fs.readFileSync(path.join(__dirname, '../templates/AsbestosAssessment/AsbestosAssessmentDiscussionConclusions.html'), 'utf8');
    const sampleItemTemplate = fs.readFileSync(path.join(__dirname, '../templates/AsbestosAssessment/AsbestosAssessmentSampleRegisterItem.html'), 'utf8');
    const glossaryTemplate = fs.readFileSync(path.join(__dirname, '../templates/AsbestosAssessment/AsbestosAssessmentGlossary.html'), 'utf8');
    const appendixATemplate = fs.readFileSync(path.join(__dirname, '../templates/AsbestosAssessment/AsbestosAssessmentAppendixA.html'), 'utf8');
    
    // Populate templates with data - use the same approach as clearance
    const populatedCover = await populateTemplate(coverTemplate, data, 'B', logoBase64, backgroundBase64);
    const populatedVersionControl = await populateTemplate(versionControlTemplate, data, 'B', logoBase64);
    const populatedGlossary = await populateTemplate(glossaryTemplate, data, 'B', logoBase64);
    const populatedAppendixA = await populateTemplate(appendixATemplate, data, 'B', logoBase64);
    
    // Generate discussion content with identified asbestos items
    const identifiedAsbestosItems = assessmentItems
      .filter(item => item.asbestosContent && item.asbestosContent !== 'No asbestos detected')
      .map(item => `<li>${item.locationDescription} - ${item.materialType} (${item.asbestosContent})</li>`)
      .join('');
    
    // Generate assessment scope bullets
    const assessmentScopeBullets = assessmentItems
      .map(item => `<li>${item.locationDescription}</li>`)
      .join('');
    
    // Prepare data for placeholders - map assessment data to expected format
    const placeholderData = {
      ...data,
      LAA: data.assessorId?.firstName + ' ' + data.assessorId?.lastName || data.LAA || 'Unknown Assessor',
      assessorId: data.assessorId, // Pass the full assessorId object for user lookup
      CLIENT_NAME: data.projectId?.client?.name || data.project?.client?.name || data.clientName || 'Unknown Client',
      SITE_NAME: data.projectId?.name || data.project?.name || data.siteName || 'Unknown Site',
      ASSESSMENT_DATE: data.assessmentDate 
        ? new Date(data.assessmentDate).toLocaleDateString('en-GB')
        : 'Unknown Date',
      LAA_LICENSE: 'AA00031', // Default license - will be looked up in replacePlaceholders
      // Add additional mappings for assessment-specific placeholders
      AUTHOR_NAME: data.assessorId?.firstName + ' ' + data.assessorId?.lastName || 'Unknown Author',
      JOB_REFERENCE: data.projectId?.projectID || data.project?.projectID || 'Unknown Reference',
    };
    
    // Debug: Log key data for troubleshooting
    console.log('Assessment PDF Data:', {
      assessorId: data.assessorId,
      projectId: data.projectId,
      LAA: placeholderData.LAA,
      CLIENT_NAME: placeholderData.CLIENT_NAME,
      SITE_NAME: placeholderData.SITE_NAME
    });
    
    const discussionData = {
      ...placeholderData,
      identifiedAsbestosItems: identifiedAsbestosItems || '<li>No asbestos-containing materials identified</li>'
    };
    
    const sampleRegisterData = {
      ...placeholderData,
      assessmentScopeBullets: assessmentScopeBullets || '<li>No areas specified</li>'
    };
    
    // Use template content if available, otherwise use hardcoded template
    let populatedDiscussion;
    if (templateContent && templateContent.standardSections) {
      // Create discussion content using template sections
      const discussionContent = await replacePlaceholders(templateContent.standardSections.discussionContent, discussionData);
      const discussionTitle = templateContent.standardSections.discussionTitle;
      
      // Replace the hardcoded content in the template with dynamic content
      let dynamicDiscussionTemplate = discussionTemplate;
      dynamicDiscussionTemplate = dynamicDiscussionTemplate.replace(
        'Discussion and Conclusions',
        discussionTitle || 'Discussion and Conclusions'
      );
      dynamicDiscussionTemplate = dynamicDiscussionTemplate.replace(
        'The following asbestos-containing materials were identified during the assessment:',
        discussionContent || 'The following asbestos-containing materials were identified during the assessment:'
      );
      
      populatedDiscussion = await populateTemplate(dynamicDiscussionTemplate, discussionData, 'B', logoBase64);
    } else {
      populatedDiscussion = await populateTemplate(discussionTemplate, discussionData, 'B', logoBase64);
    }
    
    // Use template content for sample register if available
    let populatedSampleRegister;
    if (templateContent && templateContent.standardSections) {
      // Create introduction and survey findings content using template sections
      const introductionContent = await replacePlaceholders(templateContent.standardSections.introductionContent, sampleRegisterData);
      const introductionTitle = templateContent.standardSections.introductionTitle;
      const surveyFindingsContent = await replacePlaceholders(templateContent.standardSections.surveyFindingsContent, sampleRegisterData);
      const surveyFindingsTitle = templateContent.standardSections.surveyFindingsTitle;
      
      // Replace the hardcoded content in the template with dynamic content
      let dynamicSampleRegisterTemplate = sampleRegisterTemplate;
      
      // Replace Introduction section
      dynamicSampleRegisterTemplate = dynamicSampleRegisterTemplate.replace(
        'Introduction',
        introductionTitle || 'Introduction'
      );
      
      // Replace Introduction content
      const introContentMatch = dynamicSampleRegisterTemplate.match(
        /<div class="paragraph">\s*Following discussions with \[CLIENT_NAME\].*?<\/div>\s*<div class="paragraph">\s*This report covers the inspection and assessment of the following\s*areas\/materials only:\s*<\/div>/s
      );
      if (introContentMatch) {
        const introContentParts = introductionContent.split('\n\nThis report covers the inspection and assessment of the following areas/materials only:');
        if (introContentParts.length === 2) {
          const newIntroContent = `<div class="paragraph">\n          ${introContentParts[0].trim()}\n        </div>\n        <div class="paragraph">\n          This report covers the inspection and assessment of the following\n          areas/materials only:\n        </div>`;
          dynamicSampleRegisterTemplate = dynamicSampleRegisterTemplate.replace(introContentMatch[0], newIntroContent);
        }
      }
      
      // Replace Survey Findings section
      dynamicSampleRegisterTemplate = dynamicSampleRegisterTemplate.replace(
        'Survey Findings',
        surveyFindingsTitle || 'Survey Findings'
      );
      
      // Replace Survey Findings content
      const surveyContentMatch = dynamicSampleRegisterTemplate.match(
        /<div class="paragraph">\s*Table 1 below details the suspected ACM sampled as part of the\s*assessment\. Information is also included regarding materials which are\s*presumed to contain asbestos and materials which the assessor visually\s*assessed to be the consistent with a sampled material\. Photographs of\s*assessed materials are also presented in the sample register below\.\s*<\/div>\s*<div class="paragraph">\s*Sample analysis was undertaken by L&D's National Association of\s*Testing Authorities \(NATA\) accredited laboratory\. The samples were\s*analysed by Polarised Light Microscopy using dispersion staining\s*techniques\. Results of sample analysis can be found on the L&D\s*Certificate of Analysis \(Appendix A to this report\)\.\s*<\/div>/s
      );
      if (surveyContentMatch) {
        const newSurveyContent = `<div class="paragraph">\n          ${surveyFindingsContent.replace(/\n/g, '\n          ')}\n        </div>`;
        dynamicSampleRegisterTemplate = dynamicSampleRegisterTemplate.replace(surveyContentMatch[0], newSurveyContent);
      }
      
      populatedSampleRegister = await populateTemplate(dynamicSampleRegisterTemplate, sampleRegisterData, 'B', logoBase64);
    } else {
      populatedSampleRegister = await populateTemplate(sampleRegisterTemplate, sampleRegisterData, 'B', logoBase64);
    }
    
    // Handle sample register items - first item on intro page, second+ items on separate pages
    let sampleRegisterPages = '';
    
    if (assessmentItems.length > 0) {
      // First page: Introduction + first item (50% taller)
      const firstItem = assessmentItems[0];
      const firstItemContent = await populateTemplate(sampleItemTemplate, firstItem, 'B', logoBase64);
      
      // Make first item 50% taller by adding extra spacing
      const tallerFirstItem = firstItemContent.replace(
        /<div class="sample-item">/g,
        '<div class="sample-item" style="min-height: 450px;">'
      );
      
      const firstPage = populatedSampleRegister.replace('[SAMPLE_REGISTER_ITEM_1]', tallerFirstItem);
      sampleRegisterPages = firstPage;
      
      // Additional pages: Group table items in pairs (2 per page) with header/footer
      const remainingItems = assessmentItems.slice(1);
      if (remainingItems.length > 0) {
        const itemsPerPage = 2;
        const totalPages = Math.ceil(remainingItems.length / itemsPerPage);
        
        for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
          const startIndex = pageIndex * itemsPerPage;
          const endIndex = Math.min(startIndex + itemsPerPage, remainingItems.length);
          const pageItems = remainingItems.slice(startIndex, endIndex);
          
          let pageContent = '';
          
          // Add each item to the page
          for (let i = 0; i < pageItems.length; i++) {
            const item = pageItems[i];
            const itemContent = await populateTemplate(sampleItemTemplate, item, 'B', logoBase64);
            pageContent += itemContent;
            
            // Add spacing between items (except for the last item)
            if (i < pageItems.length - 1) {
              pageContent += '<div style="margin-bottom: 20px;"></div>';
            }
          }
          
          // Create a new page template with header and footer but no introduction
          const additionalPage = `
            <div class="page-break">
              <div class="page">
                <div class="header">
                  <img class="logo" src="data:image/png;base64,${logoBase64}" alt="Company Logo" />
                  <div class="company-details">
                    Lancaster & Dickenson Consulting Pty Ltd<br />
                    4/6 Dacre Street<br />
                    Mitchell ACT 2911<br />
                    W: <span class="website">www.landd.com.au</span>
                  </div>
                </div>
                <div class="green-line" style="width: calc(100% - 96px); height: 4px; background: #16b12b; margin: 8px auto 0 auto; border-radius: 2px;"></div>
                <div class="content" style="padding: 10px 48px 24px 48px; flex: 1; display: flex; flex-direction: column;">
                  ${pageContent}
                </div>
                <div class="footer">
                  <div class="footer-line" style="width: 100%; height: 4px; background: #16b12b; margin-bottom: 6px; border-radius: 2px;"></div>
                  Asbestos Assessment Report - ${data.projectId?.name || data.siteName || 'Unknown Site'}
                </div>
              </div>
            </div>
          `;
          
          sampleRegisterPages += additionalPage;
        }
      }
    }
    
    // Create complete HTML document
    // --- DYNAMIC SECTION GENERATION START ---
    let dynamicSectionPages = '';
    if (templateContent && templateContent.standardSections) {
      // Define the order of new sections
      const sectionOrder = [
        { key: 'riskAssessment', title: 'Risk Assessment' },
        { key: 'controlMeasures', title: 'Determining Suitable Control Measures' },
        { key: 'remediationRequirements', title: 'Requirements for Remediation/Removal Works Involving ACM' },
        { key: 'legislation', title: 'Legislation' },
        { key: 'assessmentLimitations', title: 'Assessment Limitations/Caveats' },
      ];
      
      // Process sections in pairs (2 per page)
      for (let i = 0; i < sectionOrder.length; i += 2) {
        const section1 = sectionOrder[i];
        const section2 = sectionOrder[i + 1];
        
        let pageContent = '';
        
        // Process first section
        if (section1) {
          const section1Title = templateContent.standardSections[section1.key + 'Title'];
          
          // Prepare data for placeholders - map assessment data to expected format
          const placeholderData = {
            ...data,
            LAA: data.assessorId?.firstName + ' ' + data.assessorId?.lastName || data.LAA || 'Unknown Assessor',
            CLIENT_NAME: data.projectId?.client?.name || data.project?.client?.name || data.clientName || 'Unknown Client',
            SITE_NAME: data.projectId?.name || data.project?.name || data.siteName || 'Unknown Site',
            ASSESSMENT_DATE: data.assessmentDate 
              ? new Date(data.assessmentDate).toLocaleDateString('en-GB')
              : 'Unknown Date',
            LAA_LICENSE: 'AA00031', // Default license - will be looked up in replacePlaceholders
          };
          
          let section1Content = await replacePlaceholders(templateContent.standardSections[section1.key + 'Content'], placeholderData);
          
          // Special handling for Risk Assessment table
          if (section1.key === 'riskAssessment') {
            section1Content = processRiskAssessmentContent(section1Content);
          }
          
          if (section1Title && section1Content) {
            pageContent += `
              <div class="section-header" style="font-size: 1.1rem; font-weight: 700; text-transform: uppercase; margin: 16px 0 4px 0; letter-spacing: 0.01em; color: #222;">${section1Title}</div>
              <div class="paragraph" style="font-size: 0.95rem; margin-bottom: 12px; color: #222; line-height: 1.5; text-align: justify;">${section1Content}</div>
            `;
          }
        }
        
        // Process second section
        if (section2) {
          const section2Title = templateContent.standardSections[section2.key + 'Title'];
          
          // Use the same placeholder data for consistency
          let section2Content = await replacePlaceholders(templateContent.standardSections[section2.key + 'Content'], placeholderData);
          
          // Special handling for Risk Assessment table
          if (section2.key === 'riskAssessment') {
            section2Content = processRiskAssessmentContent(section2Content);
          }
          
          if (section2Title && section2Content) {
            pageContent += `
              <div class="section-header" style="font-size: 1.1rem; font-weight: 700; text-transform: uppercase; margin: 12px 0 4px 0; letter-spacing: 0.01em; color: #222;">${section2Title}</div>
              <div class="paragraph" style="font-size: 0.95rem; margin-bottom: 8px; color: #222; line-height: 1.5; text-align: justify;">${section2Content}</div>
            `;
          }
        }
        
        // Create page if there's content
        if (pageContent) {
          dynamicSectionPages += `
            <div class="page-break">
              <div class="page">
                <div class="header">
                  <img class="logo" src="data:image/png;base64,${logoBase64}" alt="Company Logo" />
                  <div class="company-details">
                    Lancaster & Dickenson Consulting Pty Ltd<br />
                    4/6 Dacre Street<br />
                    Mitchell ACT 2911<br />
                    W: <span class="website">www.landd.com.au</span>
                  </div>
                </div>
                <div class="green-line" style="width: calc(100% - 96px); height: 4px; background: #16b12b; margin: 8px auto 0 auto; border-radius: 2px;"></div>
                <div class="content" style="padding: 10px 48px 24px 48px; flex: 1; display: flex; flex-direction: column;">
                  ${pageContent}
                </div>
                <div class="footer">
                  <div class="footer-line" style="width: 100%; height: 4px; background: #16b12b; margin-bottom: 6px; border-radius: 2px;"></div>
                  Asbestos Assessment Report - ${data.projectId?.name || data.siteName || 'Unknown Site'}
                </div>
              </div>
            </div>
          `;
        }
      }
    }
    // --- DYNAMIC SECTION GENERATION END ---

    const completeHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Asbestos Assessment Report</title>
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
        <div class="page-break">${populatedCover}</div>
        <div class="page-break">${populatedVersionControl}</div>
        <div class="page-break">${sampleRegisterPages}</div>
        <div class="page-break">${populatedDiscussion}</div>
        ${dynamicSectionPages}
        <div class="page-break">${populatedGlossary}</div>
        <div class="page-break">${populatedAppendixA}</div>
      </body>
      </html>
    `;
    
    // Skip image compression due to Jimp compatibility issues
    console.log('Skipping image compression due to Jimp compatibility issues');
    
    // Set content and generate PDF
    await page.setContent(completeHTML, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0',
        right: '0',
        bottom: '0',
        left: '0'
      },
      preferCSSPageSize: false,
      displayHeaderFooter: false,
      omitBackground: false,
      scale: 1.0,
      landscape: false
    });
    
    writeLog('Assessment PDF generated successfully');
    return pdfBuffer;
    
  } catch (error) {
    writeLog('ERROR generating assessment PDF: ' + error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

/**
 * Populate assessment template with data
 * @param {string} template - HTML template
 * @param {Object} data - Assessment data
 * @param {string} logoBase64 - Logo base64 data
 * @param {string} backgroundBase64 - Background base64 data (optional)
 * @returns {string} - Populated template
 */
const populateAssessmentTemplate = (template, data, logoBase64, backgroundBase64 = null) => {
  let populatedTemplate = template;
  
  // Replace logo
  populatedTemplate = populatedTemplate.replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`);
  populatedTemplate = populatedTemplate.replace(/src="\/frontend\/public\/logo\.png"/g, `src="data:image/png;base64,${logoBase64}"`);
  
  // Replace background if provided - use the same complex logic as clearance
  if (backgroundBase64) {
    // Remove the original background div completely
    populatedTemplate = populatedTemplate.replace(
      /<div\s+class="cover-bg"[^>]*><\/div>/g,
      ''
    );
    
    // Add simple background image at the start of cover-container
    populatedTemplate = populatedTemplate.replace(
      /<div class="cover-container">/g,
      '<div class="cover-container"><img src="data:image/jpeg;base64,' + backgroundBase64 + '" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;" /><svg style="position: absolute; top: 0; left: 0; width: 432px; height: 100%; z-index: 1; fill: white;" viewBox="0 0 432 1130" xmlns="http://www.w3.org/2000/svg"><polygon points="80,-10 426,240 426,884 80,1134 0,1134 0,0" /></svg>'
    );
  }
  
  // Replace assessment-specific placeholders
  const replacements = {
    '[PROPERTY_ADDRESS]': data.projectId?.name || data.project?.name || 'Unknown Property',
    '[JOB_REFERENCE]': data.projectId?.projectID || data.project?.projectID || 'Unknown Reference',
    '[ASSESSMENT_DATE]': data.assessmentDate 
      ? new Date(data.assessmentDate).toLocaleDateString('en-GB')
      : 'Unknown Date',
    '[CLIENT_DETAILS]': data.projectId?.client?.name || data.project?.client?.name || 'Unknown Client',
    '[ASSESSOR_NAME]': data.assessorId?.firstName + ' ' + data.assessorId?.lastName || 'Unknown Assessor',
    '[ASSESSOR_LICENSE]': 'AA00031', // Default license
    '[SAMPLE_REFERENCE]': data.sampleReference || 'N/A',
    '[LOCATION_DESCRIPTION]': data.locationDescription || 'N/A',
    '[MATERIAL_TYPE]': data.materialType || 'N/A',
    '[ASBESTOS_CONTENT]': data.asbestosContent || 'N/A',
    '[ASBESTOS_TYPE]': data.asbestosType || 'N/A',
    '[CONDITION]': data.condition || 'N/A',
    '[RISK]': data.risk || 'N/A',
    '[COMMENTS]': data.recommendationActions || 'N/A',
    '[PHOTO_URL]': data.photograph || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    '[LAA_NAME]': data.assessorId?.firstName + ' ' + data.assessorId?.lastName || 'Unknown Assessor',
    '[LAA_LICENCE]': 'AA00031',
    '[SIGNATURE_IMAGE]': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    '[CLIENT]': data.projectId?.client?.name || data.project?.client?.name || 'Unknown Client',
    '[SITE_NAME]': data.projectId?.name || data.project?.name || 'Unknown Site',
    '[IDENTIFIED_ASBESTOS_ITEMS]': data.identifiedAsbestosItems || '<li>No asbestos-containing materials identified</li>',
    '[ASSESSMENT_SCOPE_BULLETS]': data.assessmentScopeBullets || '<li>No areas specified</li>'
  };
  
  Object.entries(replacements).forEach(([placeholder, value]) => {
    populatedTemplate = populatedTemplate.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  });
  
  return populatedTemplate;
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
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable'
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
    
    // Generate main content pages (page 3) - with potential overflow handling
    writeLog('Generating main content pages (page 3) with overflow detection...');
    const mainContentPages = await generateMainContentPages(data);
    mainContentPages.forEach((page, index) => {
      writeLog(`Adding main content page ${index + 1} of ${mainContentPages.length}`);
      pagesContent += `<div class="page-break">${page}</div>`;
    });
    
    // Add background information page (page 4) - static template
    writeLog('Adding background information page (page 4)...');
    const populatedBackgroundTemplate = await populateTemplate(templates[2], data);
    pagesContent += `<div class="page-break">${populatedBackgroundTemplate}</div>`;
    
    // PAGE STRUCTURE SUMMARY:
    // Page 1: Cover
    // Page 2: Version Control  
    // Page 3: Main Content (with overflow handling)
    // Page 4: Background Information (static)
    // Page 5: Appendix A
    // Page 6+: Photo pages
    // Page N: Site Plan (if present)
    // Page N+1: Air Monitoring (if present)
    
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

// Test route to verify page 3 splitting functionality
router.get('/test-page3-split', async (req, res) => {
  try {
    // Create test data with forcePageSplit enabled
    const testData = {
      clearanceType: 'Non-friable',
      projectId: {
        name: 'Test Site Address',
        client: {
          name: 'Test Client'
        }
      },
      LAA: 'John Smith',
      clearanceDate: '2024-01-15',
      inspectionTime: '14:30',
      inspectionDate: '2024-01-15',
      asbestosRemovalist: 'Test Removalist',
      siteName: 'Test Site',
      clientName: 'Test Client',
      clearanceItems: Array.from({ length: 25 }, (_, i) => ({
        locationDescription: `Test Location ${i + 1}`,
        materialDescription: `Test Material ${i + 1}`,
        condition: 'Good',
        action: 'Removed'
      })),
      forcePageSplit: true
    };
    
    console.log('Testing page 3 split functionality...');
    const mainContentPages = await generateMainContentPages(testData);
    
    res.json({
      message: 'Page 3 split test completed',
      pagesGenerated: mainContentPages.length,
      expectedPages: 2,
      success: mainContentPages.length === 2,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in page 3 split test:', error);
    res.status(500).json({ error: 'Test failed', details: error.message });
  }
});

// Route to generate asbestos assessment PDF
router.post('/generate-asbestos-assessment', async (req, res) => {
  try {
    writeLog('=== ASSESSMENT PDF GENERATION REQUEST RECEIVED ===');
    writeLog('Request received for assessment ID: ' + req.body.assessmentData?._id);
    const { assessmentData } = req.body;
    
    if (!assessmentData) {
      console.log('ERROR: No assessment data provided');
      return res.status(400).json({ error: 'Assessment data is required' });
    }

    writeLog('Assessment data received for: ' + (assessmentData.projectId?.name || 'Unknown project'));
    
    const assessmentItems = assessmentData.items || [];
    writeLog('Assessment items found: ' + assessmentItems.length);
    
    // Add assessment items to the data and fix client mapping
    const enrichedData = {
      ...assessmentData,
      assessmentItems: assessmentItems,
      // Fix client mapping - handle both populated and unpopulated project data
      CLIENT_NAME: assessmentData.projectId?.client?.name || assessmentData.clientName || 'Unknown client',
      SITE_NAME: assessmentData.projectId?.name || assessmentData.siteName || 'Unknown site',
      JOB_REFERENCE: assessmentData.projectId?.projectID || assessmentData.jobReference || 'Unknown reference',
      ASSESSMENT_DATE: assessmentData.assessmentDate ? new Date(assessmentData.assessmentDate).toLocaleDateString('en-GB') : 'Unknown date',
      // Add author name from assessor - handle both populated and unpopulated assessor data
      AUTHOR_NAME: (assessmentData.assessorId?.firstName && assessmentData.assessorId?.lastName) 
        ? `${assessmentData.assessorId.firstName} ${assessmentData.assessorId.lastName}`
        : (assessmentData.assessorName || 'L&D Consulting')
    };
    
    writeLog('Generating assessment PDF with template and assessment items...');
    
    // Generate PDF
    const pdfBuffer = await generateAssessmentPDFFromHTML('asbestos-assessment', enrichedData);
    
    console.log('Assessment PDF generated successfully, buffer size:', pdfBuffer.length);
    
    // Generate filename
    const fileName = `asbestos-assessment-${assessmentData.projectId?.name || 'report'}-${new Date().toISOString().split('T')[0]}.pdf`;
    
    console.log('Sending assessment PDF response with filename:', fileName);
    
    // Set response headers with CORS support
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Error generating assessment PDF:', error);
    writeLog('ERROR generating assessment PDF: ' + error.message);
    res.status(500).json({ error: 'Failed to generate assessment PDF: ' + error.message });
  }
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