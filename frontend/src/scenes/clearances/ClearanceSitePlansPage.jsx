import React, { useCallback } from "react";
import { useParams } from "react-router-dom";
import { useMediaQuery, useTheme } from "@mui/material";
import SitePlansManagerPage from "../../components/SitePlansManagerPage";
import asbestosClearanceService from "../../services/asbestosClearanceService";
import { getSitePlanAppendices } from "../../utils/sitePlanAppendices";

const DEFAULT_TITLE = "Asbestos Removal Site Plan";

export default function ClearanceSitePlansPage() {
  const { clearanceId } = useParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

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
      lockedMessage="This clearance report is authorised and site plans cannot be edited."
      backPath={
        isMobile
          ? `/clearances/${clearanceId}/attachments`
          : `/clearances/${clearanceId}/items`
      }
      getEditPath={(idx) => `/clearances/${clearanceId}/site-plans/${idx}/edit`}
      defaultFigureTitle={DEFAULT_TITLE}
      backLabel="Back to clearance"
    />
  );
}
