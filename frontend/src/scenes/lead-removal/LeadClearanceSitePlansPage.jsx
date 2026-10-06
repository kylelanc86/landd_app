import React, { useCallback } from "react";
import { useParams } from "react-router-dom";
import SitePlansManagerPage from "../../components/SitePlansManagerPage";
import leadClearanceService from "../../services/leadClearanceService";
import { getSitePlanAppendices } from "../../utils/sitePlanAppendices";

const DEFAULT_TITLE = "Lead Clearance Site Plan";

export default function LeadClearanceSitePlansPage() {
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
    <SitePlansManagerPage
      loadEntity={loadEntity}
      savePlans={savePlans}
      getPlans={(e) =>
        getSitePlanAppendices(e, { defaultFigureTitle: DEFAULT_TITLE })
      }
      isLocked={isLocked}
      lockedMessage="This clearance report is authorised and site plans cannot be edited."
      backPath={`/lead-clearances/${clearanceId}/items`}
      getEditPath={(idx) =>
        `/lead-clearances/${clearanceId}/site-plans/${idx}/edit`
      }
      defaultFigureTitle={DEFAULT_TITLE}
      backLabel="Back to clearance"
      description="Add, draw, or upload site plans for this lead clearance. Drag to reorder — this order is used in the PDF report appendix."
    />
  );
}
