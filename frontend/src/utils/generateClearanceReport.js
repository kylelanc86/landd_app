import jsPDF from "jspdf";
import asbestosClearanceReportService from "../services/asbestosClearanceReportService";

export const generateClearanceReport = async (clearance, setError) => {
  try {
    // Fetch clearance items for the report
    const reportsResponse = await asbestosClearanceReportService.getByClearanceId(clearance._id);
    const items = Array.isArray(reportsResponse) ? reportsResponse : [];

    // Create PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;

    // Front Cover
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("ASBESTOS CLEARANCE REPORT", pageWidth / 2, 60, {
      align: "center",
    });

    doc.setFontSize(16);
    doc.setFont("helvetica", "normal");
    doc.text("Project Information", pageWidth / 2, 90, { align: "center" });

    doc.setFontSize(12);
    doc.text(
      `Project ID: ${clearance.projectId?.projectID || "N/A"}`,
      margin,
      120
    );
    doc.text(`Site Name: ${clearance.projectId?.name || "N/A"}`, margin, 135);
    doc.text(
      `Clearance Date: ${
        clearance.clearanceDate
          ? new Date(clearance.clearanceDate).toLocaleDateString("en-GB")
          : "N/A"
      }`,
      margin,
      150
    );
    doc.text(`Clearance Type: ${clearance.clearanceType || "N/A"}`, margin, 165);
    doc.text(`LAA: ${clearance.LAA || "N/A"}`, margin, 180);
    doc.text(
      `Asbestos Removalist: ${clearance.asbestosRemovalist || "N/A"}`,
      margin,
      195
    );
    doc.text(`Status: ${clearance.status || "N/A"}`, margin, 210);

    doc.setFontSize(10);
    doc.text(
      `Report Generated: ${new Date().toLocaleDateString("en-GB")}`,
      margin,
      pageHeight - 30
    );
    doc.text(`Total Items: ${items.length}`, margin, pageHeight - 20);

    // Add new page for items
    if (items.length > 0) {
      doc.addPage();

      // Items Section
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Clearance Items", margin, 30);

      let yPosition = 50;
      let itemNumber = 1;

      for (const item of items) {
        // Check if we need a new page
        if (yPosition > pageHeight - 100) {
          doc.addPage();
          yPosition = 30;
        }

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(
          `Item ${itemNumber}: ${item.locationDescription}`,
          margin,
          yPosition
        );
        yPosition += 15;

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(
          `Material Description: ${item.materialDescription}`,
          margin,
          yPosition
        );
        yPosition += 10;

        doc.text(
          `Asbestos Type: ${item.asbestosType || "N/A"}`,
          margin,
          yPosition
        );
        yPosition += 10;

        if (item.notes) {
          doc.text(`Notes: ${item.notes}`, margin, yPosition);
          yPosition += 10;
        }

        // Add photo if available
        if (item.photograph) {
          try {
            // Convert base64 to image and add to PDF
            const img = new Image();
            img.src = item.photograph;

            // Wait for image to load
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              // Add timeout to prevent hanging
              setTimeout(reject, 10000);
            });

            // Calculate image dimensions to fit on page
            const maxWidth = contentWidth;
            const maxHeight = 100; // Slightly larger for better quality
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

            // Check if we need a new page for the image
            if (yPosition + imgHeight > pageHeight - 30) {
              doc.addPage();
              yPosition = 30;
            }

            // Add image with better error handling
            doc.addImage(
              item.photograph,
              "JPEG",
              margin,
              yPosition,
              imgWidth,
              imgHeight
            );
            yPosition += imgHeight + 10;
          } catch (error) {
            console.error("Error adding image to PDF:", error);
            doc.text("Photo: [Error loading image]", margin, yPosition);
            yPosition += 10;
          }
        } else {
          doc.text("Photo: No photo available", margin, yPosition);
          yPosition += 10;
        }

        // Add separator
        if (itemNumber < items.length) {
          doc.setDrawColor(200, 200, 200);
          doc.line(margin, yPosition, pageWidth - margin, yPosition);
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