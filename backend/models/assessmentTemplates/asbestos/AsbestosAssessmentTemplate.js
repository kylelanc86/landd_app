const mongoose = require("mongoose");

const asbestosAssessmentTemplateSchema = new mongoose.Schema(
  {
    templateType: {
      type: String,
      default: "asbestosAssessment",
      required: true,
    },
    companyDetails: {
      name: {
        type: String,
        default: "Lancaster & Dickenson Consulting Pty Ltd",
      },
      address: {
        type: String,
        default: "4/6 Dacre Street, Mitchell ACT 2911",
      },
      email: {
        type: String,
        default: "enquiries@landd.com.au",
      },
      phone: {
        type: String,
        default: "(02) 6241 2779",
      },
      website: {
        type: String,
        default: "www.landd.com.au",
      },
      abn: {
        type: String,
        default: "74 169 785 915",
      },
    },
    reportHeaders: {
      title: {
        type: String,
        default: "ASBESTOS MATERIAL ASSESSMENT REPORT",
        required: true,
      },
      subtitle: {
        type: String,
        default: "Assessment Report",
      },
    },
    standardSections: {
      // Introduction Content
      introductionTitle: {
        type: String,
        default: "INTRODUCTION",
      },
      introductionContent: {
        type: String,
        default: "Following discussions with {CLIENT_NAME}, Lancaster and Dickenson Consulting (L & D) were contracted to undertake an asbestos assessment at {SITE_NAME}. {LAA_NAME} (Licenced Asbestos Assessor - {LAA_LICENSE}) from L & D subsequently visited the above location on {ASSESSMENT_DATE} to undertake the assessment.\n\nThis report covers the inspection and assessment of the following areas/materials only:\n{ASSESSMENT_SCOPE_BULLETS}",
      },
      
      // Survey Findings Content
      surveyFindingsTitle: {
        type: String,
        default: "SURVEY FINDINGS",
      },
      surveyFindingsContent: {
        type: String,
        default: "Table 1 below details the suspected ACM sampled as part of the assessment. Information is also included regarding materials which are presumed to contain asbestos and materials which the assessor visually assessed to be the consistent with a sampled material. Photographs of assessed materials are also presented in the sample register below.\n\nSample analysis was undertaken by L&D's National Association of Testing Authorities (NATA) accredited laboratory. The samples were analysed by Polarised Light Microscopy using dispersion staining techniques in accordance with AS 4964-2004.",
      },
      
      // Discussion and Conclusions Content
      discussionTitle: {
        type: String,
        default: "DISCUSSION AND CONCLUSIONS",
      },
      discussionContent: {
        type: String,
        default: "The following asbestos-containing materials were identified during the assessment:\n{IDENTIFIED_ASBESTOS_ITEMS}",
      },
      
      // Risk Assessment Content
      riskAssessmentTitle: {
        type: String,
        default: "RISK ASSESSMENT",
      },
      riskAssessmentContent: {
        type: String,
        default: "Identified ACM was risk assessed based on the following criteria:\n• the condition of the material at the time of the assessment;\n• the accessibility of the material;\n• the likelihood of the material being disturbed resulting in a release of asbestos fibre.\nEach ACM is categorised into one of four (4) risk categories:",
      },
      
      // Determining Suitable Control Measures Content
      controlMeasuresTitle: {
        type: String,
        default: "DETERMINING SUITABLE CONTROL MEASURES",
      },
      controlMeasuresContent: {
        type: String,
        default: "The Work Health and Safety (How to Manage and Control Asbestos in the Workplace Code of Practice) Approval 2022 requires that when choosing the most appropriate control measure for managing ACM or asbestos, the following hierarchy of controls must be considered:\n• eliminating the risk, for example: removing the asbestos (most preferred)\n• substituting for the risk, isolating the risk or applying engineering controls, for example: enclosing, encapsulation or sealing\n• using administrative controls, for example: labelling, safe work practices etc.\n• using PPE (least preferred)\nA combination of these controls may be required in order to adequately manage and control asbestos or ACM.",
      },
      
      // Requirements for Remediation/Removal Works Involving ACM Content
      remediationRequirementsTitle: {
        type: String,
        default: "REQUIREMENTS FOR REMEDIATION/REMOVAL WORKS INVOLVING ACM",
      },
      remediationRequirementsContent: {
        type: String,
        default: "Prior to Work Commencing\nPrior to the commencement of any works associated with asbestos, the licensed asbestos removalist is required to notify Worksafe ACT five (5) days prior to commencement of asbestos removal works. As part of the notification process the licensed removalist must supply an Asbestos Removal Control Plan (ARCP) and a Safe Work Method Statement (SWMS) outlining how the works are to be undertaken.\n\nAsbestos Removal Works\nFriable asbestos removal or remediation work must be undertaken by an ACT licensed Class A Asbestos Removalist. Air monitoring, which is mandatory during the removal or remediation of friable asbestos, must be undertaken in accordance with the Guidance Note on the Membrane Filter Method for Estimating Airborne Asbestos Fibres, 2nd Edition [NOHSC: 3003(2005)].\n\nNon-friable asbestos removal or remediation must be undertaken by a Class A or B Asbestos Removalist. Air monitoring is not mandatory for the removal of non-friable asbestos.\n\nAll asbestos removal must be undertaken as per the Work Health and Safety: How to Safely Remove Asbestos Code of Practice (2022) and in accordance with EPA (2011) Contaminated Sites Information Sheet No. 5 'Requirements for the Transport and Disposal of Asbestos Contaminated Wastes' and Information Sheet No.6 'Management of Small Scale, Low Risk Soil Asbestos Contamination'.\n\nFollowing Completion of Asbestos Removal Works\nOn completion of asbestos removal or remediation works an independent ACT licensed Asbestos Assessor must be employed to undertake a Clearance Inspection. A satisfactory clearance certificate for the remediated areas must include no visible suspect material and where applicable, clearance monitoring must also indicate that airborne fibre levels are satisfactory.",
      },
      
      // Legislation Content
      legislationTitle: {
        type: String,
        default: "LEGISLATION",
      },
      legislationContent: {
        type: String,
        default: "This report was written in general accordance with and with reference to:\n• ACT Work Health and Safety (WHS) Act 2011\n• ACT Work Health and Safety Regulation 2011\n• ACT Work Health and Safety (How to Safely Remove Asbestos Code of Practice) Approval 2022\n• ACT Work Health and Safety (How to Manage and Control Asbestos in the Workplace Code of Practice) Approval 2022",
      },
      
      // Assessment Limitations/Caveats Content
      assessmentLimitationsTitle: {
        type: String,
        default: "ASSESSMENT LIMITATIONS/CAVEATS",
      },
      assessmentLimitationsContent: {
        type: String,
        default: "This report covers the inspection and assessment of the location and materials outlined within this document only and is specific to the date the assessment was conducted. L&D did not inspect any areas of the property that fall outside of the locations listed in this report and therefore make no comment regarding the presence or condition of further ACM that may or may not be present.\n\nWhilst every effort has been made to identify all ACM within the inspected areas, the random nature in which asbestos was often installed can mean unidentified asbestos may be uncovered/identified. Should suspect ACM be identified or disturbed, works should cease until an assessment of the materials is completed.",
      },
      
      // Sign-off Content
      signOffContent: {
        type: String,
        default: "For and on behalf of Lancaster and Dickenson Consulting.\n\n{LAA_NAME} - Licensed Asbestos Assessor\n{LAA_LICENSE}\nLancaster & Dickenson Consulting Pty Ltd",
      },
      
      // Signature Content
      signaturePlaceholder: {
        type: String,
        default: "{SIGNATURE_IMAGE}",
      },
      
      // Footer Content
      footerText: {
        type: String,
        default: "Asbestos Assessment Report - {SITE_NAME}",
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("AsbestosAssessmentTemplate", asbestosAssessmentTemplateSchema); 