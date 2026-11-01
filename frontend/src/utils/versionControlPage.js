import { reportRevisionService } from "../services/api";
import { formatDateInSydney } from "./dateUtils";

const AWAITING_AUTHORISATION = "Awaiting authorisation";

function reportIdString(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return String(value._id);
  return String(value);
}

function headerCell(text, extra = {}) {
  return {
    text,
    style: "tableHeader",
    fontSize: 7,
    fillColor: "#f0f0f0",
    ...extra,
  };
}

function bodyCell(text, extra = {}) {
  const value = text == null || text === "" ? "—" : String(text);
  return {
    text: value,
    style: "tableContent",
    fontSize: 7,
    ...extra,
  };
}

/**
 * Rows for the version control table.
 * Revision 0 is the original issue. Later rows use the stored revision reason
 * and the date that revision was opened. The approver is only known for the
 * version currently being issued.
 */
export async function loadVersionControlRows({
  reportType,
  reportId,
  reportKey,
  revision = 0,
  approvedBy,
  issueDate,
}) {
  const current = Math.max(0, Number(revision) || 0);
  const approver = String(approvedBy || "").trim();
  const id = reportIdString(reportId);
  let entries = [];

  if (reportType && id) {
    try {
      const response = await reportRevisionService.list({
        reportType,
        reportId: id,
        reportKey: reportKey || reportType,
      });
      entries = response.data?.entries || [];
    } catch (error) {
      console.warn("Version control history could not be loaded:", error);
    }
  }

  const byNumber = new Map(
    entries.map((entry) => [Number(entry.revisionNumber), entry]),
  );
  const rows = [];

  for (let number = 0; number <= current; number += 1) {
    const entry = byNumber.get(number);
    const isCurrent = number === current;
    rows.push({
      number,
      reason: number === 0 ? "Original issue" : entry?.reason || "—",
      approvedBy: isCurrent ? approver || AWAITING_AUTHORISATION : "—",
      date:
        number === 0
          ? formatDateInSydney(issueDate) || "—"
          : formatDateInSydney(entry?.revisedAt) || "—",
    });
  }

  return rows;
}

/** pdfMake block: its own page, heading, and the version control table. */
export function buildVersionControlContent(rows, { pageBreak = true } = {}) {
  return {
    ...(pageBreak ? { pageBreak: "before" } : {}),
    stack: [
      {
        text: "VERSION CONTROL",
        style: "header",
        alignment: "center",
        margin: [0, 0, 0, 12],
      },
      {
        table: {
          headerRows: 1,
          widths: [36, "*", "26%", "16%"],
          body: [
            [
              headerCell("Rev", { alignment: "center" }),
              headerCell("Reason for revision"),
              headerCell("Version approved by"),
              headerCell("Date"),
            ],
            ...rows.map((row) => [
              bodyCell(row.number, { alignment: "center" }),
              bodyCell(row.reason),
              bodyCell(row.approvedBy),
              bodyCell(row.date),
            ]),
          ],
        },
        layout: {
          hLineWidth: (i, node) =>
            i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5,
          vLineWidth: (i, node) =>
            i === 0 || i === node.table.widths.length ? 1 : 0.5,
          hLineColor: () => "gray",
          vLineColor: () => "gray",
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 6,
          paddingBottom: () => 6,
          fillColor: (rowIndex) => (rowIndex === 0 ? "#f0f0f0" : null),
        },
      },
    ],
  };
}
