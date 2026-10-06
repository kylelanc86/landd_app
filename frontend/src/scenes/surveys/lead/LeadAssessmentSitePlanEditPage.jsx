import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import SitePlanEditPage from "../../../components/SitePlanEditPage";
import asbestosAssessmentService from "../../../services/asbestosAssessmentService";
import { getSitePlanAppendices } from "../../../utils/sitePlanAppendices";
import { getLeadSampleMarkerMeta } from "../../../utils/leadSampleMarkerMeta";

/**
 * Lead assessment site plan OR assessment-area plan editor.
 * kind = "site" | "assessment"
 */
export default function LeadAssessmentSitePlanEditPage({ kind = "site" }) {
  const { id } = useParams();
  const isAssessmentArea = kind === "assessment";
  const field = isAssessmentArea
    ? "leadAssessmentPlanAppendices"
    : "leadSitePlanAppendices";
  const defaultFigureTitle = isAssessmentArea
    ? "Assessment Area Plan"
    : "Lead Assessment Site Plan";

  const [items, setItems] = useState([]);

  useEffect(() => {
    if (isAssessmentArea) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await asbestosAssessmentService.getItems(id);
        if (!cancelled) setItems(data || []);
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isAssessmentArea]);

  const sampleMarkerOptions = useMemo(() => {
    if (isAssessmentArea) return null;
    const out = [];
    const seen = new Set();
    for (const it of items) {
      const ref = String(it.sampleReference || "").trim();
      if (!ref) continue;
      const mt = String(it.materialType || "").toLowerCase();
      if (!["paint", "paint-xrf", "dust", "soil"].includes(mt) || seen.has(ref))
        continue;
      seen.add(ref);
      const meta = getLeadSampleMarkerMeta(it);
      out.push({
        value: meta.value,
        isPositive: meta.isPositive,
        statusKnown: meta.statusKnown,
      });
    }
    return out.sort((a, b) => a.value.localeCompare(b.value));
  }, [items, isAssessmentArea]);

  const loadEntity = useCallback(
    () => asbestosAssessmentService.getById(id, { omitPhotoData: true }),
    [id],
  );

  const savePlans = useCallback(
    async (entity, plans) => {
      await asbestosAssessmentService.update(id, {
        projectId: entity.projectId?._id || entity.projectId,
        assessmentDate: entity.assessmentDate,
        status: entity.status,
        [field]: plans,
      });
    },
    [id, field],
  );

  const getPlans = useCallback(
    (entity) =>
      getSitePlanAppendices(entity, {
        appendicesField: field,
        defaultFigureTitle,
      }),
    [field, defaultFigureTitle],
  );

  const isLocked = useCallback((assessment) => {
    const v = assessment?.reportAuthorisedBy;
    if (v == null) return false;
    return typeof v === "string" ? v.trim() !== "" : !!v;
  }, []);

  const listPath = isAssessmentArea
    ? `/surveys/lead/${id}/assessment-area-plans`
    : `/surveys/lead/${id}/site-plans`;

  return (
    <SitePlanEditPage
      loadEntity={loadEntity}
      savePlans={savePlans}
      getPlans={getPlans}
      isLocked={isLocked}
      listPath={listPath}
      defaultFigureTitle={defaultFigureTitle}
      sitePlanDrawingProps={
        isAssessmentArea
          ? { hideMapSection: true }
          : { enableSampleMarkers: true, sampleMarkerOptions }
      }
    />
  );
}
