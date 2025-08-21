import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  Checkbox,
  FormControlLabel,
  FormControl,
  RadioGroup,
  Radio,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { clientService } from "../../services/api";
import {
  isValidAustralianMobile,
  isValidEmailOrDash,
} from "../../utils/formatters";
import { usePermissions } from "../../hooks/usePermissions";

const ClientDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    invoiceEmail: "",
    address: "",
    contact1Name: "",
    contact1Number: "",
    contact1Email: "",
    contact2Name: "",
    contact2Number: "",
    contact2Email: "",
    paymentTerms: "Standard (30 days)",
    written_off: false,
  });

  useEffect(() => {
    const fetchClient = async () => {
      try {
        setLoading(true);
        setError(null);

        if (id && id !== "undefined") {
          const response = await clientService.getById(id);
          if (response.data) {
            setForm({
              name: response.data.name || "",
              invoiceEmail: response.data.invoiceEmail || "",
              address: response.data.address || "",
              contact1Name: response.data.contact1Name || "",
              contact1Number: response.data.contact1Number || "",
              contact1Email: response.data.contact1Email || "",
              contact2Name: response.data.contact2Name || "",
              contact2Number: response.data.contact2Number || "",
              contact2Email: response.data.contact2Email || "",
              paymentTerms: response.data.paymentTerms || "Standard (30 days)",
              written_off: response.data.written_off || false,
            });
          } else {
            setError("Client not found");
          }
        } else {
          navigate("/clients");
        }
      } catch (err) {
        console.error("Error fetching client:", err);
        setError("Failed to load client data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchClient();
  }, [id, navigate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);
      await clientService.update(id, form);
      navigate("/clients");
    } catch (err) {
      console.error("Error updating client:", err);
      setError("Failed to update client. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
      </Box>
    );

  if (error)
    return (
      <Box m="20px">
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button onClick={() => navigate("/clients")} variant="contained">
          Back to Clients
        </Button>
      </Box>
    );

  return (
    <Box m="20px">
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton onClick={() => navigate("/clients")} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4">Client Details</Typography>
      </Box>

      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Client Name"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                fullWidth
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Invoice Email"
                name="invoiceEmail"
                value={form.invoiceEmail}
                onChange={handleChange}
                fullWidth
                placeholder="email@example.com or '-' for no email"
                error={
                  form.invoiceEmail && !isValidEmailOrDash(form.invoiceEmail)
                }
                helperText={
                  form.invoiceEmail && !isValidEmailOrDash(form.invoiceEmail)
                    ? "Please enter a valid email address or use '-' for no email"
                    : ""
                }
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Address"
                name="address"
                value={form.address}
                onChange={handleChange}
                fullWidth
                placeholder="Address or '-' for no address"
              />
            </Grid>

            <Grid item xs={12}>
              <Typography
                variant="h6"
                sx={{ mt: 2, mb: 1, fontWeight: "bold" }}
              >
                Primary Contact
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Contact Name"
                name="contact1Name"
                value={form.contact1Name}
                onChange={handleChange}
                fullWidth
                placeholder="Contact name or '-' for no contact"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Contact Phone"
                name="contact1Number"
                value={form.contact1Number}
                onChange={handleChange}
                fullWidth
                placeholder="04xx xxx xxx or '-' for no phone"
                error={
                  form.contact1Number &&
                  !isValidAustralianMobile(form.contact1Number)
                }
                helperText={
                  form.contact1Number &&
                  !isValidAustralianMobile(form.contact1Number)
                    ? "Please enter a valid Australian mobile number or use '-' for no phone"
                    : ""
                }
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Contact Email"
                name="contact1Email"
                value={form.contact1Email}
                onChange={handleChange}
                fullWidth
                placeholder="email@example.com or '-' for no email"
                error={
                  form.contact1Email && !isValidEmailOrDash(form.contact1Email)
                }
                helperText={
                  form.contact1Email && !isValidEmailOrDash(form.contact1Email)
                    ? "Please enter a valid email address or use '-' for no email"
                    : ""
                }
              />
            </Grid>

            <Grid item xs={12}>
              <Typography
                variant="h6"
                sx={{ mt: 2, mb: 1, fontWeight: "bold" }}
              >
                Secondary Contact (Optional)
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Contact Name"
                name="contact2Name"
                value={form.contact2Name}
                onChange={handleChange}
                fullWidth
                placeholder="Contact name or '-' for no contact"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Contact Phone"
                name="contact2Number"
                value={form.contact2Number}
                onChange={handleChange}
                fullWidth
                placeholder="04xx xxx xxx or '-' for no phone"
                error={
                  form.contact2Number &&
                  !isValidAustralianMobile(form.contact2Number)
                }
                helperText={
                  form.contact2Number &&
                  !isValidAustralianMobile(form.contact2Number)
                    ? "Please enter a valid Australian mobile number or use '-' for no phone"
                    : ""
                }
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Contact Email"
                name="contact2Email"
                value={form.contact2Email}
                onChange={handleChange}
                fullWidth
                placeholder="email@example.com or '-' for no email"
                error={
                  form.contact2Email && !isValidEmailOrDash(form.contact2Email)
                }
                helperText={
                  form.contact2Email && !isValidEmailOrDash(form.contact2Email)
                    ? "Please enter a valid email address or use '-' for no email"
                    : ""
                }
              />
            </Grid>

            <Grid item xs={12}>
              <Typography
                variant="h6"
                sx={{ mt: 2, mb: 1, fontWeight: "bold" }}
              >
                Payment Terms
              </Typography>
              <FormControl>
                <RadioGroup
                  row
                  name="paymentTerms"
                  value={form.paymentTerms}
                  onChange={handleChange}
                >
                  <FormControlLabel
                    value="Standard (30 days)"
                    control={<Radio />}
                    label="Standard (30 days)"
                  />
                  <FormControlLabel
                    value="Payment before Report (7 days)"
                    control={<Radio />}
                    label="Payment before Report (7 days)"
                  />
                </RadioGroup>
              </FormControl>
            </Grid>

            {can("clients.write_off") && (
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      name="written_off"
                      checked={form.written_off}
                      onChange={handleChange}
                      sx={{
                        color: "red",
                        "&.Mui-checked": {
                          color: "red",
                        },
                      }}
                    />
                  }
                  label={
                    <Typography sx={{ color: "red", fontWeight: "bold" }}>
                      WRITTEN OFF?
                    </Typography>
                  }
                />
              </Grid>
            )}

            <Grid item xs={12}>
              <Box display="flex" gap={2} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={() => navigate("/clients")}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="contained" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  );
};

export default ClientDetails;
