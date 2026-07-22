/* Centre Point Amravati interview panel, transcribed from CPA_Job_Catalogue.xlsx.

   The sheet is keyed by JOB CODE with a Panel 1 / Panel 2 / Panel 3 column. A cell
   holding "A/B/C" means any of those people may take that panel — the first becomes
   the rule's interviewer and the rest its alternates, which is how the HR dropdown
   ends up offering two names for Panel 1 and three for Panel 2.

   Names are exactly as HR wrote them; NAME_ALIASES below maps the ones that do not
   match an account's stored name. Import with `npm run import-panel`, which resolves
   every name against the LIVE user directory rather than against this file, so an
   account HR created through the Interviewers page is picked up automatically. */

export const CPA_PANEL_SHEET = [
  { job_code: 'CPA-LDR-A1', designation: 'General Manager', department: 'Leadership', grade: 'A1', panels: [['Parag Sir'], ['Arjun Sir', 'Angadh sir', 'Amit Sir'], ['Parag Sir']] },
  { job_code: 'CPA-ADM-A3', designation: 'Admin Head', department: 'Admin', grade: 'A3', panels: [['Parag Sir'], ['Amit Sir', 'Ashish Sir', 'Amit Chakrborty', 'Sunil Jinger', 'Ravi Sharma'], ['Parag Sir']] },
  { job_code: 'CPA-KIT-A3', designation: 'Executive Chef', department: 'Kitchen', grade: 'A3', panels: [['Parag Sir'], ['Arjun Sir', 'Angadh sir', 'Amit Sir'], ['Parag Sir']] },
  { job_code: 'CPA-OPS-A3', designation: 'Operations Manager', department: 'Operations', grade: 'A3', panels: [['Parag Sir'], ['Amit Sir', 'Ashish Sir', 'Amit Chakrborty', 'Sunil Jinger', 'Ravi Sharma'], ['Parag Sir']] },
  { job_code: 'CPA-ADM-B1', designation: 'Admin Executive', department: 'Admin', grade: 'B1', panels: [['Ashish Gudankwar', 'Rajkumar Gudankwar'], ['Amit Sir', 'Ashish Sir', 'Amit Chakrborty', 'Sunil Jinger', 'Ravi Sharma'], ['Ashish Gudankwar', 'Rajkumar Gudankwar']] },
  { job_code: 'CPA-KIT-B1', designation: 'Chef de Partie', department: 'Kitchen', grade: 'B1', panels: [['Ashish Gudankwar', 'Rajkumar Gudankwar'], ['Debraj Das', 'Ganesh Pagare', 'Shankar Tajne'], ['Ashish Gudankwar', 'Rajkumar Gudankwar']] },
  { job_code: 'CPA-ENG-B1', designation: 'Engineering Executive', department: 'Engineering', grade: 'B1', panels: [['Ashish Gudankwar', 'Rajkumar Gudankwar'], ['Ritesh Nirmalkar', 'Sunil Jinger', 'Ravi Sharma'], ['Ashish Gudankwar', 'Rajkumar Gudankwar']] },
  { job_code: 'CPA-FB-B1', designation: 'F&B Executive', department: 'F&B Service', grade: 'B1', panels: [['Ashish Gudankwar', 'Rajkumar Gudankwar'], ['Veer Rathore', 'Irfan Shiekh', 'Abhishek Meshram'], ['Ashish Gudankwar', 'Rajkumar Gudankwar']] },
  { job_code: 'CPA-FO-B1', designation: 'Front Office Executive', department: 'Front Office', grade: 'B1', panels: [['Ashish Gudankwar', 'Rajkumar Gudankwar'], ['Aniruddha Pimple', 'Sunil Jinger', 'Ravi Sharma'], ['Ashish Gudankwar', 'Rajkumar Gudankwar']] },
  { job_code: 'CPA-HK-B1', designation: 'Housekeeping Executive', department: 'Housekeeping', grade: 'B1', panels: [['Ashish Gudankwar', 'Rajkumar Gudankwar'], ['Dharmendra Singh', 'Chaten Zoting', 'Ravi Sharma'], ['Ashish Gudankwar', 'Rajkumar Gudankwar']] },
  { job_code: 'CPA-SEC-B1', designation: 'Security Executive', department: 'Security', grade: 'B1', panels: [['Ashish Gudankwar', 'Rajkumar Gudankwar'], ['Shivesh Mishra', 'Prashant Raut'], ['Ashish Gudankwar', 'Rajkumar Gudankwar']] },
  { job_code: 'CPA-KIT-B2', designation: 'Demi Chef de Partie', department: 'Kitchen', grade: 'B2', panels: [['Ashish Gudankwar', 'Rajkumar Gudankwar'], ['Debraj Das', 'Ganesh Pagare', 'Shankar Tajne'], ['Ashish Gudankwar', 'Rajkumar Gudankwar']] },
  { job_code: 'CPA-HK-B2', designation: 'Housekeeping Supervisor', department: 'Housekeeping', grade: 'B2', panels: [['Ashish Gudankwar', 'Rajkumar Gudankwar'], ['Dharmendra Singh', 'Chaten Zoting', 'Ravi Sharma'], ['Ashish Gudankwar', 'Rajkumar Gudankwar']] },
  { job_code: 'CPA-KST-B2', designation: 'Kitchen Stewarding Supervisor', department: 'Kitchen Stewarding', grade: 'B2', panels: [['Ashish Gudankwar', 'Rajkumar Gudankwar'], ['Debraj Das', 'Shankar Tajne', 'Chagan Nibrate'], ['Ashish Gudankwar', 'Rajkumar Gudankwar']] },
  { job_code: 'CPA-FB-B2', designation: 'Team Leader � F&B', department: 'F&B Service', grade: 'B2', panels: [['Ashish Gudankwar', 'Rajkumar Gudankwar'], ['Veer Rathore', 'Irfan Shiekh', 'Abhishek Meshram'], ['Ashish Gudankwar', 'Rajkumar Gudankwar']] },
  { job_code: 'CPA-ENG-C1', designation: 'Engineering Associate', department: 'Engineering', grade: 'C1', panels: [['Ashish Gudankwar', 'Sakshi Raut'], ['Ritesh Nirmalkar', 'Ravi Sharma'], ['Ashish Gudankwar', 'Sakshi Raut']] },
  { job_code: 'CPA-FB-C1', designation: 'Guest Service Associate � F&B', department: 'F&B Service', grade: 'C1', panels: [['Ashish Gudankwar', 'Sakshi Raut'], ['Veer Rathore', 'Irfan Shiekh', 'Abhishek Meshram'], ['Ashish Gudankwar', 'Sakshi Raut']] },
  { job_code: 'CPA-FO-C1', designation: 'Guest Service Associate � Front Office', department: 'Front Office', grade: 'C1', panels: [['Ashish Gudankwar', 'Sakshi Raut'], ['Aniruddha Pimple', 'Ravi Sharma'], ['Ashish Gudankwar', 'Sakshi Raut']] },
  { job_code: 'CPA-HK-C1', designation: 'Guest Service Associate � Housekeeping', department: 'Housekeeping', grade: 'C1', panels: [['Ashish Gudankwar', 'Sakshi Raut'], ['Dharmendra Singh', 'Chaten Zoting', 'Ravi Sharma'], ['Ashish Gudankwar', 'Sakshi Raut']] },
  { job_code: 'CPA-VAL-C1', designation: 'Guest Service Associate � Valet', department: 'Front Office', grade: 'C1', panels: [['Ashish Gudankwar', 'Sakshi Raut'], ['Aniruddha Pimple', 'Ravi Sharma'], ['Ashish Gudankwar', 'Sakshi Raut']] },
  { job_code: 'CPA-SEC-C1', designation: 'Security Guard', department: 'Security', grade: 'C1', panels: [['Ashish Gudankwar', 'Sakshi Raut'], ['Shivesh Mishra', 'Prashant Raut'], ['Ashish Gudankwar', 'Sakshi Raut']] },
  { job_code: 'CPA-KIT-C1', designation: 'Senior Commis', department: 'Kitchen', grade: 'C1', panels: [['Ashish Gudankwar', 'Sakshi Raut'], ['Debraj Das', 'Ganesh Pagare', 'Shankar Tajne'], ['Ashish Gudankwar', 'Sakshi Raut']] },
  { job_code: 'CPA-STR-C1', designation: 'Store Associate', department: 'Stores', grade: 'C1', panels: [['Ashish Gudankwar', 'Sakshi Raut'], ['Narendra Bondre', 'Abdul Rizwi'], ['Ashish Gudankwar', 'Sakshi Raut']] },
  { job_code: 'CPA-FO-C2', designation: 'Bell Attendant', department: 'Front Office', grade: 'C2', panels: [['Ashish Gudankwar', 'Sakshi Raut'], ['Aniruddha Pimple', 'Ravi Sharma'], ['Ashish Gudankwar', 'Sakshi Raut']] },
  { job_code: 'CPA-KIT-C2', designation: 'Junior Commis', department: 'Kitchen', grade: 'C2', panels: [['Ashish Gudankwar', 'Sakshi Raut'], ['Debraj Das', 'Ganesh Pagare', 'Shankar Tajne'], ['Ashish Gudankwar', 'Sakshi Raut']] },
  { job_code: 'CPA-KST-C2', designation: 'Kitchen Steward', department: 'Kitchen Stewarding', grade: 'C2', panels: [['Ashish Gudankwar', 'Sakshi Raut'], ['Debraj Das', 'Shankar Tajne', 'Chagan Nibrate'], ['Ashish Gudankwar', 'Sakshi Raut']] },
];

/* Sheet name → the name stored on the account, where the two differ.
   Every entry here was confirmed by HR; nothing in this map is inferred.
   Deliberately absent: "Narendra Bondre" (chef.ufo@cpgh.in) is a DIFFERENT person
   from the seeded "Narendra Singh" (chef.pablo@cpgh.in) and needs his own account. */
export const NAME_ALIASES = {
  'Parag Sir': 'Parag',
  'Arjun Sir': 'Arjun Arora',
  'Angadh sir': 'Angadh Arora',
  'Amit Sir': 'Amit Kandwal',
  'Amit Chakrborty': 'Amit Cakraborty',
  'Ashish Sir': 'Ashish Kamble',
  'Ashish Gudankwar': 'Ashish',        // seeded first-name-only, HR Executive at CPA
  'Rajkumar Gudankwar': 'Rajkumar',    // seeded first-name-only, HR — Units
  'Dharmendra Singh': 'Dharmendra',
  'Shivesh Mishra': 'Shivesh',
  'Ravi Sharma': 'Ravikant Sharma',
  'Veer Rathore': 'Veerendra Singh',
  'Irfan Shiekh': 'Irfan Khan',
  'Aniruddha Pimple': 'Anirudhha',
  'Chaten Zoting': 'Chetan Zoting',    // HR gave the first name as "Chetan"
};
