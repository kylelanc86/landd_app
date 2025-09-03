const mongoose = require('mongoose');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Import old models
const NonFriableClearance = require('../models/clearanceTemplates/asbestos/NonFriableClearance');
const FriableClearance = require('../models/clearanceTemplates/asbestos/FriableClearance');
const MixedClearance = require('../models/clearanceTemplates/asbestos/MixedClearance');
const LeadAssessment = require('../models/assessmentTemplates/lead/LeadAssessment');
const AsbestosAssessmentTemplate = require('../models/assessmentTemplates/asbestos/AsbestosAssessmentTemplate');

// Import new unified model
const ReportTemplate = require('../models/ReportTemplate');

const migrateToUnifiedReportTemplates = async () => {
  try {
    console.log('Starting migration to unified report templates...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/air_monitoring', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to database');
    
    // Clear existing reportTemplates collection
    await ReportTemplate.deleteMany({});
    console.log('Cleared existing reportTemplates collection');
    
    // Migrate Non-Friable Clearance templates
    console.log('Migrating Non-Friable Clearance templates...');
    const nonFriableTemplates = await NonFriableClearance.find({});
    for (const template of nonFriableTemplates) {
      const newTemplate = new ReportTemplate({
        templateType: 'asbestosClearanceNonFriable',
        companyDetails: template.companyDetails,
        reportHeaders: template.reportHeaders,
        standardSections: {
          ...template.standardSections,
          // Map any specific fields
          nonFriableClearanceCertificateLimitationsTitle: template.standardSections?.nonFriableClearanceCertificateLimitationsTitle,
          nonFriableClearanceCertificateLimitationsContent: template.standardSections?.nonFriableClearanceCertificateLimitationsContent,
        },
        createdBy: template.createdBy,
        updatedBy: template.updatedBy,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      });
      await newTemplate.save();
      console.log(`Migrated Non-Friable template: ${template._id}`);
    }
    
    // Migrate Friable Clearance templates
    console.log('Migrating Friable Clearance templates...');
    const friableTemplates = await FriableClearance.find({});
    for (const template of friableTemplates) {
      const newTemplate = new ReportTemplate({
        templateType: 'asbestosClearanceFriable',
        companyDetails: template.companyDetails,
        reportHeaders: template.reportHeaders,
        standardSections: {
          ...template.standardSections,
          // Map any specific fields
          friableClearanceCertificateLimitationsTitle: template.standardSections?.friableClearanceCertificateLimitationsTitle,
          friableClearanceCertificateLimitationsContent: template.standardSections?.friableClearanceCertificateLimitationsContent,
        },
        createdBy: template.createdBy,
        updatedBy: template.updatedBy,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      });
      await newTemplate.save();
      console.log(`Migrated Friable template: ${template._id}`);
    }
    
    // Migrate Mixed Clearance templates
    console.log('Migrating Mixed Clearance templates...');
    const mixedTemplates = await MixedClearance.find({});
    for (const template of mixedTemplates) {
      const newTemplate = new ReportTemplate({
        templateType: 'asbestosClearanceMixed',
        companyDetails: template.companyDetails,
        reportHeaders: template.reportHeaders,
        standardSections: {
          ...template.standardSections,
          // Map any specific fields
          mixedClearanceCertificateLimitationsTitle: template.standardSections?.mixedClearanceCertificateLimitationsTitle,
          mixedClearanceCertificateLimitationsContent: template.standardSections?.mixedClearanceCertificateLimitationsContent,
        },
        createdBy: template.createdBy,
        updatedBy: template.updatedBy,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      });
      await newTemplate.save();
      console.log(`Migrated Mixed template: ${template._id}`);
    }
    
    // Migrate Lead Assessment templates
    console.log('Migrating Lead Assessment templates...');
    const leadTemplates = await LeadAssessment.find({});
    for (const template of leadTemplates) {
      const newTemplate = new ReportTemplate({
        templateType: 'leadAssessment',
        companyDetails: template.companyDetails,
        reportHeaders: template.reportHeaders,
        standardSections: {
          // Map lead assessment specific sections
          executiveSummaryTitle: template.leadAssessmentSections?.executiveSummaryTitle,
          executiveSummaryContent: template.leadAssessmentSections?.executiveSummaryContent,
          siteDescriptionTitle: template.leadAssessmentSections?.siteDescriptionTitle,
          siteDescriptionContent: template.leadAssessmentSections?.siteDescriptionContent,
          assessmentMethodologyTitle: template.leadAssessmentSections?.assessmentMethodologyTitle,
          assessmentMethodologyContent: template.leadAssessmentSections?.assessmentMethodologyContent,
          samplingResultsTitle: template.leadAssessmentSections?.samplingResultsTitle,
          samplingResultsContent: template.leadAssessmentSections?.samplingResultsContent,
          riskAssessmentTitle: template.leadAssessmentSections?.riskAssessmentTitle,
          riskAssessmentContent: template.leadAssessmentSections?.riskAssessmentContent,
          recommendationsTitle: template.leadAssessmentSections?.recommendationsTitle,
          recommendationsContent: template.leadAssessmentSections?.recommendationsContent,
          conclusionTitle: template.leadAssessmentSections?.conclusionTitle,
          conclusionContent: template.leadAssessmentSections?.conclusionContent,
          footerText: template.leadAssessmentSections?.footerText,
        },
        createdBy: template.createdBy,
        updatedBy: template.updatedBy,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      });
      await newTemplate.save();
      console.log(`Migrated Lead Assessment template: ${template._id}`);
    }
    
    // Migrate Asbestos Assessment templates
    console.log('Migrating Asbestos Assessment templates...');
    const asbestosTemplates = await AsbestosAssessmentTemplate.find({});
    for (const template of asbestosTemplates) {
      const newTemplate = new ReportTemplate({
        templateType: 'asbestosAssessment',
        companyDetails: template.companyDetails,
        reportHeaders: template.reportHeaders,
        standardSections: {
          ...template.standardSections,
          // Map any specific fields that might be at root level
          introductionTitle: template.introductionTitle || template.standardSections?.introductionTitle,
          introductionContent: template.introductionContent || template.standardSections?.introductionContent,
          surveyFindingsTitle: template.surveyFindingsTitle || template.standardSections?.surveyFindingsTitle,
          surveyFindingsContent: template.surveyFindingsContent || template.standardSections?.surveyFindingsContent,
          discussionTitle: template.discussionTitle || template.standardSections?.discussionTitle,
          discussionContent: template.discussionContent || template.standardSections?.discussionContent,
          riskAssessmentTitle: template.riskAssessmentTitle || template.standardSections?.riskAssessmentTitle,
          riskAssessmentContent: template.riskAssessmentContent || template.standardSections?.riskAssessmentContent,
          controlMeasuresTitle: template.controlMeasuresTitle || template.standardSections?.controlMeasuresTitle,
          controlMeasuresContent: template.controlMeasuresContent || template.standardSections?.controlMeasuresContent,
          remediationRequirementsTitle: template.remediationRequirementsTitle || template.standardSections?.remediationRequirementsTitle,
          remediationRequirementsContent: template.remediationRequirementsContent || template.standardSections?.remediationRequirementsContent,
          legislationTitle: template.legislationTitle || template.standardSections?.legislationTitle,
          legislationContent: template.legislationContent || template.standardSections?.legislationContent,
          assessmentLimitationsTitle: template.assessmentLimitationsTitle || template.standardSections?.assessmentLimitationsTitle,
          assessmentLimitationsContent: template.assessmentLimitationsContent || template.standardSections?.assessmentLimitationsContent,
          signOffContent: template.signOffContent || template.standardSections?.signOffContent,
          signaturePlaceholder: template.signaturePlaceholder || template.standardSections?.signaturePlaceholder,
          footerText: template.footerText || template.standardSections?.footerText,
        },
        createdBy: template.createdBy,
        updatedBy: template.updatedBy,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      });
      await newTemplate.save();
      console.log(`Migrated Asbestos Assessment template: ${template._id}`);
    }
    
    // Verify migration
    const totalTemplates = await ReportTemplate.countDocuments();
    console.log(`Migration complete! Total templates in unified collection: ${totalTemplates}`);
    
    // List all migrated templates
    const allTemplates = await ReportTemplate.find({}).select('templateType createdAt');
    console.log('Migrated templates:');
    allTemplates.forEach(template => {
      console.log(`- ${template.templateType} (created: ${template.createdAt})`);
    });
    
    console.log('\nMigration successful! You can now update your services to use the new unified collection.');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run migration if called directly
if (require.main === module) {
  migrateToUnifiedReportTemplates()
    .then(() => {
      console.log('Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = migrateToUnifiedReportTemplates;
