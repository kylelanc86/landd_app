/** @typedef {{ id: string, source: 'existing' | 'new', existingId?: string, file?: File, name: string }} AnalysisReportListItem */

export function createNewAnalysisReportItem(file) {
  return {
    id: `new-${crypto.randomUUID()}`,
    source: "new",
    file,
    name: file.name,
  };
}

export function createExistingAnalysisReportItem(report) {
  return {
    id: `existing-${report.id}`,
    source: "existing",
    existingId: report.id,
    name: report.originalName || "analysis-report.pdf",
  };
}

export function buildAnalysisReportItemsFromShift(shift) {
  const files = shift?.analysisReportFiles;
  if (Array.isArray(files) && files.length > 0) {
    return files.map(createExistingAnalysisReportItem);
  }
  if (shift?.analysisReportPath) {
    return [
      createExistingAnalysisReportItem({
        id: "legacy",
        originalName: shift.analysisReportOriginalName || "analysis-report.pdf",
      }),
    ];
  }
  return [];
}

export function hasAnalysisReportChanges(items, shift) {
  const initial = buildAnalysisReportItemsFromShift(shift);
  if (items.length !== initial.length) return true;
  return items.some((item, index) => {
    const orig = initial[index];
    if (!orig) return true;
    if (item.source !== orig.source) return true;
    if (item.source === "existing") {
      return item.existingId !== orig.existingId;
    }
    return true;
  });
}

export function buildAnalysisReportsManifest(items) {
  return items.map((item) =>
    item.source === "existing"
      ? { kind: "existing", id: item.existingId }
      : { kind: "new", fileKey: `file_${item.id}` },
  );
}

export function appendPdfFiles(items, fileList) {
  const pdfs = Array.from(fileList || []).filter(
    (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
  );
  if (!pdfs.length) return items;
  return [...items, ...pdfs.map(createNewAnalysisReportItem)];
}

export async function persistAnalysisReportItems(shiftId, items, shift, shiftService) {
  const initial = buildAnalysisReportItemsFromShift(shift);
  const changed = hasAnalysisReportChanges(items, shift);
  if (!changed) return false;

  const allNew = items.length > 0 && items.every((item) => item.source === "new");
  const wasEmpty = initial.length === 0;

  if (allNew && wasEmpty) {
    await shiftService.uploadAnalysisReports(
      shiftId,
      items.map((item) => item.file),
    );
    return true;
  }

  const manifest = buildAnalysisReportsManifest(items);
  const filesByKey = {};
  items.forEach((item) => {
    if (item.source === "new" && item.file) {
      filesByKey[`file_${item.id}`] = item.file;
    }
  });
  await shiftService.saveAnalysisReports(shiftId, { manifest, filesByKey });
  return true;
}
