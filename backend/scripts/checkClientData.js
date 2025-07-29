const mongoose = require('mongoose');
require('dotenv').config();

const Invoice = require('../models/Invoice');

async function checkClientData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    console.log('=== CHECKING CLIENT DATA ACROSS ALL INVOICES ===');
    
    // Get all invoices
    const allInvoices = await Invoice.find({ isDeleted: { $ne: true } })
      .populate({
        path: 'project',
        select: 'name projectID',
        populate: {
          path: 'client',
          select: 'name'
        }
      })
      .populate({
        path: 'client',
        select: 'name'
      });
    
    console.log('Total active invoices:', allInvoices.length);
    
    // Analyze client data
    let invoicesWithXeroClientName = 0;
    let invoicesWithProjectClient = 0;
    let invoicesWithClientObject = 0;
    let invoicesWithNoClientData = 0;
    
    allInvoices.forEach((invoice, index) => {
      const hasXeroClientName = !!invoice.xeroClientName;
      const hasProjectClient = !!(invoice.project?.client?.name);
      const hasClientObject = !!(invoice.client?.name);
      
      if (hasXeroClientName) invoicesWithXeroClientName++;
      if (hasProjectClient) invoicesWithProjectClient++;
      if (hasClientObject) invoicesWithClientObject++;
      if (!hasXeroClientName && !hasProjectClient && !hasClientObject) invoicesWithNoClientData++;
      
      // Log first 10 invoices for debugging
      if (index < 10) {
        console.log(`Invoice ${index + 1}:`, {
          invoiceID: invoice.invoiceID,
          xeroClientName: invoice.xeroClientName,
          projectClientName: invoice.project?.client?.name,
          clientObjectName: invoice.client?.name,
          hasXeroClientName,
          hasProjectClient,
          hasClientObject
        });
      }
    });
    
    console.log('\n=== CLIENT DATA BREAKDOWN ===');
    console.log(`Invoices with xeroClientName: ${invoicesWithXeroClientName}`);
    console.log(`Invoices with project.client.name: ${invoicesWithProjectClient}`);
    console.log(`Invoices with client.name: ${invoicesWithClientObject}`);
    console.log(`Invoices with no client data: ${invoicesWithNoClientData}`);
    
    // Check if the issue is with Xero invoices vs non-Xero invoices
    const xeroInvoices = allInvoices.filter(inv => inv.xeroInvoiceId);
    const nonXeroInvoices = allInvoices.filter(inv => !inv.xeroInvoiceId);
    
    console.log('\n=== XERO VS NON-XERO BREAKDOWN ===');
    console.log(`Xero invoices: ${xeroInvoices.length}`);
    console.log(`Non-Xero invoices: ${nonXeroInvoices.length}`);
    
    const xeroWithClientName = xeroInvoices.filter(inv => inv.xeroClientName).length;
    const nonXeroWithClientName = nonXeroInvoices.filter(inv => inv.client?.name || inv.project?.client?.name).length;
    
    console.log(`Xero invoices with client name: ${xeroWithClientName}`);
    console.log(`Non-Xero invoices with client name: ${nonXeroWithClientName}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

checkClientData(); 