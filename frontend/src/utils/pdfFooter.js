/** Width of footer content row (page width minus page side margins). */
export const FOOTER_CONTENT_WIDTH = 515;

/** NATA logo display size in footer (aspect ratio ~10:3). */
export const NATA_LOGO_FOOTER_WIDTH = 40;
export const NATA_LOGO_FOOTER_HEIGHT = 55;
export const NATA_LOGO_FOOTER_FIT = [NATA_LOGO_FOOTER_WIDTH, NATA_LOGO_FOOTER_HEIGHT];

/** Text column — explicit remainder. */
export const FOOTER_TEXT_WIDTH = FOOTER_CONTENT_WIDTH - NATA_LOGO_FOOTER_WIDTH;

/**
 * Lab report footer (Fibre ID, Fibre Count): text left, NATA logo right.
 * Explicit column widths on a fixed-width row; label + reference on one line.
 * Horizontal margin [40, …, 40] aligns footer with body (footer draws on full page).
 */
export function buildLabReportFooter({
  reportReference,
  revision = 0,
  currentPage,
  pageCount,
  hasNataLogo = false,
  lineSpacing = 4,
  lineWidth = 2,
}) {
  const gap = lineSpacing;

  return {
    stack: [
      {
        canvas: [
          {
            type: 'line',
            x1: 0,
            y1: 0,
            x2: FOOTER_CONTENT_WIDTH,
            y2: 0,
            lineWidth,
            lineColor: '#16b12b',
          },
        ],
        margin: [0, 0, 0, 8],
      },
      {
        width: FOOTER_CONTENT_WIDTH,
        columns: [
          {
            width: FOOTER_TEXT_WIDTH,
            stack: [
              {
                text: `Report Reference: ${reportReference}`,
                fontSize: 8,
                margin: [0, 4, 4, 0],
              },
              {
                text: `Revision: ${revision}`,
                fontSize: 8,
                margin: [0, gap, 0, 0],
              },
              {
                text: `Page ${currentPage} of ${pageCount}`,
                fontSize: 8,
                margin: [0, gap, 0, 4],
              },
            ],
          },
          {
            width: NATA_LOGO_FOOTER_WIDTH,
            stack: hasNataLogo
              ? [
                  {
                    image: 'nataLogo',
                    width: NATA_LOGO_FOOTER_WIDTH,
                    height: NATA_LOGO_FOOTER_HEIGHT,
                    alignment: 'right',
                  },
                ]
              : [],
          },
        ],
        columnGap: 0,
      },
    ],
    margin: [40, 10, 40, 0],
  };
}
