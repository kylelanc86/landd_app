const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { ultraCompressPDF } = require('../utils/pdfCompressor');
const { compressImagesInHTML } = require('../utils/imageCompressor');

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
const backgroundBase64 = fs.readFileSync(backgroundPath).toString('base64');

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
        font-size: 1.1rem;
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
        margin-top: 160px;
        line-height: 1.5;
        text-align: left;
      }
      .cover-logo {
        position: absolute;
        right: 32px;
        bottom: 32px;
        width: 180px;
        background: rgba(255, 255, 255, 0.95);
        padding: 10px 18px 10px 10px;
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
        font-size: 1.06rem;
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
          <li>File Name: [PROJECT_ID]_Clearance_Report.pdf</li>
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
        margin: 0 0 12px 24px;
        padding: 0;
        font-size: 0.8rem;
        color: #222;
        line-height: 1.5;
        text-align: justify;
      }
      .bullets li {
        margin-bottom: 6px;
        list-style-type: disc;
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
          <div class="section-header first-section" style="margin-top: 8px;">
            Background Information Regarding [ASBESTOS_TYPE] Clearance Inspections
          </div>
        <div class="paragraph">
          Following completion of [ASBESTOS_TYPE] asbestos removal works undertaken
          by a suitably licenced Asbestos Removal Contractor, a clearance
          inspection must be completed by an independent LAA / a competent
          person. The clearance inspection includes an assessment of the
          following:
        </div>
        <ul class="bullets">
          <li>
            Visual inspection of the work area for asbestos dust or debris
          </li>
          <li>
            Visual inspection of the adjacent area including the access and
            egress pathways for visible asbestos dust and debris
          </li>
        </ul>
        <div class="paragraph">
          It is required that a [REPORT_TYPE] Clearance Certificate be issued on
          completion of a successful inspection. The issuer needs to ensure:
        </div>
        <ul class="bullets">
          <li>
            This certificate should be issued prior to the area being
            re-occupied. This chain of events should occur regardless of whether
            the site is a commercial or residential property.
          </li>
          <li>
            The asbestos removal area and areas immediately surrounding it are
            visibly clean from asbestos contamination
          </li>
          <li>
            The removal area does not pose a risk to health safety and safety
            from exposure to asbestos
          </li>
        </ul>
        <div class="section-header">Legislative Requirements</div>
        <div class="paragraph">
          [REPORT_TYPE] Clearance Certificates should be written in general
          accordance with and with reference to:
        </div>
        <ul class="bullets">
          <li>ACT Work Health and Safety (WHS) Act 2011</li>
          <li>ACT Work Health and Safety Regulation 2011</li>
          <li>
            ACT Work Health and Safety (How to Safely Remove Asbestos Code of
            Practice) 2022
          </li>
        </ul>
        <div class="section-header">
          [REPORT_TYPE] Clearance Certificate Limitations
        </div>
        <div class="paragraph">
          The visual clearance inspection was only carried out in the locations
          outlined within this document. L&D did not inspect any areas of the
          property that fall outside of the locations listed in this certificate
          and therefore make no comment regarding the presence or condition of
          other ACM that may or may not be present. When undertaking the
          inspection, the LAA tries to inspect as much of the asbestos removal
          area as possible. However, no inspection is absolute. Should suspect
          ACM be identified following the inspection, works should cease until
          an assessment of the materials is completed.
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
        <div class="section-header first-section" style="margin-top: 8px;">Inspection Details</div>
        <div class="paragraph">
          Following discussions with [CLIENT_NAME], Lancaster and Dickenson
          Consulting (L &amp; D) were contracted to undertake a visual clearance
          inspection following the removal of [ASBESTOS_TYPE] asbestos from
          <b>[SITE_ADDRESS]</b> (herein referred to as 'the Site').
        </div>
        <div class="paragraph">
          Asbestos removal works were undertaken by
          <b>[ASBESTOS_REMOVALIST]</b>. <b>[LAA_NAME]</b>
          <b>[LAA_LICENSE]</b> from L&amp;D visited the Site at
          time on [CLEARANCE_DATE].
        </div>
        <div class="paragraph">
          Table 1 below outlines the ACM that formed part of the inspection.
          Photographs of the Asbestos Removal Area and a Site Plan are presented
          in Appendix A and Appendix B respectively.
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

        <div class="section-header">Inspection Exclusions</div>
        <div class="paragraph">
          This clearance certificate is specific to the scope of removal works
          detailed above. ACM may be present beyond the inspected area. Asbestos
          fibre cement packers remain under the windowsill. The packers were
          sprayed with black spray. The packers should be removed prior to
          commencing works that may disturb or damage the material.
        </div>

        <div class="section-header">Clearance Certification</div>
        <div class="paragraph">
          An inspection of the asbestos removal area and the surrounding areas
          (including access and egress pathways) was undertaken on [CLEARANCE_DATE].
          The LAA found no visible asbestos residue from asbestos removal work
          in the asbestos removal area, or in the vicinity of the area, where
          the asbestos removal works were carried out.
        </div>
        <div class="paragraph">
          The LAA considers that the asbestos removal area does not pose a risk
          to health and safety from exposure to asbestos and may be re-occupied.
        </div>
        <div class="paragraph">
          Please do not hesitate to contact the undersigned should you have any
          queries regarding this report.
        </div>
        <div class="signature-block">
          For and on behalf of Lancaster and Dickenson Consulting.<br />
          <div class="signature-line"></div>
          <div class="signature-name">[LAA_NAME]</div>
          <div class="signature-licence">[LAA_LICENSE]</div>
        </div>
      </div>
      <div class="footer">
        <div class="footer-line"></div>
        [REPORT_TYPE] Clearance Certificate: [SITE_ADDRESS]
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
          <div class="appendix-title">APPENDIX B</div>
          <div class="photographs-text">AIR MONITORING REPORT</div>
        </div>
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
const generateMainContentPages = (data) => {
  // Generate the main content (page 4) with overflow detection
  const mainContentTemplate = HTML_TEMPLATES.page4;
  
  // Split the content into two parts: main content and signature section
  const mainContentEnd = mainContentTemplate.indexOf('Please do not hesitate to contact');
  const signatureSectionStart = mainContentTemplate.indexOf('<div class="paragraph">\n          Please do not hesitate to contact');
  
  if (mainContentEnd === -1 || signatureSectionStart === -1) {
    // Fallback: return original template if we can't find the split point
    return [populateTemplate(mainContentTemplate, data)];
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
              [REPORT_TYPE] Clearance Certificate: [SITE_ADDRESS]
            </div>
          </div>
        </body>
      </html>
    `;
    
    // Populate both templates with data
    const populatedMainContent = populateTemplate(mainContentPage, data);
    const populatedSignaturePage = populateTemplate(signaturePageTemplate, data);
    
    return [populatedMainContent, populatedSignaturePage];
  } else {
    // No split needed, return original template
    return [populateTemplate(mainContentTemplate, data)];
  }
};

const populateTemplate = (htmlTemplate, data) => {
  
  // Replace logo placeholders with actual img tags
  let templateWithLogoPath = htmlTemplate.replace(/\[LOGO_PATH\]/g, '');
  
  try {
    templateWithLogoPath = templateWithLogoPath.replace(
      /<img\s+class="logo"[^>]*>/g,
      '<img class="logo" src="data:image/png;base64,' + logoBase64 + '" alt="Company Logo" />'
    );
    writeLog('Logo img replacement successful');
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
    try {
      // Remove the original background div completely
      templateWithLogoPath = templateWithLogoPath.replace(
        /<div\s+class="cover-bg"[^>]*><\/div>/g,
        ''
      );
      
      // Add simple background image at the start of cover-container
      templateWithLogoPath = templateWithLogoPath.replace(
        /<div class="cover-container">/g,
        '<div class="cover-container"><img src="data:image/jpeg;base64,' + backgroundBase64 + '" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;" /><svg style="position: absolute; top: 0; left: 0; width: 432px; height: 100%; z-index: 1; fill: white;" viewBox="0 0 432 1130" xmlns="http://www.w3.org/2000/svg"><polygon points="80,-10 426,240 426,884 80,1134 0,1134 0,0" /></svg>'
      );
      
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
    
    // console.log('Clearance items for table:', JSON.stringify(clearanceItems, null, 2));
    
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
    
    // console.log('Generating photographs content for first page from clearance items:', clearanceItems.length);
    // console.log('Items with photos:', itemsWithPhotos.length);
    
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
              Location: ${item.locationDescription || 'Unknown Location'}
            </div>
            <div class="photo-materials">
              Materials Description: ${item.materialDescription || 'Unknown Material'}
            </div>
          </div>
        </div>
      `;
    }).join('');
  };



  // Debug: Log the data structure
  console.log('=== DATA MAPPING DEBUG ===');
  // console.log('Full data object:', JSON.stringify(data, null, 2));
  console.log('data.projectId:', data.projectId);
  console.log('data.projectId?.name:', data.projectId?.name);
  console.log('data.projectId?.address:', data.projectId?.address);
  console.log('data.projectId?.projectID:', data.projectId?.projectID);
  console.log('data.clearanceType:', data.clearanceType);
  console.log('data.clearanceDate:', data.clearanceDate);
  console.log('data.projectId?.client?.name:', data.projectId?.client?.name);

  console.log('data.asbestosRemovalist:', data.asbestosRemovalist);
  console.log('data.LAA:', data.LAA);
  console.log('=== END DATA MAPPING DEBUG ===');
  
  // Test the actual replacements
  console.log('=== REPLACEMENT VALUES DEBUG ===');
  console.log('SITE_NAME will be:', data.projectId?.name || data.project?.name || data.siteName || 'Unknown Site');
  console.log('SITE_ADDRESS will be:', data.projectId?.name || data.project?.name || data.siteName || 'Unknown Site');
  console.log('PROJECT_ID will be:', data.projectId?.projectID || data.project?.projectID || data.projectId || 'Unknown Project');
  console.log('CLIENT_NAME will be:', data.projectId?.client?.name || data.project?.client?.name || data.clientName || 'Unknown Client');
  console.log('=== END REPLACEMENT VALUES DEBUG ===');
  
  // Additional debugging for the specific issue
  console.log('=== SPECIFIC DEBUG ===');
  console.log('data.projectId.name exists:', !!data.projectId?.name);
  console.log('data.projectId.name value:', data.projectId?.name);

  console.log('data.projectId.client exists:', !!data.projectId?.client);
  console.log('data.projectId.client:', data.projectId?.client);
  console.log('=== END SPECIFIC DEBUG ===');

  // Replace placeholders with actual data
  const replacements = {
    '[REPORT_TITLE]': `${data.clearanceType || 'Non-friable'} Asbestos Removal Clearance Certificate`,
    '[SITE_NAME]': data.projectId?.name || data.project?.name || data.siteName || 'Unknown Site',
    '[SITE_ADDRESS]': data.projectId?.name || data.project?.name || data.siteName || 'Unknown Site',
    '[PROJECT_ID]': data.projectId?.projectID || data.project?.projectID || data.projectId || 'Unknown Project',
    '[CLEARANCE_DATE]': data.clearanceDate 
      ? new Date(data.clearanceDate).toLocaleDateString('en-GB')
      : 'Unknown Date',
    '[CLIENT_NAME]': data.projectId?.client?.name || data.project?.client?.name || data.clientName || 'Unknown Client',
    '[ASBESTOS_TYPE]': data.clearanceType?.toLowerCase() || 'non-friable',
    '[ASBESTOS_REMOVALIST]': data.asbestosRemovalist || 'Unknown Removalist',
    '[LAA_NAME]': data.LAA || data.laaName || 'Unknown LAA',
    '[LAA_LICENSE]': 'AA00031',
    '[INSPECTION_TIME]': 'Inspection Time',
    '[INSPECTION_DATE]': data.clearanceDate 
      ? new Date(data.clearanceDate).toLocaleDateString('en-GB')
      : 'Unknown Date',
    '[REPORT_TYPE]': data.clearanceType || 'Non-friable',
    '[REMOVAL_ITEMS_TABLE]': generateRemovalItemsTable(),
    '[PHOTOGRAPHS_CONTENT]': generatePhotographsContent()
  };

  let populatedHTML = templateWithLogoPath;
  Object.entries(replacements).forEach(([placeholder, value]) => {
    populatedHTML = populatedHTML.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  });

  return populatedHTML;
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
    
    // Calculate how many photo pages we need
    const clearanceItems = data.clearanceItems || data.removalItems || data.asbestosItems || [];
    
    // Filter out items that don't have photographs
    const itemsWithPhotos = clearanceItems.filter(item => 
      item.photograph && item.photograph.trim() !== ''
    );
    
    const photosPerPage = 2;
    const photoPagesNeeded = Math.ceil(itemsWithPhotos.length / photosPerPage);
    writeLog(`Need ${photoPagesNeeded} photo pages for ${itemsWithPhotos.length} items with photos (out of ${clearanceItems.length} total items)`);
    

    
    // Create complete HTML document with dynamic pages
    writeLog('Available templates: ' + Object.keys(HTML_TEMPLATES).join(', '));
    
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

        ${(() => {
          // Process templates and insert extra photo pages before Appendix B
          const templates = Object.values(HTML_TEMPLATES);
          const clearanceItems = data.clearanceItems || data.removalItems || data.asbestosItems || [];
          
          // Filter out items that don't have photographs
          const itemsWithPhotos = clearanceItems.filter(item => 
            item.photograph && item.photograph.trim() !== ''
          );
          
          const photosPerPage = 2;
          const totalPhotoPages = Math.ceil(itemsWithPhotos.length / photosPerPage);
          
          let result = '';
          
          // Process pages 1-3 (cover, version control, background)
          for (let i = 0; i < 3; i++) {
            writeLog(`Template ${i + 1} contains cover-bg: ${templates[i].includes('cover-bg')}`);
            const populatedTemplate = populateTemplate(templates[i], data);
            result += `<div class="page-break">${populatedTemplate}</div>`;
          }
          
          // Generate main content pages (page 4 with potential overflow handling)
          const mainContentPages = generateMainContentPages(data);
          mainContentPages.forEach(page => {
            result += `<div class="page-break">${page}</div>`;
          });
          
          // Add Appendix A (page 5)
          const populatedTemplate = populateTemplate(templates[4], data);
          result += `<div class="page-break">${populatedTemplate}</div>`;
          
          // Add first photo page (page 6)
          const populatedPhotoTemplate = populateTemplate(templates[5], data);
          result += `<div class="page-break">${populatedPhotoTemplate}</div>`;
          
          // Add extra photo pages before Appendix B
          if (totalPhotoPages > 1) {
            // console.log(`Adding ${totalPhotoPages - 1} extra photo pages before Appendix B for ${itemsWithPhotos.length} items with photos`);
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
                        Location: ${item.locationDescription || 'Unknown Location'}
                      </div>
                      <div class="photo-materials">
                        Materials Description: ${item.materialDescription || 'Unknown Material'}
                      </div>
                    </div>
                  </div>
                `;
              }).join('');
              
              // Use populateTemplate to ensure logo and other data are included
              const extraPhotoPageTemplate = HTML_TEMPLATES.page6.replace('[PHOTOGRAPHS_CONTENT]', photoContent);
              const populatedExtraPhotoPage = populateTemplate(extraPhotoPageTemplate, data);
              result += `<div class="page-break">${populatedExtraPhotoPage}</div>`;
            }
          }
          
          // Add Appendix B (page 7)
          const populatedAppendixB = populateTemplate(templates[6], data);
          result += `<div class="page-break">${populatedAppendixB}</div>`;
          
          return result;
        })()}
      </body>
      </html>
    `;

    console.log('Complete HTML generated, length:', completeHTML.length);
    
    // Compress images in HTML to reduce file size
    console.log('Compressing images in HTML to 100KB each...');
    const compressedHTML = await compressImagesInHTML(completeHTML, 100);
    console.log('Image compression completed, HTML length:', compressedHTML.length);
    

    
    console.log('Generating PDF with all 7 pages...');
    
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

    console.log('PDF generation completed successfully with 7 pages');
    console.log('PDF buffer size:', pdf.length);
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
    writeLog('=== PDF GENERATION REQUEST RECEIVED - UPDATED CODE VERSION ===');
    writeLog('=== THIS IS THE NEW VERSION WITH LOGO OPTIMIZATION ===');
    writeLog('Request received for clearance ID: ' + req.body.clearanceData?._id);
    const { clearanceData } = req.body;
    
    if (!clearanceData) {
      console.log('ERROR: No clearance data provided');
      return res.status(400).json({ error: 'Clearance data is required' });
    }

    writeLog('Clearance data received for: ' + (clearanceData.projectId?.name || 'Unknown project'));
    
    // Fetch clearance items for this clearance
    console.log('Fetching clearance items for clearance ID:', clearanceData._id);
    const AsbestosClearanceReport = require('../models/AsbestosClearanceReport');
    const clearanceItems = await AsbestosClearanceReport.find({ clearanceId: clearanceData._id });
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