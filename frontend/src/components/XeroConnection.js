import React, { useState, useEffect } from 'react';
import { Button, Alert, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { xeroService } from '../services/api';

const XeroConnection = () => {
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const checkConnection = async () => {
    try {
      setStatus('checking');
      const response = await fetch('http://localhost:5000/api/xero/status');
      const data = await response.json();
      
      if (response.ok) {
        setStatus(data.connected ? 'connected' : 'disconnected');
        setError(null);
      } else {
        setStatus('disconnected');
        setError(data.message || 'Failed to check Xero connection');
      }
    } catch (error) {
      console.error('Error checking Xero connection:', error);
      setStatus('disconnected');
      setError('Failed to check Xero connection');
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const handleConnect = async () => {
    try {
      setStatus('connecting');
      const response = await xeroService.getAuthUrl();
      const data = response.data;
      
      if (data.authUrl) {
        // Store state in sessionStorage for verification
        sessionStorage.setItem('xeroState', data.state);
        console.log('Redirecting to Xero auth URL:', data.authUrl);
        window.location.href = data.authUrl;
      } else {
        setStatus('disconnected');
        setError(data.message || 'Failed to get Xero authorization URL');
      }
    } catch (error) {
      console.error('Error connecting to Xero:', error);
      setStatus('disconnected');
      setError('Failed to connect to Xero');
    }
  };

  const handleDisconnect = async () => {
    try {
      setStatus('disconnecting');
      const response = await fetch('http://localhost:5000/api/xero/disconnect', {
        method: 'POST'
      });
      
      if (response.ok) {
        setStatus('disconnected');
        setError(null);
        // Refresh the page to clear any cached Xero data
        window.location.reload();
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to disconnect from Xero');
      }
    } catch (error) {
      console.error('Error disconnecting from Xero:', error);
      setError('Failed to disconnect from Xero');
    }
  };

  if (status === 'checking' || status === 'connecting' || status === 'disconnecting') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <CircularProgress size={20} />
        <span>
          {status === 'checking' && 'Checking Xero connection...'}
          {status === 'connecting' && 'Connecting to Xero...'}
          {status === 'disconnecting' && 'Disconnecting from Xero...'}
        </span>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {status === 'connected' ? (
        <div>
          <Alert severity="success" sx={{ mb: 2 }}>
            Connected to Xero
          </Alert>
          <Button
            variant="outlined"
            color="error"
            onClick={handleDisconnect}
          >
            Disconnect from Xero
          </Button>
        </div>
      ) : (
        <Button
          variant="contained"
          color="primary"
          onClick={handleConnect}
        >
          Connect to Xero
        </Button>
      )}
    </div>
  );
};

export default XeroConnection; 