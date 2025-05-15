import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Alert,
  CircularProgress
} from '@mui/material';
import XeroConnection from './XeroConnection';

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [xeroStatus, setXeroStatus] = useState('checking');

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('http://localhost:5000/api/xero/invoices');
      const data = await response.json();
      
      if (response.ok) {
        setInvoices(data);
      } else {
        if (response.status === 401) {
          setXeroStatus('disconnected');
          setError('Please connect to Xero first');
        } else {
          setError(data.message || 'Failed to fetch invoices');
        }
      }
    } catch (error) {
      setError('Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  };

  const checkXeroStatus = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/xero/status');
      const data = await response.json();
      
      if (response.ok) {
        setXeroStatus(data.connected ? 'connected' : 'disconnected');
        if (data.connected) {
          fetchInvoices();
        }
      } else {
        setXeroStatus('disconnected');
      }
    } catch (error) {
      setXeroStatus('disconnected');
    }
  };

  useEffect(() => {
    checkXeroStatus();
  }, []);

  if (xeroStatus === 'checking') {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <CircularProgress size={20} />
          <Typography>Checking Xero connection...</Typography>
        </div>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Invoices
      </Typography>

      <XeroConnection />

      {error && (
        <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
          {error}
        </Alert>
      )}

      {xeroStatus === 'connected' && !error && (
        <>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', mt: 2 }}>
              <CircularProgress size={20} />
              <Typography>Loading invoices...</Typography>
            </div>
          ) : (
            <TableContainer component={Paper} sx={{ mt: 2 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Invoice Number</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Due Date</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.invoiceID}>
                      <TableCell>{invoice.invoiceNumber}</TableCell>
                      <TableCell>{new Date(invoice.date).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(invoice.dueDate).toLocaleDateString()}</TableCell>
                      <TableCell>${invoice.total.toFixed(2)}</TableCell>
                      <TableCell>{invoice.status}</TableCell>
                      <TableCell>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => window.open(invoice.url, '_blank')}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}
    </Container>
  );
};

export default Invoices; 