import React, { useCallback } from "react";
import { useParams } from "react-router-dom";
import SitePlansManagerPage from "../../components/SitePlansManagerPage";
import asbestosClearanceService from "../../services/asbestosClearanceService";
import { getSitePlanAppendices } from "../../utils/sitePlanAppendices";

const DEFAULT_TITLE = "Asbestos Removal Enclosure Site Plan";

export default function EnclosureSitePlansPage() {
  const { jobId, clearanceId } = useParams();

  const loadEntity = useCallback(
    () => asbestosClearanceService.getById(clearanceId, { omitPhotoData: true }),
    [clearanceId],
  );

  const savePlans = useCallback(
    async (_entity, plans) => {
      await asbestosClearanceService.update(clearanceId, {
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
      lockedMessage="This report is authorised and site plans cannot be edited."
      backPath={`/asbestos-removal/jobs/${jobId}/enclosure-inspection/${clearanceId}`}
      getEditPath={(idx) =>
        `/asbestos-removal/jobs/${jobId}/enclosure-inspection/${clearanceId}/site-plans/${idx}/edit`
      }
      defaultFigureTitle={DEFAULT_TITLE}
      pageTitle="Enclosure site plans"
      backLabel="Back to enclosure inspection"
      description="Add, draw, or upload enclosure plans. Drag to reorder — this order is used in the enclosure certificate PDF."
    />
  );
}
