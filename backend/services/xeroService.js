const xero = require('../config/xero');
const Invoice = require('../models/Invoice');

class XeroService {
  // Get authorization URL
  static async getAuthUrl() {
    try {
      const authUrl = await xero.buildConsentUrl();
      return authUrl;
    } catch (error) {
      throw error;
    }
  }

  // Handle callback and get tokens
  static async handleCallback(code) {
    try {
      const tokenSet = await xero.apiCallback(code);
      
      if (!tokenSet) {
        throw new Error('No token set received from Xero');
      }
      
      if (!tokenSet.access_token) {
        throw new Error('Invalid token set received from Xero - missing access token');
      }
      
      await xero.setTokenSet(tokenSet);
      
      const tenants = await xero.updateTenants();
      
      if (!tenants || tenants.length === 0) {
        throw new Error('No Xero organizations found. Please ensure you have access to at least one organization.');
      }
      
      const tenantId = tenants[0].tenantId;
      xero.setTenantId(tenantId);
      
      return tokenSet;
    } catch (error) {
      throw error;
    }
  }

  // Sync invoices from Xero to local database
  static async syncInvoicesFromXero() {
    try {
      console.log('Starting invoice sync from Xero...');
      
      // Get the token set
      const tokenSet = await xero.readTokenSet();
      console.log('Token set retrieved:', tokenSet ? 'Token exists' : 'No token');
      
      if (!tokenSet || !tokenSet.access_token) {
        throw new Error('No valid token set available');
      }

      // Get the tenant ID
      const tenantId = await xero.getTenantId();
      console.log('Tenant ID retrieved:', tenantId ? 'ID exists' : 'No ID');
      
      if (!tenantId) {
        throw new Error('No tenant ID available');
      }

      console.log('Getting invoices from Xero...');
      
      // Get invoices from Xero using the accounting API
      const response = await xero.accountingApi.getInvoices(
        tenantId,
        undefined,
        'Type=="ACCREC"'
      );

      if (!response || !response.body || !response.body.Invoices) {
        console.error('Invalid response from Xero:', response);
        throw new Error('Invalid response from Xero');
      }

      const xeroInvoices = response.body.Invoices;
      console.log(`Found ${xeroInvoices.length} invoices in Xero`);

      let successCount = 0;
      let errorCount = 0;

      // Process each invoice
      for (const xeroInvoice of xeroInvoices) {
        try {
          // Check if invoice already exists in our database
          const existingInvoice = await Invoice.findOne({ 
            xeroInvoiceId: xeroInvoice.InvoiceID 
          });

          if (existingInvoice) {
            // Update existing invoice
            existingInvoice.amount = xeroInvoice.Total;
            existingInvoice.status = xeroInvoice.Status.toLowerCase();
            existingInvoice.date = new Date(xeroInvoice.Date);
            existingInvoice.dueDate = new Date(xeroInvoice.DueDate);
            existingInvoice.description = xeroInvoice.LineItems?.[0]?.Description || '';
            existingInvoice.lastSynced = new Date();
            await existingInvoice.save();
            console.log(`Updated invoice ${xeroInvoice.InvoiceNumber}`);
            successCount++;
          } else {
            // Create new invoice
            const newInvoice = new Invoice({
              invoiceID: xeroInvoice.InvoiceNumber,
              amount: xeroInvoice.Total,
              status: xeroInvoice.Status.toLowerCase(),
              date: new Date(xeroInvoice.Date),
              dueDate: new Date(xeroInvoice.DueDate),
              description: xeroInvoice.LineItems?.[0]?.Description || '',
              xeroInvoiceId: xeroInvoice.InvoiceID,
              xeroStatus: xeroInvoice.Status,
              lastSynced: new Date()
            });
            await newInvoice.save();
            console.log(`Created new invoice ${xeroInvoice.InvoiceNumber}`);
            successCount++;
          }
        } catch (error) {
          console.error(`Error processing invoice ${xeroInvoice.InvoiceNumber}:`, error);
          errorCount++;
          // Continue with next invoice even if one fails
          continue;
        }
      }

      console.log(`Invoice sync completed. Success: ${successCount}, Errors: ${errorCount}`);
      return { 
        success: true, 
        message: `Successfully synced ${successCount} invoices${errorCount > 0 ? ` (${errorCount} errors)` : ''}` 
      };
    } catch (error) {
      console.error('Error syncing invoices from Xero:', error);
      
      // Handle specific error cases
      if (error.statusCode === 401) {
        throw new Error('Xero connection expired. Please reconnect to Xero.');
      }
      
      // Add more detailed error information
      const errorMessage = error.message || 'Unknown error occurred';
      const errorDetails = error.response?.data || error.stack || 'No additional details available';
      console.error('Detailed error information:', { errorMessage, errorDetails });
      
      // Check for specific Xero API errors
      if (error.response?.data?.ErrorNumber) {
        throw new Error(`Xero API Error: ${error.response.data.Message || errorMessage}`);
      }
      
      // Check for token expiration
      if (error.message?.includes('token') || error.message?.includes('expired')) {
        throw new Error('Xero connection expired. Please reconnect to Xero.');
      }
      
      throw new Error(`Failed to sync invoices: ${errorMessage}`);
    }
  }

  // Create invoice in Xero
  static async createInvoice(invoiceData) {
    try {
      const xeroInvoice = {
        Type: 'ACCREC',
        Contact: {
          ContactID: invoiceData.xeroContactId
        },
        LineItems: [{
          Description: invoiceData.description,
          Quantity: 1,
          UnitAmount: invoiceData.amount,
          AccountCode: '200'
        }],
        Date: invoiceData.date,
        DueDate: invoiceData.dueDate,
        Reference: invoiceData.invoiceID,
        Status: 'DRAFT'
      };

      const response = await xero.accountingApi.createInvoices(
        xero.getTenantId(),
        { Invoices: [xeroInvoice] }
      );

      return response.body.Invoices[0];
    } catch (error) {
      throw error;
    }
  }

  // Sync invoice status from Xero
  static async syncInvoiceStatus(invoiceId) {
    try {
      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) throw new Error('Invoice not found');

      const xeroInvoice = await xero.accountingApi.getInvoice(
        xero.getTenantId(),
        invoice.xeroInvoiceId
      );

      // Update local invoice status based on Xero status
      invoice.status = xeroInvoice.body.Status === 'PAID' ? 'paid' : 'unpaid';
      await invoice.save();

      return invoice;
    } catch (error) {
      console.error('Error syncing invoice status:', error);
      throw error;
    }
  }

  // Get Xero contacts
  static async getContacts() {
    try {
      const tokenSet = await xero.readTokenSet();
      
      if (!tokenSet || !tokenSet.access_token) {
        throw new Error('Not connected to Xero. Please connect first.');
      }

      const tenantId = xero.getTenantId();
      
      if (!tenantId) {
        throw new Error('No Xero organization selected. Please connect to Xero first.');
      }

      const response = await xero.accountingApi.getContacts(tenantId);
      
      if (!response || !response.body || !response.body.Contacts) {
        throw new Error('Invalid response from Xero');
      }

      // Transform the contacts to a simpler format
      return response.body.Contacts.map(contact => ({
        id: contact.ContactID,
        name: contact.Name,
        email: contact.EmailAddress,
        phone: contact.Phones?.find(p => p.PhoneType === 'DEFAULT')?.PhoneNumber,
        status: contact.IsArchived ? 'archived' : 'active',
        type: contact.ContactStatus
      }));
    } catch (error) {
      if (error.statusCode === 401) {
        throw new Error('Xero connection expired. Please reconnect to Xero.');
      }
      throw error;
    }
  }
}

module.exports = XeroService; 