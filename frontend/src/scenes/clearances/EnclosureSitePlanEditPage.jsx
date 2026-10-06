import React, { useCallback } from "react";
import { useParams } from "react-router-dom";
import SitePlanEditPage from "../../components/SitePlanEditPage";
import asbestosClearanceService from "../../services/asbestosClearanceService";
import { getSitePlanAppendices } from "../../utils/sitePlanAppendices";

const DEFAULT_TITLE = "Asbestos Removal Enclosure Site Plan";

export default function EnclosureSitePlanEditPage() {
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
    <SitePlanEditPage
      loadEntity={loadEntity}
      savePlans={savePlans}
      getPlans={(e) =>
        getSitePlanAppendices(e, { defaultFigureTitle: DEFAULT_TITLE })
      }
      isLocked={isLocked}
      listPath={`/asbestos-removal/jobs/${jobId}/enclosure-inspection/${clearanceId}/site-plans`}
      defaultFigureTitle={DEFAULT_TITLE}
    />
  );
}
