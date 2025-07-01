import jsPDF from "jspdf";
import asbestosClearanceReportService from "../services/asbestosClearanceReportService";
import './Gothic-normal.js'
import './Gothic-bold.js'
import './Gothic-italic.js'
import './Gothic-bold-italic.js'

// Helper to load image as base64
const loadImageAsBase64 = (url) => {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "Anonymous";
    img.onload = function () {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
};

export const generateClearanceReport = async (clearance, setError) => {
  try {
    // Fetch clearance items for the report
    const reportsResponse = await asbestosClearanceReportService.getByClearanceId(clearance._id);
    const items = Array.isArray(reportsResponse) ? reportsResponse : [];

    // Load images as base64
    const [frontImg, logoImg] = await Promise.all([
      loadImageAsBase64("/images/clearance_front.bmp"),
      loadImageAsBase64("/images/logo.png"),
    ]);

    // Create PDF
    const doc = new jsPDF();;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // --- FRONT COVER ---
    // Draw the grayscale image on the right half
    doc.addImage(frontImg, "BMP", 0, 0, pageWidth, pageHeight);

    const centerX = pageWidth / 2
    // Define a polygon for the white overlay (user can edit this array)
    const poly = [
      [-20, -20],
      [10, -20],
      [centerX, 60],
      [centerX, pageHeight-60],
      [10, pageHeight+20],
      [-20, pageHeight+20], 
      [-20, -20]
    ];

    // Draw the white polygon with green border ONLY on the first page
    if (doc.internal.getNumberOfPages() === 1) {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(0, 153, 0);
      doc.setLineWidth(3);
      if (typeof doc.polygon === 'function') {
        doc.polygon(poly, "FD"); // Fill and draw border
      } else {
        // Convert absolute points to relative for doc.lines
        const relPoly = [];
        for (let i = 1; i < poly.length; i++) {
          relPoly.push([poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]]);
        }
        doc.lines(relPoly, poly[0][0], poly[0][1], [1, 1], "FD");
      }
      // Reset colors and line width for the rest of the doc
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.2);
    }


    // Content box margins
    const leftMargin = 10;
    let y = 38 + 35;
    const contentWidth = pageWidth / 2 - leftMargin * 2;

    // Title
    doc.setFontSize(20);
    doc.setFont("Gothic Bold", "bold");
    doc.text(
      `${clearance.clearanceType?.toUpperCase() || "ASBESTOS"} REMOVAL CLEARANCE CERTIFICATE`,
      leftMargin,
      y,
      { maxWidth: contentWidth }
    );
    y += 24;

    // Site Name & Address
    doc.setFontSize(18);
    doc.setFont("Gothic Bold", "bold");
    if (clearance.projectId?.name) {
      doc.text(clearance.projectId.name, leftMargin, y, { maxWidth: contentWidth });
      y += 8;
    }
    if (clearance.projectId?.address) {
      doc.text(clearance.projectId.address, leftMargin, y, { maxWidth: contentWidth });
      y += 8;
    }
    if (clearance.projectId?.suburb || clearance.projectId?.state || clearance.projectId?.postcode) {
      const addrLine = [clearance.projectId.suburb, clearance.projectId.state, clearance.projectId.postcode].filter(Boolean).join(" ");
      if (addrLine) {
        doc.text(addrLine, leftMargin, y, { maxWidth: contentWidth });
        y += 8;
      }
    }
    y += 24;

    // Job Reference
    doc.setFontSize(15);
    doc.setFont("Gothic Bold", "bold");
    doc.text("Job Reference", leftMargin, y);
    doc.setFont("GOTHIC", "normal");
    y += 7;
    doc.text(clearance.projectId?.projectID || "N/A", leftMargin, y);
    y += 15;

    // Clearance Date
    doc.setFontSize(15);
    doc.setFont("Gothic Bold", "bold");
    doc.text("Clearance Date", leftMargin, y);
    doc.setFont("GOTHIC", "normal");
    y += 7;
    doc.text(
      clearance.clearanceDate
        ? new Date(clearance.clearanceDate).toLocaleDateString("en-GB")
        : "N/A",
      leftMargin,
      y
    );
    y += 15;

    // Company details (bottom left)
    const companyY = pageHeight - 55;
    doc.setFontSize(11);
    doc.setFont("GOTHIC", "normal");
    doc.text(
      [
        "Lancaster & Dickenson Consulting Pty Ltd",
        "4/6 Dacre Street, Mitchell ACT 2911",
        "enquiries@landd.com.au",
        "(02) 6241 2779",
      ],
      leftMargin,
      companyY
    );

    // Logo (bottom right, but inside white area)
    const logoWidth = 65;
    const logoHeight = 18;
    doc.addImage(
      logoImg,
      "PNG",
      pageWidth - logoWidth - 18,
      pageHeight - logoHeight - 18,
      logoWidth,
      logoHeight
    );

    // --- REST OF REPORT (existing logic) ---
    if (items.length > 0) {
      doc.addPage();
      doc.setFontSize(18);
      doc.setFont("Gothic Bold", "bold");
      doc.text("Clearance Items", 20, 30);
      let yPosition = 50;
      let itemNumber = 1;
      for (const item of items) {
        if (yPosition > pageHeight - 100) {
          doc.addPage();
          yPosition = 30;
        }
        doc.setFontSize(14);
        doc.setFont("Gothic Bold", "bold");
        doc.text(
          `Item ${itemNumber}: ${item.locationDescription}`,
          20,
          yPosition
        );
        yPosition += 15;
        doc.setFontSize(12);
        doc.setFont("GOTHIC", "normal");
        doc.text(
          `Material Description: ${item.materialDescription}`,
          20,
          yPosition
        );
        yPosition += 10;
        doc.text(
          `Asbestos Type: ${item.asbestosType || "N/A"}`,
          20,
          yPosition
        );
        yPosition += 10;
        if (item.notes) {
          doc.text(`Notes: ${item.notes}`, 20, yPosition);
          yPosition += 10;
        }
        if (item.photograph) {
          try {
            const img = new Image();
            img.src = item.photograph;
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              setTimeout(reject, 10000);
            });
            const maxWidth = contentWidth;
            const maxHeight = 100;
            let imgWidth = img.width;
            let imgHeight = img.height;
            if (imgWidth > maxWidth) {
              const ratio = maxWidth / imgWidth;
              imgWidth = maxWidth;
              imgHeight = imgHeight * ratio;
            }
            if (imgHeight > maxHeight) {
              const ratio = maxHeight / imgHeight;
              imgHeight = maxHeight;
              imgWidth = imgWidth * ratio;
            }
            if (yPosition + imgHeight > pageHeight - 30) {
              doc.addPage();
              yPosition = 30;
            }
            doc.addImage(
              item.photograph,
              "JPEG",
              20,
              yPosition,
              imgWidth,
              imgHeight
            );
            yPosition += imgHeight + 10;
          } catch (error) {
            console.error("Error adding image to PDF:", error);
            doc.text("Photo: [Error loading image]", 20, yPosition);
            yPosition += 10;
          }
        } else {
          doc.text("Photo: No photo available", 20, yPosition);
          yPosition += 10;
        }
        if (itemNumber < items.length) {
          doc.setDrawColor(200, 200, 200);
          doc.line(20, yPosition, pageWidth - 20, yPosition);
          yPosition += 20;
        }
        itemNumber++;
      }
    }
    // Save the PDF
    const fileName = `Clearance_Report_${clearance.projectId?.projectID || 'Unknown'}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  } catch (err) {
    console.error("Error generating PDF report:", err);
    if (setError) {
      setError("Failed to generate PDF report");
    }
  }
}; 