import React, { useEffect, useState } from "react";
import { Box, Button, Snackbar, Alert } from "@mui/material";
import { AccountBalanceIcon, SyncIcon } from "@mui/icons-material";
import { colors } from "../../styles/colors";
import Header from "../../components/Header";
import { xeroService } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

const emptyForm = {
  invoiceID: "",
  projectID: "",
  client: "",
  amount: "",
  status: "unpaid",
  date: "",
  dueDate: "",
  description: "",
};

const Invoices = () => {
  const { user, loading: authLoading } = useAuth();
  const [xeroConnected, setXeroConnected] = useState(false);
  const [xeroError, setXeroError] = useState(null);
  const [showXeroAlert, setShowXeroAlert] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [dueDateManuallyChanged, setDueDateManuallyChanged] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    const checkXeroConnection = async () => {
      try {
        const response = await xeroService.checkStatus();

        if (response && response.data) {
          if (
            response.data.error === "XERO_AUTH_REQUIRED" ||
            response.status === 401
          ) {
            setXeroConnected(false);
            setXeroError(
              response.data.message || "Please connect to Xero first"
            );
            return;
          }

          const isConnected = response.data.connected;
          setXeroConnected(isConnected);
          setXeroError(null);
        } else {
          setXeroConnected(false);
          setXeroError("Failed to verify Xero connection");
        }
      } catch (error) {
        if (error.response?.status === 401) {
          setXeroConnected(false);
          setXeroError("Please connect to Xero first");
          return;
        }

        setXeroConnected(false);
        setXeroError(
          error.response?.data?.message || "Failed to verify Xero connection"
        );
      }
    };

    checkXeroConnection();
  }, [user, authLoading]);

  const handleDueDateChange = (e) => {
    setDueDateManuallyChanged(true);
    setForm((prev) => ({
      ...prev,
      dueDate: e.target.value,
    }));
  };

  const handleOpenDialog = () => {
    setForm(emptyForm);
    setDueDateManuallyChanged(false);
    setDialogOpen(true);
  };

  const handleConnectXero = async () => {
    if (!user) {
      setXeroError("Please log in to connect to Xero");
      setShowXeroAlert(true);
      navigate("/login");
      return;
    }

    try {
      const response = await xeroService.getAuthUrl();

      if (response && response.data && response.data.authUrl) {
        window.location.href = response.data.authUrl;
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error) {
      setXeroError(error.message || "Failed to connect to Xero");
      setShowXeroAlert(true);
    }
  };

  const handleSyncXero = async () => {
    try {
      setLoading(true);
      setXeroError(null);

      const response = await xeroService.syncInvoices();

      if (response.data?.error === "XERO_AUTH_REQUIRED") {
        setXeroConnected(false);
        setXeroError("Please connect to Xero first");
        setShowXeroAlert(true);
        return;
      }

      if (!response.data?.success) {
        throw new Error(response.data?.message || "Failed to sync with Xero");
      }

      setSuccess("Successfully synced with Xero");
      setShowXeroAlert(true);
    } catch (error) {
      let errorMessage = "Failed to sync with Xero";

      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      if (
        errorMessage.includes("reconnect") ||
        errorMessage.includes("connect first") ||
        errorMessage.includes("expired")
      ) {
        setXeroConnected(false);
      }

      setXeroError(errorMessage);
      setShowXeroAlert(true);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectXero = async () => {
    try {
      await xeroService.disconnect();
      setXeroConnected(false);
      setXeroError(null);
      setSuccess("Successfully disconnected from Xero");
      setShowXeroAlert(true);
    } catch (error) {
      setXeroError(error.message || "Failed to disconnect from Xero");
      setShowXeroAlert(true);
    }
  };

  return (
    <Box m="20px">
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Header title="INVOICES" subtitle="Managing your invoices" />
        <Box>
          {!xeroConnected ? (
            <Button
              variant="contained"
              color="secondary"
              onClick={handleConnectXero}
              sx={{
                backgroundColor: colors.secondary[500],
                "&:hover": {
                  backgroundColor: colors.secondary[600],
                },
                mr: 2,
              }}
            >
              <AccountBalanceIcon sx={{ mr: 1 }} />
              Connect to Xero
            </Button>
          ) : (
            <>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSyncXero}
                disabled={loading}
                sx={{
                  backgroundColor: colors.primary[500],
                  "&:hover": {
                    backgroundColor: colors.primary[600],
                  },
                  mr: 2,
                }}
              >
                <SyncIcon sx={{ mr: 1 }} />
                {loading ? "Syncing..." : "Sync with Xero"}
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={handleDisconnectXero}
                sx={{
                  backgroundColor: colors.error[500],
                  "&:hover": {
                    backgroundColor: colors.error[600],
                  },
                  mr: 2,
                }}
              >
                Disconnect from Xero
              </Button>
            </>
          )}
          <Button
            variant="contained"
            color="secondary"
            onClick={handleOpenDialog}
            sx={{
              backgroundColor: colors.secondary[500],
              "&:hover": {
                backgroundColor: colors.secondary[600],
              },
            }}
          >
            Add Invoice
          </Button>
        </Box>
      </Box>

      <Snackbar
        open={showXeroAlert}
        autoHideDuration={6000}
        onClose={() => setShowXeroAlert(false)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        sx={{
          position: "fixed !important",
          zIndex: 999999,
          top: "100px !important",
          right: "20px !important",
          left: "auto !important",
          transform: "none !important",
          "& .MuiAlert-root": {
            minWidth: "300px",
            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
          },
        }}
      >
        <Alert
          onClose={() => setShowXeroAlert(false)}
          severity={xeroError ? "error" : "success"}
          sx={{
            width: "100%",
            position: "relative",
            zIndex: 999999,
          }}
        >
          {xeroError || success || "Successfully connected to Xero!"}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Invoices;
