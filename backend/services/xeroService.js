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
      
      // Check if Xero client is properly initialized
      if (!xero.isInitialized()) {
        console.log('Xero client not initialized, attempting to initialize...');
        const tokenSet = await xero.readTokenSet();
        if (!tokenSet || !tokenSet.access_token) {
          throw new Error('No valid token set available');
        }
        await xero.setTokenSet(tokenSet);
        
        if (!xero.isInitialized()) {
          throw new Error('Failed to initialize Xero client');
        }
      }
      
      // Get the tenant ID
      const tenantId = await xero.getTenantId();
      if (!tenantId) {
        throw new Error('No tenant ID available');
      }
      console.log('Tenant ID retrieved:', tenantId);
      
      // Get invoices from Xero using the accounting API
      console.log('Getting invoices from Xero...');
      
      // Use the Xero client's built-in methods
      const response = await xero.accountingApi.getInvoices(
        tenantId,
        undefined,
        'Type=="ACCREC"'
      );
      
      if (!response || !response.body || !response.body.invoices) {
        throw new Error('Invalid response from Xero API');
      }
      
      const invoices = response.body.invoices;
      console.log(`Retrieved ${invoices.length} invoices from Xero`);
      
      // Process and save invoices
      for (const invoice of invoices) {
        await this.processAndSaveInvoice(invoice);
      }
      
      return invoices;
    } catch (error) {
      console.error('Error syncing invoices from Xero:', error);
      if (error.response) {
        console.error('Detailed error information:', {
          errorMessage: error.response.body?.Detail || 'Unknown error occurred',
          errorDetails: error.response.body?.Message || 'No additional details available',
          headers: error.response.headers,
          request: error.response.request,
          requestHeaders: error.response.request?.headers // Log request headers
        });
      }
      throw new Error(`Failed to sync invoices: ${error.message}`);
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

  // Process and save a single invoice from Xero
  static async processAndSaveInvoice(xeroInvoice) {
    try {
      console.log('Processing Xero invoice:', {
        id: xeroInvoice.InvoiceID,
        number: xeroInvoice.InvoiceNumber,
        status: xeroInvoice.Status
      });

      // Check if invoice already exists in our database
      const existingInvoice = await Invoice.findOne({ xeroInvoiceId: xeroInvoice.InvoiceID });
      
      if (existingInvoice) {
        console.log('Updating existing invoice:', existingInvoice.invoiceID);
        // Update existing invoice
        existingInvoice.amount = xeroInvoice.Total || 0;
        existingInvoice.status = xeroInvoice.Status === 'PAID' ? 'paid' : 'unpaid';
        existingInvoice.date = xeroInvoice.Date ? new Date(xeroInvoice.Date) : existingInvoice.date;
        existingInvoice.dueDate = xeroInvoice.DueDate ? new Date(xeroInvoice.DueDate) : existingInvoice.dueDate;
        existingInvoice.description = xeroInvoice.LineItems?.[0]?.Description || existingInvoice.description;
        existingInvoice.xeroStatus = xeroInvoice.Status;
        existingInvoice.xeroReference = xeroInvoice.Reference || existingInvoice.xeroReference;
        existingInvoice.lastSynced = new Date();
        await existingInvoice.save();
        return existingInvoice;
      }

      // For new invoices, we need to handle required fields
      if (!xeroInvoice.Date || !xeroInvoice.DueDate) {
        console.error('Missing required date fields in Xero invoice:', xeroInvoice.InvoiceID);
        throw new Error('Missing required date fields in Xero invoice');
      }

      // Find or create client based on Xero contact
      let clientId = null;
      if (xeroInvoice.Contact?.ContactID) {
        try {
          // Get contact details from Xero
          const contact = await xero.accountingApi.getContact(
            await xero.getTenantId(),
            xeroInvoice.Contact.ContactID
          );
          
          if (contact?.body?.Contacts?.[0]) {
            const xeroContact = contact.body.Contacts[0];
            // Find client by name or create new one
            const Client = require('../models/Client');
            let client = await Client.findOne({ name: xeroContact.Name });
            
            if (!client) {
              client = await Client.create({
                name: xeroContact.Name,
                email: xeroContact.EmailAddress,
                phone: xeroContact.Phones?.find(p => p.PhoneType === 'DEFAULT')?.PhoneNumber,
                xeroContactId: xeroContact.ContactID
              });
            }
            clientId = client._id;
          }
        } catch (error) {
          console.error('Error finding/creating client:', error);
        }
      }

      // Create new invoice
      const newInvoice = new Invoice({
        invoiceID: xeroInvoice.InvoiceNumber || `XERO-${xeroInvoice.InvoiceID}`,
        client: clientId, // Set client if found/created
        amount: xeroInvoice.Total || 0,
        status: xeroInvoice.Status === 'PAID' ? 'paid' : 'unpaid',
        date: new Date(xeroInvoice.Date),
        dueDate: new Date(xeroInvoice.DueDate),
        description: xeroInvoice.LineItems?.[0]?.Description || '',
        xeroInvoiceId: xeroInvoice.InvoiceID,
        xeroContactId: xeroInvoice.Contact?.ContactID,
        xeroReference: xeroInvoice.Reference, // Store Xero's reference field
        xeroStatus: xeroInvoice.Status,
        lastSynced: new Date()
      });

      await newInvoice.save();
      console.log('Saved new invoice:', newInvoice.invoiceID);
      return newInvoice;
    } catch (error) {
      console.error('Error processing invoice:', error);
      throw error;
    }
  }
}

module.exports = XeroService; 