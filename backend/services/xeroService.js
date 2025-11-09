const xero = require('../config/xero');
const Invoice = require('../models/Invoice');

// Configuration for invoice sync filtering
const SYNC_CONFIG = {
  // Document types to include
  includeTypes: ['ACCREC'], // Only Accounts Receivable invoices (invoices you send to customers)
  
  // Statuses to include (awaiting approval and unpaid invoices from Xero)
  includeStatuses: ['SUBMITTED', 'AUTHORISED'], // Invoices awaiting approval and unpaid invoices
  
  // Statuses to exclude
  excludeStatuses: ['DRAFT', 'DELETED', 'VOIDED', 'PAID'], // Skip drafts, deleted, voided, and paid invoices
  
  // Keywords in reference field to exclude
  excludeReferenceKeywords: ['expense', 'claim', 'bill'],
  
  // Include draft invoices (set to false - we keep app-created drafts)
  includeDrafts: false,
  
  // Include deleted invoices (set to false)
  includeDeleted: false,
  
  // Include voided invoices (set to false)
  includeVoided: false,
  
  // Include paid invoices (set to false)
  includePaid: false
};

class XeroService {
  // Map Xero statuses to application statuses
  static mapXeroStatus(xeroStatus) {
    if (!xeroStatus || typeof xeroStatus !== 'string') {
      return 'unpaid';
    }

    const status = xeroStatus.toUpperCase();
    switch (status) {
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
  }

  // Normalize Xero date values to JavaScript Date objects
  static parseXeroDate(dateValue, fallbackDate = new Date()) {
    if (!dateValue) {
      return fallbackDate;
    }

    if (dateValue instanceof Date) {
      return dateValue;
    }

    if (typeof dateValue === 'number') {
      const dateFromNumber = new Date(dateValue);
      if (!Number.isNaN(dateFromNumber.getTime())) {
        return dateFromNumber;
      }
    }

    if (typeof dateValue === 'string') {
      const xeroMatch = dateValue.match(/\/Date\((\d+)([+-]\d{4})?\)\//);
      if (xeroMatch) {
        const timestamp = parseInt(xeroMatch[1], 10);
        const dateFromTimestamp = new Date(timestamp);
        if (!Number.isNaN(dateFromTimestamp.getTime())) {
          return dateFromTimestamp;
        }
      }

      const isoMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        const year = parseInt(isoMatch[1], 10);
        const month = parseInt(isoMatch[2], 10) - 1;
        const day = parseInt(isoMatch[3], 10);
        const isoDate = new Date(year, month, day);
        if (!Number.isNaN(isoDate.getTime())) {
          return isoDate;
        }
      }

      const parsedDate = new Date(dateValue);
      if (!Number.isNaN(parsedDate.getTime())) {
        return parsedDate;
      }

      const isoStringDate = new Date(`${dateValue}T00:00:00`);
      if (!Number.isNaN(isoStringDate.getTime())) {
        return isoStringDate;
      }

      const parts = dateValue.split('/');
      if (parts.length === 3) {
        const [first, second, third] = parts.map((value) => parseInt(value, 10));
        const ddmmyyyy = new Date(third, second - 1, first);
        if (!Number.isNaN(ddmmyyyy.getTime())) {
          return ddmmyyyy;
        }

        const mmddyyyy = new Date(third, first - 1, second);
        if (!Number.isNaN(mmddyyyy.getTime())) {
          return mmddyyyy;
        }
      }
    }

    return fallbackDate;
  }

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
      
      // Fetch awaiting approval and unpaid invoices from Xero
      // Use the statuses parameter to filter at the API level
      const statuses = ['SUBMITTED', 'AUTHORISED']; // Awaiting approval and unpaid invoices
      const tokenSet = await xero.readTokenSet();
      
      console.log('Fetching Xero invoices with statuses:', statuses);
      
      // Implement pagination to get all invoices
      let allInvoices = [];
      let page = 1;
      const pageSize = 100; // Xero's default page size
      let hasMorePages = true;
      let totalRetrieved = 0;
      
      while (hasMorePages) {
        const url = `https://api.xero.com/api.xro/2.0/Invoices?statuses=${statuses.join(',')}&page=${page}&pageSize=${pageSize}`;
        console.log(`Fetching page ${page} with ${pageSize} results per page...`);
        console.log(`Full URL: ${url}`);
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${tokenSet.access_token}`,
            'Xero-tenant-id': tenantId,
            'Accept': 'application/json'
          }
        });
        
        console.log(`Page ${page} API response status:`, response.status);
        console.log(`Page ${page} API response headers:`, Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API call failed:', errorText);
          throw new Error(`Xero API call failed: ${response.status} ${response.statusText}`);
        }
        
        const responseData = await response.json();
        
        if (!responseData || !responseData.Invoices) {
          console.error('Invalid response structure:', responseData);
          throw new Error('Invalid response from Xero API');
        }
        
        const pageInvoices = responseData.Invoices;
        console.log(`Page ${page} returned ${pageInvoices.length} invoices`);
        console.log(`Total retrieved so far: ${totalRetrieved + pageInvoices.length}`);
        
        // Log some additional debugging information
        console.log(`Response data keys:`, Object.keys(responseData));
        if (responseData.Pagination) {
          console.log(`Pagination info:`, responseData.Pagination);
        }
        if (responseData.Invoices && responseData.Invoices.length > 0) {
          console.log(`First invoice ID:`, responseData.Invoices[0].InvoiceID);
          console.log(`Last invoice ID:`, responseData.Invoices[responseData.Invoices.length - 1].InvoiceID);
        }
        
        allInvoices = allInvoices.concat(pageInvoices);
        totalRetrieved = allInvoices.length;
        
        // Check if there are more pages
        if (pageInvoices.length < pageSize) {
          hasMorePages = false;
          console.log(`Page ${page} returned fewer than ${pageSize} results, no more pages`);
        } else {
          page++;
          console.log(`Moving to page ${page}`);
          
          // Add a small delay to avoid rate limiting
          if (page > 1) {
            console.log('Adding delay to avoid rate limiting...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        // Safety check to prevent infinite loops
        if (page > 50) {
          console.warn('Reached maximum page limit (50), stopping pagination');
          hasMorePages = false;
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
          const result = await this.processAndSaveInvoice(invoice);
          processedCount++;
          processedInvoices.push(invoice.InvoiceNumber);
          if (processedCount % 10 === 0) {
            console.log(`Processed ${processedCount}/${validInvoices.length} invoices...`);
          }
        } catch (error) {
          errorCount++;
          console.error(`Error processing invoice ${invoice.InvoiceID}:`, error.message);
          console.error(`Full error:`, error);
        }
      }

      // After processing, refresh any local invoices that are no longer awaiting approval in Xero
      const syncedXeroInvoiceIds = [...new Set(validInvoices.map((invoice) => invoice.InvoiceID).filter(Boolean))];
      const invoicesNeedingRefresh = await Invoice.find({
        status: 'awaiting_approval',
        isDeleted: { $ne: true },
        xeroInvoiceId: { $exists: true, $ne: null, $nin: syncedXeroInvoiceIds }
      }).select('_id invoiceID xeroInvoiceId');

      if (invoicesNeedingRefresh.length > 0) {
        console.log(`Refreshing ${invoicesNeedingRefresh.length} invoices no longer awaiting approval in Xero...`);
        let refreshedCount = 0;

        for (const invoice of invoicesNeedingRefresh) {
          try {
            await this.syncInvoiceStatus(invoice._id);
            refreshedCount++;
          } catch (refreshError) {
            console.error(`Error refreshing invoice ${invoice.invoiceID}:`, refreshError.message);
          }
        }

        console.log(`Finished refreshing invoices. Updated ${refreshedCount}/${invoicesNeedingRefresh.length}.`);
      } else {
        console.log('No awaiting approval invoices required refresh after sync.');
      }
      
      console.log(`Invoice sync completed. Processed: ${processedCount}, Errors: ${errorCount}`);
      console.log('Successfully processed invoice numbers:', processedInvoices.sort());
      
      // Cleanup: Soft delete invoices that are no longer in Xero results
      console.log('=== CLEANUP PROCESS DISABLED ===');
      console.log(`Valid invoices from Xero: ${validInvoices.length}`);
      console.log('Cleanup process has been disabled to prevent accidental deletion of legitimate invoices');
      
      // const cleanupResult = await this.cleanupPaidInvoices(validInvoices);
      // console.log(`Cleanup completed: ${cleanupResult.softDeleted} invoices soft deleted`);
      
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
        Reference: invoiceData.xeroReference,
        InvoiceNumber: invoiceData.InvoiceNumber,
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

      const tokenSet = await xero.readTokenSet();
      const tenantId = await xero.getTenantId();
      
      if (!tokenSet || !tokenSet.access_token) {
        throw new Error('No valid access token available');
      }
      
      if (!tenantId) {
        throw new Error('No tenant ID available');
      }

      // Use direct fetch approach like sync FROM Xero
      const response = await fetch(`https://api.xero.com/api.xro/2.0/Invoices/${invoice.xeroInvoiceId}`, {
        headers: {
          'Authorization': `Bearer ${tokenSet.access_token}`,
          'Xero-tenant-id': tenantId,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API call failed:', errorText);
        throw new Error(`Xero API call failed: ${response.status} ${response.statusText}`);
      }
      
      const responseData = await response.json();
      const xeroInvoice = responseData?.Invoices?.[0] || responseData;
      
      if (!xeroInvoice || !xeroInvoice.Status) {
        throw new Error('Invalid invoice data returned from Xero');
      }

      const newStatus = this.mapXeroStatus(xeroInvoice.Status);
      let hasChanges = false;

      if (invoice.status !== newStatus) {
        invoice.status = newStatus;
        hasChanges = true;
      }

      if (invoice.xeroStatus !== xeroInvoice.Status) {
        invoice.xeroStatus = xeroInvoice.Status;
        hasChanges = true;
      }

      if (typeof xeroInvoice.Total === 'number' && invoice.amount !== xeroInvoice.Total) {
        invoice.amount = xeroInvoice.Total;
        hasChanges = true;
      }

      if (xeroInvoice.Date) {
        const parsedDate = this.parseXeroDate(xeroInvoice.Date, invoice.date);
        if (parsedDate && (!invoice.date || invoice.date.getTime() !== parsedDate.getTime())) {
          invoice.date = parsedDate;
          hasChanges = true;
        }
      }

      if (xeroInvoice.DueDate) {
        const parsedDueDate = this.parseXeroDate(xeroInvoice.DueDate, invoice.dueDate);
        if (parsedDueDate && (!invoice.dueDate || invoice.dueDate.getTime() !== parsedDueDate.getTime())) {
          invoice.dueDate = parsedDueDate;
          hasChanges = true;
        }
      }

      const lineItemDescription = xeroInvoice.LineItems?.[0]?.Description;
      if (lineItemDescription && invoice.description !== lineItemDescription) {
        invoice.description = lineItemDescription;
        hasChanges = true;
      }

      if (xeroInvoice.Reference && invoice.xeroReference !== xeroInvoice.Reference) {
        invoice.xeroReference = xeroInvoice.Reference;
        hasChanges = true;
      }

      if (xeroInvoice.Contact?.Name && invoice.xeroClientName !== xeroInvoice.Contact.Name) {
        invoice.xeroClientName = xeroInvoice.Contact.Name;
        hasChanges = true;
      }

      invoice.lastSynced = new Date();
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
      // EXCLUDE local draft, awaiting approval, and unpaid invoices to prevent accidental deletion
      const invoicesToCleanup = await Invoice.find({
        xeroInvoiceId: { $exists: true, $ne: null, $ne: '' },
        xeroInvoiceId: { $nin: currentXeroInvoiceIds },
        status: { $nin: ['draft', 'awaiting_approval', 'unpaid'] }, // Protect local draft, awaiting approval, and unpaid invoices
        isDeleted: { $ne: true } // Don't process already deleted invoices
      });
      
      console.log(`Found ${invoicesToCleanup.length} invoices to cleanup (excluding local draft and awaiting approval invoices)`);
      
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

      // Use direct fetch approach like sync FROM Xero
      const response = await fetch('https://api.xero.com/api.xro/2.0/Contacts', {
        headers: {
          'Authorization': `Bearer ${tokenSet.access_token}`,
          'Xero-tenant-id': tenantId,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API call failed:', errorText);
        throw new Error(`Xero API call failed: ${response.status} ${response.statusText}`);
      }
      
      const responseData = await response.json();
      
      if (!responseData || !responseData.Contacts) {
        throw new Error('Invalid response from Xero');
      }

      // Transform the contacts to a simpler format
      return responseData.Contacts.map(contact => ({
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

      // Helper function to parse Xero dates with fallback
      const parseXeroDate = (dateValue, fallbackDate = new Date()) => {
        console.log('Parsing date value:', dateValue, 'Type:', typeof dateValue);
        const parsedDate = this.parseXeroDate(dateValue, fallbackDate);
        if (!parsedDate || isNaN(parsedDate.getTime())) {
          console.warn('Could not parse date, using fallback:', dateValue);
          return fallbackDate;
        }
        if (parsedDate === fallbackDate && dateValue) {
          console.warn('Parsed date matched fallback value for:', dateValue);
        }
        return parsedDate;
      };

      // Check if invoice already exists in our database
      const existingInvoice = await Invoice.findOne({ xeroInvoiceId: xeroInvoice.InvoiceID });
      

      
      if (existingInvoice) {
        console.log('Found existing invoice:', existingInvoice.invoiceID);
        
        // Check if the invoice number has changed in Xero
        if (existingInvoice.invoiceID !== xeroInvoice.InvoiceNumber) {
          console.log('Invoice number changed in Xero:', {
            oldNumber: existingInvoice.invoiceID,
            newNumber: xeroInvoice.InvoiceNumber
          });
          
          // Hard delete the old invoice since the invoice number changed
          await Invoice.findByIdAndDelete(existingInvoice._id);
          console.log('Hard deleted old invoice with number:', existingInvoice.invoiceID);
          
          // Continue to create new invoice below (normal sync process will handle this)
        } else {
          console.log('Updating existing invoice:', existingInvoice.invoiceID);
          

        

        
        // Check for changes and update accordingly
        let hasChanges = false;
        
        // Check if invoice number changed
        if (existingInvoice.invoiceID !== xeroInvoice.InvoiceNumber) {
          console.log('Invoice number changed:', {
            old: existingInvoice.invoiceID,
            new: xeroInvoice.InvoiceNumber
          });
          existingInvoice.invoiceID = xeroInvoice.InvoiceNumber;
          hasChanges = true;
        }
        
        // Check if amount changed
        const newAmount = xeroInvoice.Total || 0;
        if (existingInvoice.amount !== newAmount) {
          console.log('Amount changed:', {
            old: existingInvoice.amount,
            new: newAmount
          });
          existingInvoice.amount = newAmount;
          hasChanges = true;
        }
        
        // Check if status changed
        const newStatus = this.mapXeroStatus(xeroInvoice.Status);
        if (existingInvoice.status !== newStatus) {
          console.log('Status changed:', {
            old: existingInvoice.status,
            new: newStatus
          });
          existingInvoice.status = newStatus;
          hasChanges = true;
        }
        
        // Always update other fields from Xero
        existingInvoice.date = xeroInvoice.Date ? parseXeroDate(xeroInvoice.Date) : existingInvoice.date;
        existingInvoice.dueDate = xeroInvoice.DueDate ? parseXeroDate(xeroInvoice.DueDate) : existingInvoice.dueDate;
        existingInvoice.description = xeroInvoice.LineItems?.[0]?.Description || existingInvoice.description;
        existingInvoice.xeroStatus = xeroInvoice.Status;
        existingInvoice.xeroReference = xeroInvoice.Reference || existingInvoice.xeroReference;
        existingInvoice.lastSynced = new Date();
        
        if (hasChanges) {
          console.log('Invoice updated with changes from Xero');
        } else {
          console.log('Invoice synced (no changes detected)');
        }
        
        // Update client name if we have contact data
        if (xeroClientName) {
          existingInvoice.xeroClientName = xeroClientName;
          console.log('Updated existing invoice client name to:', xeroClientName);
        }
        
        await existingInvoice.save();
        return existingInvoice;
        }
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
      
      // Generate a proper invoice ID
      let invoiceID = xeroInvoice.InvoiceNumber;
      if (!invoiceID || invoiceID === 'Expense Claims' || invoiceID === '') {
        // Use Xero Invoice ID if InvoiceNumber is not valid
        invoiceID = `XERO-${xeroInvoice.InvoiceID}`;
      }
      
      // Create new invoice
      const newInvoice = new Invoice({
        invoiceID: invoiceID,
        amount: xeroInvoice.Total || 0,
        status: this.mapXeroStatus(xeroInvoice.Status),
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