const xero = require('../config/xero');
const Invoice = require('../models/Invoice');

// Configuration for invoice sync filtering
const SYNC_CONFIG = {
  // Document types to include
  includeTypes: ['ACCREC'], // Only Accounts Receivable invoices (invoices you send to customers)
  
  // Statuses to include (only these will be synced)
  includeStatuses: ['AUTHORISED', 'SUBMITTED'], // Invoices awaiting payment and awaiting approval
  
  // Statuses to exclude
  excludeStatuses: ['DRAFT', 'DELETED', 'VOIDED', 'PAID'], // Skip drafts, deleted, voided, and paid invoices
  
  // Keywords in reference field to exclude
  excludeReferenceKeywords: ['expense', 'claim', 'bill'],
  
  // Include draft invoices (set to true if you want drafts)
  includeDrafts: false,
  
  // Include deleted invoices (set to true if you want deleted)
  includeDeleted: false,
  
  // Include voided invoices (set to true if you want voided)
  includeVoided: false,
  
  // Include paid invoices (set to false - we only want unpaid)
  includePaid: false
};

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
      
      // Verify token is still valid before proceeding
      const currentTokenSet = await xero.readTokenSet();
      if (!currentTokenSet || !currentTokenSet.access_token) {
        throw new Error('Token validation failed - no access token available');
      }
      
      // Check if token is expired
      if (currentTokenSet.expires_at && currentTokenSet.expires_at < Date.now()) {
        console.log('Token is expired, attempting to refresh...');
        const refreshedTokenSet = await xero.readTokenSet(); // This will trigger refresh
        if (!refreshedTokenSet || !refreshedTokenSet.access_token) {
          throw new Error('Failed to refresh expired token');
        }
      }
      
      // Get the tenant ID
      const tenantId = await xero.getTenantId();
      if (!tenantId) {
        throw new Error('No tenant ID available');
      }
      console.log('Tenant ID retrieved:', tenantId);
      
      // Only fetch unpaid and awaiting approval invoices from Xero
      // Use the statuses parameter to filter at the API level
      const statuses = ['AUTHORISED', 'SUBMITTED']; // Only unpaid and awaiting approval
      const tokenSet = await xero.readTokenSet();
      
      console.log('Fetching Xero invoices with statuses:', statuses);
      
      // Implement pagination to get all invoices
      let allInvoices = [];
      let page = 1;
      const pageSize = 100; // Xero's default page size
      let hasMorePages = true;
      
      while (hasMorePages) {
        const url = `https://api.xero.com/api.xro/2.0/Invoices?statuses=${statuses.join(',')}&page=${page}&pageSize=${pageSize}`;
        console.log(`Fetching page ${page} with ${pageSize} results per page...`);
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${tokenSet.access_token}`,
            'Xero-tenant-id': tenantId,
            'Accept': 'application/json'
          }
        });
        
        console.log(`Page ${page} API response status:`, response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API call failed:', errorText);
          throw new Error(`Xero API call failed: ${response.status} ${response.statusText}`);
        }
        
        const responseData = await response.json();
        
        if (!responseData || !responseData.Invoices) {
          throw new Error('Invalid response from Xero API');
        }
        
        const pageInvoices = responseData.Invoices;
        console.log(`Page ${page} returned ${pageInvoices.length} invoices`);
        
        allInvoices = allInvoices.concat(pageInvoices);
        
        // Check if there are more pages
        if (pageInvoices.length < pageSize) {
          hasMorePages = false;
          console.log(`Page ${page} returned fewer than ${pageSize} results, no more pages`);
        } else {
          page++;
          console.log(`Moving to page ${page}`);
        }
      }
      
      console.log(`Total invoices retrieved from all pages: ${allInvoices.length}`);
      
      // Log a sample invoice to see the structure including Contact data
      if (allInvoices.length > 0) {
        const sampleInvoice = allInvoices[0];
        console.log('Sample invoice structure:', {
          id: sampleInvoice.InvoiceID,
          date: sampleInvoice.Date,
          dueDate: sampleInvoice.DueDate,
          contact: sampleInvoice.Contact,
          contactName: sampleInvoice.Contact?.Name,
          contactId: sampleInvoice.Contact?.ContactID,
          allFields: Object.keys(sampleInvoice)
        });
        console.log('Full sample invoice Contact object:', JSON.stringify(sampleInvoice.Contact, null, 2));
      }
      
      // Check for invoices without Contact data
      const invoicesWithoutContact = allInvoices.filter(invoice => !invoice.Contact);
      const invoicesWithContact = allInvoices.filter(invoice => invoice.Contact);
      
      console.log(`\nInvoices WITH Contact data: ${invoicesWithContact.length}`);
      console.log(`Invoices WITHOUT Contact data: ${invoicesWithoutContact.length}`);
      
      if (invoicesWithoutContact.length > 0) {
        console.log('\nSample invoices WITHOUT Contact data:');
        invoicesWithoutContact.slice(0, 5).forEach(invoice => {
          console.log(`  - ${invoice.InvoiceNumber || 'NO_NUMBER'}: ${invoice.Status} (${invoice.Type})`);
        });
      }
      
      const invoices = allInvoices;
      console.log(`Retrieved ${invoices.length} invoices from Xero (all pages)`);
      
      // Log all invoice numbers and statuses for debugging
      console.log('All Xero invoices:');
      invoices.forEach(invoice => {
        console.log(`- ${invoice.InvoiceNumber || 'NO_NUMBER'}: ${invoice.Status} (${invoice.Type})`);
      });
      
      // Filter out non-invoice records and process valid invoices
      console.log('=== STARTING FILTERING PROCESS ===');
      const validInvoices = invoices.filter(invoice => {
        console.log('Evaluating document:', {
          id: invoice.InvoiceID,
          type: invoice.Type,
          status: invoice.Status,
          number: invoice.InvoiceNumber,
          reference: invoice.Reference
        });

        // Only include specified document types (ACCREC = invoices you send to customers)
        if (!SYNC_CONFIG.includeTypes.includes(invoice.Type)) {
          console.log('Skipping document type:', invoice.Type, invoice.InvoiceNumber);
          return false;
        }
        
        // Skip records with invalid invoice numbers
        if (!invoice.InvoiceNumber || invoice.InvoiceNumber === 'Expense Claims' || invoice.InvoiceNumber === '') {
          console.log('Skipping invoice with invalid number:', invoice.InvoiceNumber);
          return false;
        }

        // Only include specified statuses (AUTHORISED = awaiting payment)
        if (!SYNC_CONFIG.includeStatuses.includes(invoice.Status)) {
          console.log('Skipping status not in include list:', invoice.Status, invoice.InvoiceNumber);
          return false;
        }

        // Skip documents with excluded keywords in reference
        if (invoice.Reference) {
          const referenceLower = invoice.Reference.toLowerCase();
          const hasExcludedKeyword = SYNC_CONFIG.excludeReferenceKeywords.some(keyword => 
            referenceLower.includes(keyword)
          );
          
          if (hasExcludedKeyword) {
            console.log('Skipping document with excluded keyword in reference:', invoice.Reference);
            return false;
          }
        }

        console.log('✅ Including invoice:', invoice.InvoiceNumber, 'Status:', invoice.Status);
        return true;
      });
      
      console.log(`Processing ${validInvoices.length} valid invoices out of ${invoices.length} total records`);
      console.log('Sync configuration:', {
        includeTypes: SYNC_CONFIG.includeTypes,
        includeStatuses: SYNC_CONFIG.includeStatuses,
        excludeStatuses: SYNC_CONFIG.excludeStatuses,
        excludeKeywords: SYNC_CONFIG.excludeReferenceKeywords,
        includeDrafts: SYNC_CONFIG.includeDrafts,
        includeDeleted: SYNC_CONFIG.includeDeleted,
        includeVoided: SYNC_CONFIG.includeVoided,
        includePaid: SYNC_CONFIG.includePaid
      });
      
      // Process and save invoices
      console.log(`Starting to process ${validInvoices.length} valid invoices...`);
      let processedCount = 0;
      let errorCount = 0;
      const processedInvoices = [];
      
      for (const invoice of validInvoices) {
        try {
          console.log(`\n--- Processing invoice ${processedCount + 1}/${validInvoices.length} ---`);
          await this.processAndSaveInvoice(invoice);
          processedCount++;
          processedInvoices.push(invoice.InvoiceNumber);
          if (processedCount % 10 === 0) {
            console.log(`Processed ${processedCount}/${validInvoices.length} invoices...`);
          }
        } catch (error) {
          errorCount++;
          console.error(`Error processing invoice ${invoice.InvoiceID}:`, error.message);
        }
      }
      
      console.log(`Invoice sync completed. Processed: ${processedCount}, Errors: ${errorCount}`);
      console.log('Successfully processed invoice numbers:', processedInvoices.sort());
      
      // Cleanup: Soft delete invoices that are no longer in Xero results
      console.log('=== STARTING CLEANUP PROCESS ===');
      console.log(`Valid invoices from Xero: ${validInvoices.length}`);
      
      const cleanupResult = await this.cleanupPaidInvoices(validInvoices);
      console.log(`Cleanup completed: ${cleanupResult.softDeleted} invoices soft deleted`);
      
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
        await xero.getTenantId(),
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
        await xero.getTenantId(),
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

  // Cleanup paid invoices that are no longer in Xero results
  static async cleanupPaidInvoices(currentXeroInvoices) {
    try {
      console.log('Starting cleanup of paid invoices...');
      
      // Get all Xero invoice IDs from current sync results
      const currentXeroInvoiceIds = currentXeroInvoices.map(invoice => invoice.InvoiceID);
      console.log(`Current Xero invoices: ${currentXeroInvoiceIds.length}`);
      
      // Find invoices in our database that have Xero IDs but are not in current results
      // Only clean up invoices that actually have Xero IDs (i.e., were synced from Xero)
      const invoicesToCleanup = await Invoice.find({
        xeroInvoiceId: { $exists: true, $ne: null, $ne: '' },
        xeroInvoiceId: { $nin: currentXeroInvoiceIds },
        isDeleted: { $ne: true } // Don't process already deleted invoices
      });
      
      console.log(`Found ${invoicesToCleanup.length} invoices to cleanup`);
      
      let softDeletedCount = 0;
      
      for (const invoice of invoicesToCleanup) {
        try {
          // Mark as soft deleted
          invoice.isDeleted = true;
          invoice.deleteReason = 'Invoice no longer in Xero unpaid results (likely marked as paid)';
          invoice.deletedAt = new Date();
          await invoice.save();
          
          softDeletedCount++;
          console.log(`Soft deleted invoice: ${invoice.invoiceID} (Xero ID: ${invoice.xeroInvoiceId})`);
        } catch (error) {
          console.error(`Error soft deleting invoice ${invoice.invoiceID}:`, error.message);
        }
      }
      
      console.log(`Cleanup completed: ${softDeletedCount} invoices soft deleted`);
      
      return {
        totalFound: invoicesToCleanup.length,
        softDeleted: softDeletedCount
      };
    } catch (error) {
      console.error('Error during cleanup:', error);
      return {
        totalFound: 0,
        softDeleted: 0,
        error: error.message
      };
    }
  }

  // Get Xero contacts
  static async getContacts() {
    try {
      const tokenSet = await xero.readTokenSet();
      
      if (!tokenSet || !tokenSet.access_token) {
        throw new Error('Not connected to Xero. Please connect first.');
      }

      const tenantId = await xero.getTenantId();
      
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
        status: xeroInvoice.Status,
        date: xeroInvoice.Date,
        dueDate: xeroInvoice.DueDate,
        total: xeroInvoice.Total,
        type: xeroInvoice.Type,
        reference: xeroInvoice.Reference,
        hasContact: !!xeroInvoice.Contact,
        contactName: xeroInvoice.Contact?.Name || 'NO_NAME',
        contactId: xeroInvoice.Contact?.ContactID || 'NO_ID'
      });

      // Get client name directly from Xero invoice contact data
      const xeroClientName = xeroInvoice.Contact?.Name || null;
      if (xeroClientName) {
        console.log('Found Xero client name:', xeroClientName, 'ID:', xeroInvoice.Contact?.ContactID);
      } else {
        console.log('No client name found in invoice:', xeroInvoice.InvoiceID);
      }

      // Check if invoice already exists in our database
      const existingInvoice = await Invoice.findOne({ xeroInvoiceId: xeroInvoice.InvoiceID });
      
      if (existingInvoice) {
        console.log('Updating existing invoice:', existingInvoice.invoiceID);
        // Helper function to parse Xero dates with fallback
        const parseXeroDate = (dateValue, fallbackDate = new Date()) => {
          if (!dateValue) {
            console.log('No date value provided, using fallback');
            return fallbackDate;
          }
          
          console.log('Parsing date value:', dateValue, 'Type:', typeof dateValue);
          
          // If it's already a Date object, return it
          if (dateValue instanceof Date) {
            console.log('Date is already a Date object');
            return dateValue;
          }
          
          // If it's a string, try to parse it
          if (typeof dateValue === 'string') {
            // 1. Try parsing Xero's /Date(1234567890000+0000)/ format
            const xeroDateMatch = dateValue.match(/\/Date\((\d+)([+-]\d{4})?\)\//);
            if (xeroDateMatch) {
              const timestamp = parseInt(xeroDateMatch[1]);
              const dateObj = new Date(timestamp);
              if (!isNaN(dateObj.getTime())) {
                console.log('Successfully parsed Xero date format:', dateObj);
                return dateObj;
              }
            }
            
            // 2. Try parsing ISO date format (2024-01-15T00:00:00)
            const isoDateMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (isoDateMatch) {
              const year = parseInt(isoDateMatch[1]);
              const month = parseInt(isoDateMatch[2]) - 1; // Month is 0-indexed
              const day = parseInt(isoDateMatch[3]);
              const dateObj = new Date(year, month, day);
              if (!isNaN(dateObj.getTime())) {
                console.log('Successfully parsed ISO date format:', dateObj);
                return dateObj;
              }
            }
            
            // 3. Try standard Date parsing
            const parsed = new Date(dateValue);
            if (!isNaN(parsed.getTime())) {
              console.log('Successfully parsed date:', parsed);
              return parsed;
            }
            
            // 4. Try parsing as ISO string without timezone
            const isoParsed = new Date(dateValue + 'T00:00:00');
            if (!isNaN(isoParsed.getTime())) {
              console.log('Successfully parsed ISO date:', isoParsed);
              return isoParsed;
            }
            
            // 5. Try parsing as DD/MM/YYYY format
            const dateParts = dateValue.split('/');
            if (dateParts.length === 3) {
              const day = parseInt(dateParts[0]);
              const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed
              const year = parseInt(dateParts[2]);
              const dateObj = new Date(year, month, day);
              if (!isNaN(dateObj.getTime())) {
                console.log('Successfully parsed DD/MM/YYYY date:', dateObj);
                return dateObj;
              }
            }
            
            // 6. Try parsing as MM/DD/YYYY format
            if (dateParts.length === 3) {
              const month = parseInt(dateParts[0]) - 1; // Month is 0-indexed
              const day = parseInt(dateParts[1]);
              const year = parseInt(dateParts[2]);
              const dateObj = new Date(year, month, day);
              if (!isNaN(dateObj.getTime())) {
                console.log('Successfully parsed MM/DD/YYYY date:', dateObj);
                return dateObj;
              }
            }
          }
          
          console.warn('Could not parse date, using fallback:', dateValue);
          return fallbackDate;
        };
        
        // Helper function to map Xero status to our status
        const mapXeroStatus = (xeroStatus) => {
          console.log('Mapping Xero status:', xeroStatus);
          switch (xeroStatus?.toUpperCase()) {
            case 'PAID':
              return 'paid';
            case 'AUTHORISED':
              return 'unpaid';
            case 'SUBMITTED':
              return 'awaiting_approval';
            case 'DRAFT':
              return 'draft';
            case 'VOIDED':
            case 'DELETED':
            default:
              return 'unpaid';
          }
        };
        
        // Update existing invoice - overwrite with Xero data
        existingInvoice.amount = xeroInvoice.Total || 0;
        existingInvoice.status = mapXeroStatus(xeroInvoice.Status);
        existingInvoice.date = xeroInvoice.Date ? parseXeroDate(xeroInvoice.Date) : existingInvoice.date;
        existingInvoice.dueDate = xeroInvoice.DueDate ? parseXeroDate(xeroInvoice.DueDate) : existingInvoice.dueDate;
        existingInvoice.description = xeroInvoice.LineItems?.[0]?.Description || existingInvoice.description;
        existingInvoice.xeroStatus = xeroInvoice.Status;
        existingInvoice.xeroReference = xeroInvoice.Reference || existingInvoice.xeroReference;
        existingInvoice.lastSynced = new Date();
        
        // Update client name if we have contact data
        if (xeroClientName) {
          existingInvoice.xeroClientName = xeroClientName;
          console.log('Updated existing invoice client name to:', xeroClientName);
        }
        
        await existingInvoice.save();
        return existingInvoice;
      }

      // For new invoices, we need to handle required fields
      if (!xeroInvoice.Date || !xeroInvoice.DueDate) {
        console.warn('Missing date fields in Xero invoice, using defaults:', xeroInvoice.InvoiceID);
        // Don't throw error, we'll use default dates
      }
      
      // Log the date values to debug
      console.log('Invoice dates:', {
        id: xeroInvoice.InvoiceID,
        date: xeroInvoice.Date,
        dueDate: xeroInvoice.DueDate,
        dateType: typeof xeroInvoice.Date,
        dueDateType: typeof xeroInvoice.DueDate,
        rawDate: JSON.stringify(xeroInvoice.Date),
        rawDueDate: JSON.stringify(xeroInvoice.DueDate)
      });

      // Client logic moved to beginning of function

      // Use the same parseXeroDate function defined earlier
      const parseXeroDate = (dateValue, fallbackDate = new Date()) => {
        if (!dateValue) {
          console.log('No date value provided, using fallback');
          return fallbackDate;
        }
        
        console.log('Parsing date value:', dateValue, 'Type:', typeof dateValue);
        
        // If it's already a Date object, return it
        if (dateValue instanceof Date) {
          console.log('Date is already a Date object');
          return dateValue;
        }
        
        // If it's a string, try to parse it
        if (typeof dateValue === 'string') {
          // 1. Try parsing Xero's /Date(1234567890000+0000)/ format
          const xeroDateMatch = dateValue.match(/\/Date\((\d+)([+-]\d{4})?\)\//);
          if (xeroDateMatch) {
            const timestamp = parseInt(xeroDateMatch[1]);
            const dateObj = new Date(timestamp);
            if (!isNaN(dateObj.getTime())) {
              console.log('Successfully parsed Xero date format:', dateObj);
              return dateObj;
            }
          }
          
          // 2. Try parsing ISO date format (2024-01-15T00:00:00)
          const isoDateMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (isoDateMatch) {
            const year = parseInt(isoDateMatch[1]);
            const month = parseInt(isoDateMatch[2]) - 1; // Month is 0-indexed
            const day = parseInt(isoDateMatch[3]);
            const dateObj = new Date(year, month, day);
            if (!isNaN(dateObj.getTime())) {
              console.log('Successfully parsed ISO date format:', dateObj);
              return dateObj;
            }
          }
          
          // 3. Try standard Date parsing
          const parsed = new Date(dateValue);
          if (!isNaN(parsed.getTime())) {
            console.log('Successfully parsed date:', parsed);
            return parsed;
          }
          
          // 4. Try parsing as ISO string without timezone
          const isoParsed = new Date(dateValue + 'T00:00:00');
          if (!isNaN(isoParsed.getTime())) {
            console.log('Successfully parsed ISO date:', isoParsed);
            return isoParsed;
          }
          
          // 5. Try parsing as DD/MM/YYYY format
          const dateParts = dateValue.split('/');
          if (dateParts.length === 3) {
            const day = parseInt(dateParts[0]);
            const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed
            const year = parseInt(dateParts[2]);
            const dateObj = new Date(year, month, day);
            if (!isNaN(dateObj.getTime())) {
              console.log('Successfully parsed DD/MM/YYYY date:', dateObj);
              return dateObj;
            }
          }
          
          // 6. Try parsing as MM/DD/YYYY format
          if (dateParts.length === 3) {
            const month = parseInt(dateParts[0]) - 1; // Month is 0-indexed
            const day = parseInt(dateParts[1]);
            const year = parseInt(dateParts[2]);
            const dateObj = new Date(year, month, day);
            if (!isNaN(dateObj.getTime())) {
              console.log('Successfully parsed MM/DD/YYYY date:', dateObj);
              return dateObj;
            }
          }
        }
        
        console.warn('Could not parse date, using fallback:', dateValue);
        return fallbackDate;
      };
      
      // Generate a proper invoice ID
      let invoiceID = xeroInvoice.InvoiceNumber;
      if (!invoiceID || invoiceID === 'Expense Claims' || invoiceID === '') {
        // Use Xero Invoice ID if InvoiceNumber is not valid
        invoiceID = `XERO-${xeroInvoice.InvoiceID}`;
      }
      
      // Helper function to map Xero status to our status
      const mapXeroStatus = (xeroStatus) => {
        console.log('Mapping Xero status:', xeroStatus);
        switch (xeroStatus?.toUpperCase()) {
          case 'PAID':
            return 'paid';
          case 'AUTHORISED':
            return 'unpaid';
          case 'SUBMITTED':
            return 'awaiting_approval';
          case 'DRAFT':
            return 'draft';
          case 'VOIDED':
          case 'DELETED':
          default:
            return 'unpaid';
        }
      };
      
      // Create new invoice
      const newInvoice = new Invoice({
        invoiceID: invoiceID,
        amount: xeroInvoice.Total || 0,
        status: mapXeroStatus(xeroInvoice.Status),
        date: parseXeroDate(xeroInvoice.Date),
        dueDate: parseXeroDate(xeroInvoice.DueDate),
        description: xeroInvoice.LineItems?.[0]?.Description || '',
        xeroInvoiceId: xeroInvoice.InvoiceID,
        xeroContactId: xeroInvoice.Contact?.ContactID,
        xeroClientName: xeroClientName, // Store client name from Xero
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