import React, { useCallback } from "react";
import { useParams } from "react-router-dom";
import SitePlanEditPage from "../../components/SitePlanEditPage";
import leadClearanceService from "../../services/leadClearanceService";
import { getSitePlanAppendices } from "../../utils/sitePlanAppendices";

const DEFAULT_TITLE = "Lead Clearance Site Plan";

export default function LeadClearanceSitePlanEditPage() {
  const { clearanceId } = useParams();

  const loadEntity = useCallback(
    () => leadClearanceService.getById(clearanceId, { omitPhotoData: true }),
    [clearanceId],
  );

  const savePlans = useCallback(
    async (_entity, plans) => {
      await leadClearanceService.update(clearanceId, {
        sitePlanAppendices: plans,
      });
    },
    [clearanceId],
  );

  const isLocked = useCallback((clearance) => {
    const v = clearance?.reportAuthorisedBy;
    if (v == null) return false;
    return typeof v === "string" ? v.trim() !== "" : !!v;
  }, []);

  return (
    <SitePlanEditPage
      loadEntity={loadEntity}
      savePlans={savePlans}
      getPlans={(e) =>
        getSitePlanAppendices(e, { defaultFigureTitle: DEFAULT_TITLE })
      }
      isLocked={isLocked}
      listPath={`/lead-clearances/${clearanceId}/site-plans`}
      defaultFigureTitle={DEFAULT_TITLE}
    />
  );
}
