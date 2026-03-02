/**
 * CODEKARX HACKATHON - FINAL BACKEND (v4)
 * Supports: Unique Codes, Drive Organization, Multi-Member Emails, 
 * and Phase 2 Automated Notifications.
 * [MODIFIED]: Added 'track' and 'phone' to APP_HEADERS for frontend consistency.
 */

const APP_SHEET_NAME = "Applications";
const SETTINGS_SHEET_NAME = "Settings";
const ROOT_FOLDER_NAME = "Codekarx_Submissions";

// Mandatory Headers for the Applications Sheet
const APP_HEADERS = [
  "registrationId", 
  "transactionId", 
  "projectName", 
  "status", 
  "remarks", 
  "firstName", 
  "lastName", 
  "email", 
  "phone",           // [ADDED]
  "track",           // [ADDED]
  "registrationType", 
  "teamName", 
  "teamLeaderName", 
  "teamLeaderEmail",
  "member1Email",
  "member2Email",
  "member3Email",
  "member4Email",
  "projectDescription", 
  "pptUrl",          
  "readmeUrl",       
  "sourceCodeUrl",   
  "phase1SubmittedAt",
  "githubRepoLink",
  "phase2SubmittedAt",
  "isCompleted",
  "collegeCompany"   
];

function doGet(e) {
    try {
        return handleRequest(e.parameter);
    } catch (err) {
        return createResponse({ result: "error", error: "GET Error: " + err.toString() });
    }
}

function doPost(e) {
    try {
        const contents = JSON.parse(e.postData.contents);
        return handleRequest(contents);
    } catch (err) {
        return createResponse({ result: "error", error: "POST Error: " + err.toString() });
    }
}

/**
 * Helper to get or create a folder structure
 */
function getTargetFolder(phaseNum, data) {
    let root = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
    let rootFolder = root.hasNext() ? root.next() : DriveApp.createFolder(ROOT_FOLDER_NAME);
    
    let phaseName = "Phase " + phaseNum;
    let phase = rootFolder.getFoldersByName(phaseName);
    let phaseFolder = phase.hasNext() ? phase.next() : rootFolder.createFolder(phaseName);
    
    // Sub-folder name: [Name] - [College]
    const userName = data.registrationType === "Individual" 
      ? (data.firstName || "Unknown") 
      : (data.teamName || "Team");
    const college = data.collegeCompany || "NoCollege";
    const subFolderName = `${userName} - ${college}`;
    
    let sub = phaseFolder.getFoldersByName(subFolderName);
    let subFolder = sub.hasNext() ? sub.next() : phaseFolder.createFolder(subFolderName);
    
    return subFolder;
}

/**
 * Decodes base64 and saves to folder
 */
function saveBase64File(folder, fileObj) {
    if (!fileObj || !fileObj.base64) return null;
    const decoded = Utilities.base64Decode(fileObj.base64);
    const blob = Utilities.newBlob(decoded, fileObj.type, fileObj.name);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
}

function handleRequest(payload) {
    const action = payload.action;
    const data = payload.data || payload;
    const files = payload.files || {};
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    function getOrInitSheet(name, headers) {
        let sheet = ss.getSheetByName(name);
        if (!sheet) {
            sheet = ss.getSheetByName("Sheet1") || ss.insertSheet(name);
            if (sheet.getName() !== name) sheet.setName(name);
        }
        if (sheet.getLastRow() === 0) {
            sheet.appendRow(headers);
        } else if (name === APP_SHEET_NAME) {
            const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
            headers.forEach(h => {
              if (existingHeaders.indexOf(h) === -1) {
                sheet.getRange(1, existingHeaders.length + 1).setValue(h);
                existingHeaders.push(h);
              }
            });
        }
        return sheet;
    }

    const appSheet = getOrInitSheet(APP_SHEET_NAME, APP_HEADERS);
    const settingsSheet = getOrInitSheet(SETTINGS_SHEET_NAME, ["currentPhase"]);

    if (action === "get_applications") {
        const rawData = appSheet.getDataRange().getValues();
        if (rawData.length <= 1) return createResponse({ result: "success", data: [] });
        const headers = rawData[0];
        const rows = rawData.slice(1);
        const applications = rows.map(row => {
            let obj = {};
            headers.forEach((header, i) => {
                obj[header.toString().trim()] = row[i];
            });
            obj._id = (obj.registrationId || obj.transactionId || "").toString(); 
            // Consistency fallbacks
            if (obj.department && !obj.track) obj.track = obj.department;
            return obj;
        });
        return createResponse({ result: "success", data: applications });
    }

    if (action === "get_application_by_regid") {
        const rawData = appSheet.getDataRange().getValues();
        const headers = rawData[0];
        const idCol = headers.indexOf("registrationId");
        const transCol = headers.indexOf("transactionId");
        const targetId = (data.registrationId || "").toString().trim();

        for (let i = 1; i < rawData.length; i++) {
            if (rawData[i][idCol].toString() === targetId || (transCol !== -1 && rawData[i][transCol].toString() === targetId)) {
                let obj = {};
                headers.forEach((h, j) => { obj[h.toString().trim()] = rawData[i][j]; });
                if (obj.department && !obj.track) obj.track = obj.department;
                return createResponse({ result: "success", data: obj });
            }
        }
        return createResponse({ result: "error", error: "Candidate not found" });
    }

    if (action === "get_phase") {
        return createResponse({ result: "success", phase: parseInt(settingsSheet.getRange(2, 1).getValue()) || 1 });
    }

    if (action === "submit_phase1") {
        const transactionId = (data.transactionId || "").toString().trim();
        // [FIX]: Ensure registrationId is always the transactionId if provided
        const regId = (transactionId || data.registrationId || "REG-" + new Date().getTime()).toString();
        
        const folder = getTargetFolder(1, data);
        if (files.ppt) data.pptUrl = saveBase64File(folder, files.ppt);

        const headers = appSheet.getRange(1, 1, 1, appSheet.getLastColumn()).getValues()[0];
        const row = headers.map(h => {
          const key = h.toString().trim();
          if (data[key] !== undefined) return data[key];
          if (key === "registrationId") return regId;
          if (key === "transactionId") return transactionId; // Ensure it's stored
          if (key === "status") return "Pending";
          if (key === "phase1SubmittedAt") return new Date();
          return "";
        });
        
        appSheet.appendRow(row);

        // Notify Team
        const emails = [];
        if (data.registrationType === "Individual") {
          if (data.email) emails.push(data.email);
        } else {
          ["teamLeaderEmail", "member1Email", "member2Email", "member3Email", "member4Email"].forEach(f => {
            if (data[f]) emails.push(data[f]);
          });
        }

        const uniqueEmails = [...new Set(emails.filter(e => e && e.trim() !== ""))];
        if (uniqueEmails.length > 0) {
           const subject = "Phase 1 Submission Received - Codekarx Hackathon";
           // [FIX]: Clarified unique code in email
           const body = `Hi,\n\nSubmission Received! Your Unique Access Code (Transaction ID) is: ${regId}\n\nProject: ${data.projectName}.\n\nIMPORTANT: Use this code to upload Phase 2 documentation later.\n\nBest Regards,\nCodekarx Team`;
           uniqueEmails.forEach(email => { try { GmailApp.sendEmail(email, subject, body); } catch (e) {} });
        }

        return createResponse({ result: "success", message: "Phase 1 Submitted", registrationId: regId });
    }

    if (action === "submit_phase2") {
        const targetId = (data.registrationId || data.transactionId || "").toString();
        const rawData = appSheet.getDataRange().getValues();
        const headers = rawData[0];
        const idCol = headers.indexOf("registrationId");
        const transCol = headers.indexOf("transactionId");
        
        for (let i = 1; i < rawData.length; i++) {
           if (rawData[i][idCol].toString() === targetId || rawData[i][transCol].toString() === targetId) {
              const rowDataObj = {};
              headers.forEach((h, idx) => rowDataObj[h] = rawData[i][idx]);

              const folder = getTargetFolder(2, rowDataObj);
              if (files.readme) data.readmeUrl = saveBase64File(folder, files.readme);
              if (files.finalZip) data.sourceCodeUrl = saveBase64File(folder, files.finalZip);

              const updates = {
                githubRepoLink: data.githubRepoLink,
                readmeUrl: data.readmeUrl || rowDataObj.readmeUrl,
                sourceCodeUrl: data.sourceCodeUrl || rowDataObj.sourceCodeUrl,
                phase2SubmittedAt: new Date(),
                isCompleted: "TRUE"
              };

              Object.keys(updates).forEach(key => {
                const colIdx = headers.indexOf(key);
                if (colIdx !== -1) appSheet.getRange(i + 1, colIdx + 1).setValue(updates[key]);
              });

              return createResponse({ result: "success", message: "Phase 2 Updated" });
           }
        }
        return createResponse({ result: "error", error: "Registration not found" });
    }

    if (action === "update_status") {
        const targetId = (data.id || data.registrationId || data.transactionId || "").toString().trim();
        const rawData = appSheet.getDataRange().getValues();
        const headers = rawData[0];
        const idCol = headers.indexOf("registrationId");
        const transCol = headers.indexOf("transactionId");

        for (let i = 1; i < rawData.length; i++) {
            const rowRegId = rawData[i][idCol].toString().trim();
            const rowTransId = transCol !== -1 ? rawData[i][transCol].toString().trim() : "";
            
            if (rowRegId === targetId || (rowTransId && rowTransId === targetId)) {
                const newStatus = data.status;
                const newRemarks = data.remarks || "";

                // [FIX]: Robustness - Ensure we don't accidentally revert to Pending if already Approved/Rejected
                const currentStatus = rawData[i][headers.indexOf("status")];
                if (newStatus === "Pending" && (currentStatus === "Approved" || currentStatus === "Rejected")) {
                    return createResponse({ result: "error", error: "Cannot revert to Pending from Approved/Rejected status." });
                }

                const statusCol = headers.indexOf("status");
                const remarksCol = headers.indexOf("remarks");
                if (statusCol !== -1) appSheet.getRange(i + 1, statusCol + 1).setValue(newStatus);
                if (remarksCol !== -1) appSheet.getRange(i + 1, remarksCol + 1).setValue(newRemarks);
                
                const emails = [];
                const regType = rawData[i][headers.indexOf("registrationType")];
                if (regType === "Individual") {
                  emails.push(rawData[i][headers.indexOf("email")]);
                } else {
                  ["teamLeaderEmail", "member1Email", "member2Email", "member3Email", "member4Email"].forEach(f => {
                    const idx = headers.indexOf(f);
                    if (idx !== -1 && rawData[i][idx]) emails.push(rawData[i][idx]);
                  });
                }
                
                const uniqueEmails = [...new Set(emails.filter(e => e && e.toString().trim() !== ""))];
                const projectName = rawData[i][headers.indexOf("projectName")];

                if (uniqueEmails.length > 0) {
                    const subject = (newStatus === 'Approved') ? `Phase 1 Approved - ${projectName}` : (newStatus === 'Rejected' ? `Status Update (Rejected) - ${projectName}` : `Status Update - ${projectName}`);
                    const body = `Hi,\n\nYour application status for '${projectName}' (ID: ${rowRegId}) has been updated to: ${newStatus}.\n\nRemarks: ${newRemarks || "No remarks provided."}\n\nBest Regards,\nCodekarx Team`;
                    uniqueEmails.forEach(email => { try { GmailApp.sendEmail(email.toString(), subject, body); } catch (e) {} });
                }
                
                return createResponse({ result: "success", data: { id: targetId, status: newStatus, remarks: newRemarks } });
            }
        }
        return createResponse({ result: "error", error: "Candidate not found with ID: " + targetId });
    }

    if (action === "update_phase") {
        const newPhase = parseInt(data.currentPhase);
        settingsSheet.getRange(2, 1).setValue(newPhase);

        if (newPhase === 2) {
            const raw = appSheet.getDataRange().getValues();
            const headers = raw[0];
            
            const emailSet = new Set();
            raw.slice(1).forEach(row => {
                const regType = row[headers.indexOf("registrationType")];
                if (regType === "Individual") {
                    const e = row[headers.indexOf("email")];
                    if (e) emailSet.add(e.toString().trim());
                } else {
                    ["teamLeaderEmail", "member1Email", "member2Email", "member3Email", "member4Email"].forEach(f => {
                        const idx = headers.indexOf(f);
                        if (idx !== -1 && row[idx]) emailSet.add(row[idx].toString().trim());
                    });
                }
            });

            const uniqueEmails = Array.from(emailSet).filter(e => e !== "");
            if (uniqueEmails.length > 0) {
                const subject = "Phase 2 is now LIVE - Codekarx Hackathon";
                const body = `Hi,\n\nWe are excited to announce that Phase 2 is now OPEN!\n\nYou can now log in to the portal using your Unique Access Code or Transaction ID to upload your final Github Link and README.\n\nGood luck!\nCodekarx Team`;
                uniqueEmails.forEach(email => { try { GmailApp.sendEmail(email, subject, body); } catch(e) {} });
            }
        }
        return createResponse({ result: "success", phase: newPhase });
    }

    return createResponse({ result: "error", error: "Invalid action" });
}

function createResponse(data) {
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
