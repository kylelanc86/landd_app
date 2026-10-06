import React, { useCallback } from "react";
import { useParams } from "react-router-dom";
import SitePlansManagerPage from "../../../components/SitePlansManagerPage";
import asbestosAssessmentService from "../../../services/asbestosAssessmentService";
import { getSitePlanAppendices } from "../../../utils/sitePlanAppendices";

/**
 * Lead assessment site plans OR assessment-area plans manager.
 * kind = "site" | "assessment" from route.
 */
export default function LeadAssessmentSitePlansPage({ kind = "site" }) {
  const { id } = useParams();
  const isAssessmentArea = kind === "assessment";
  const field = isAssessmentArea
    ? "leadAssessmentPlanAppendices"
    : "leadSitePlanAppendices";
  const defaultFigureTitle = isAssessmentArea
    ? "Assessment Area Plan"
    : "Lead Assessment Site Plan";
  const countField = isAssessmentArea
    ? "leadAssessmentPlanAppendixFileCount"
    : "leadSitePlanAppendixFileCount";

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
        countField,
      }),
    [field, defaultFigureTitle, countField],
  );

  const isLocked = useCallback((assessment) => {
    const v = assessment?.reportAuthorisedBy;
    if (v == null) return false;
    return typeof v === "string" ? v.trim() !== "" : !!v;
  }, []);

  const base = isAssessmentArea
    ? `/surveys/lead/${id}/assessment-area-plans`
    : `/surveys/lead/${id}/site-plans`;

  return (
    <SitePlansManagerPage
      loadEntity={loadEntity}
      savePlans={savePlans}
      getPlans={getPlans}
      isLocked={isLocked}
      lockedMessage="This report is authorised and plans cannot be edited."
      backPath={`/surveys/lead/${id}/items`}
      getEditPath={(idx) => `${base}/${idx}/edit`}
      defaultFigureTitle={defaultFigureTitle}
      pageTitle={isAssessmentArea ? "Assessment area plans" : "Site plans"}
      backLabel="Back to items"
      description={
        isAssessmentArea
          ? "Add or draw assessment area plans. Drag to reorder — this order is used in the report."
          : "Add, draw, or upload site plans for the report appendix. Drag to reorder — this order is used in the PDF."
      }
    />
  );
}
