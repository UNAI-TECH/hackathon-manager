/**
 * CODEKARX HACKATHON – BACKEND (v5)
 * Changes:
 * - Removed transactionId dependency from Phase 1 submission
 * - registrationId is always auto-generated
 * - Drive folder name: {Name} - {College} - {Email}
 * - New action: get_application_by_email (Phase 2 email lookup)
 * - New action: delete_application (Admin delete row)
 */

const APP_SHEET_NAME = "Applications";
const SETTINGS_SHEET_NAME = "Settings";
const ROOT_FOLDER_NAME = "Codekarx_Submissions";

const APP_HEADERS = [
  "registrationId",
  "projectName",
  "status",
  "remarks",
  "firstName",
  "lastName",
  "email",
  "phone",
  "track",
  "registrationType",
  "teamName",
  "teamLeaderName",
  "teamLeaderEmail",
  "member1Name",
  "member1Email",
  "member2Name",
  "member2Email",
  "member3Name",
  "member3Email",
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
 * Get/create Google Drive folder: Root > Phase N > {Name} - {College} - {Email}
 */
function getTargetFolder(phaseNum, data) {
  let root = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  let rootFolder = root.hasNext() ? root.next() : DriveApp.createFolder(ROOT_FOLDER_NAME);

  let phaseName = "Phase " + phaseNum;
  let phase = rootFolder.getFoldersByName(phaseName);
  let phaseFolder = phase.hasNext() ? phase.next() : rootFolder.createFolder(phaseName);

  const isTeam = data.registrationType === "Team";
  const userName = isTeam ? (data.teamName || "Team") : ((data.firstName || "") + " " + (data.lastName || "")).trim() || "Unknown";
  const college = data.collegeCompany || "NoCollege";
  const email = isTeam ? (data.teamLeaderEmail || data.email || "noemail") : (data.email || "noemail");
  const subFolderName = `${userName} - ${college} - ${email}`;

  let sub = phaseFolder.getFoldersByName(subFolderName);
  let subFolder = sub.hasNext() ? sub.next() : phaseFolder.createFolder(subFolderName);

  return subFolder;
}

/**
 * Decode base64 and save to Google Drive folder
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

  // ─── GET ALL APPLICATIONS ───────────────────────────────────────────────────
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
      obj._id = (obj.registrationId || "").toString();
      if (obj.department && !obj.track) obj.track = obj.department;
      return obj;
    });
    return createResponse({ result: "success", data: applications });
  }

  // ─── GET BY REGISTRATION ID ─────────────────────────────────────────────────
  if (action === "get_application_by_regid") {
    const rawData = appSheet.getDataRange().getValues();
    const headers = rawData[0];
    const idCol = headers.indexOf("registrationId");
    const targetId = (data.registrationId || "").toString().trim();

    for (let i = 1; i < rawData.length; i++) {
      if (rawData[i][idCol].toString() === targetId) {
        let obj = {};
        headers.forEach((h, j) => { obj[h.toString().trim()] = rawData[i][j]; });
        if (obj.department && !obj.track) obj.track = obj.department;
        return createResponse({ result: "success", data: obj });
      }
    }
    return createResponse({ result: "error", error: "Candidate not found" });
  }

  // ─── GET BY EMAIL (Phase 2 lookup) ──────────────────────────────────────────
  if (action === "get_application_by_email") {
    const rawData = appSheet.getDataRange().getValues();
    const headers = rawData[0];
    const emailCol = headers.indexOf("email");
    const leaderEmailCol = headers.indexOf("teamLeaderEmail");
    const memberCols = ["member1Email", "member2Email", "member3Email", "member4Email"].map(f => headers.indexOf(f));
    const targetEmail = (data.email || "").toString().trim().toLowerCase();

    for (let i = 1; i < rawData.length; i++) {
      const rowEmail = emailCol !== -1 ? rawData[i][emailCol].toString().trim().toLowerCase() : "";
      const rowLeaderEmail = leaderEmailCol !== -1 ? rawData[i][leaderEmailCol].toString().trim().toLowerCase() : "";
      const memberEmails = memberCols.map(c => c !== -1 ? rawData[i][c].toString().trim().toLowerCase() : "");

      if (rowEmail === targetEmail || rowLeaderEmail === targetEmail || memberEmails.includes(targetEmail)) {
        let obj = {};
        headers.forEach((h, j) => { obj[h.toString().trim()] = rawData[i][j]; });
        if (obj.department && !obj.track) obj.track = obj.department;
        return createResponse({ result: "success", data: obj });
      }
    }
    return createResponse({ result: "error", error: "No registration found for this email." });
  }

  // ─── GET PHASE ───────────────────────────────────────────────────────────────
  if (action === "get_phase") {
    return createResponse({ result: "success", phase: parseInt(settingsSheet.getRange(2, 1).getValue()) || 1 });
  }

  // ─── SUBMIT PHASE 1 ──────────────────────────────────────────────────────────
  if (action === "submit_phase1") {
    // Always auto-generate a new registrationId
    const regId = "REG-" + new Date().getTime();

    const folder = getTargetFolder(1, data);
    if (files.ppt) data.pptUrl = saveBase64File(folder, files.ppt);

    const headers = appSheet.getRange(1, 1, 1, appSheet.getLastColumn()).getValues()[0];
    const row = headers.map(h => {
      const key = h.toString().trim();
      if (key === "registrationId") return regId;
      if (key === "status") return "Pending";
      if (key === "phase1SubmittedAt") return new Date();
      if (data[key] !== undefined && data[key] !== "") return data[key];
      return "";
    });

    appSheet.appendRow(row);

    // Send confirmation emails
    const emails = [];
    if (data.registrationType === "Individual") {
      if (data.email) emails.push(data.email);
    } else {
      ["teamLeaderEmail", "member1Email", "member2Email", "member3Email", "member4Email"].forEach(f => {
        if (data[f] && data[f].trim() !== "") emails.push(data[f]);
      });
    }

    const uniqueEmails = [...new Set(emails.filter(e => e && e.trim() !== ""))];
    if (uniqueEmails.length > 0) {
      const subject = "Phase 1 Registration Confirmed – Codekarx Hackathon";
      const projectLabel = data.projectName ? `Project: ${data.projectName}` : "";
      const body = `Hi,\n\nYour Phase 1 registration has been received!\n\n${projectLabel}\n\nYour Unique Access Code: ${regId}\n\nIMPORTANT: Save this code — you will need it for Phase 2 submission if required.\n\nYour submission is under review. You will receive another email once the status is updated.\n\nBest Regards,\nCodekarx Team`;
      uniqueEmails.forEach(email => {
        try { GmailApp.sendEmail(email, subject, body); } catch (e) {}
      });
    }

    return createResponse({ result: "success", message: "Phase 1 Submitted", registrationId: regId });
  }

  // ─── SUBMIT PHASE 2 ──────────────────────────────────────────────────────────
  if (action === "submit_phase2") {
    const targetId = (data.registrationId || "").toString();
    const rawData = appSheet.getDataRange().getValues();
    const headers = rawData[0];
    const idCol = headers.indexOf("registrationId");

    for (let i = 1; i < rawData.length; i++) {
      if (rawData[i][idCol].toString() === targetId) {
        const rowDataObj = {};
        headers.forEach((h, idx) => rowDataObj[h] = rawData[i][idx]);

        const folder = getTargetFolder(2, rowDataObj);
        if (files.readme) data.readmeUrl = saveBase64File(folder, files.readme);
        if (files.finalZip) data.sourceCodeUrl = saveBase64File(folder, files.finalZip);

        const updates = {
          githubRepoLink: data.githubRepoLink || rowDataObj.githubRepoLink,
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

  // ─── UPDATE STATUS ───────────────────────────────────────────────────────────
  if (action === "update_status") {
    const targetId = (data.id || data.registrationId || "").toString().trim();
    const rawData = appSheet.getDataRange().getValues();
    const headers = rawData[0];
    const idCol = headers.indexOf("registrationId");

    for (let i = 1; i < rawData.length; i++) {
      const rowRegId = rawData[i][idCol].toString().trim();

      if (rowRegId === targetId) {
        const newStatus = data.status;
        const newRemarks = data.remarks || "";

        const currentStatus = rawData[i][headers.indexOf("status")];
        if (newStatus === "Pending" && (currentStatus === "Approved" || currentStatus === "Rejected")) {
          return createResponse({ result: "error", error: "Cannot revert to Pending from Approved/Rejected." });
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

        // ⚠️ REPLACE with your actual deployed frontend URL
        const APP_URL = "https://codekarx.netlify.app"; // or your custom domain
        const phase2Link = `${APP_URL}/phase2?id=${rowRegId}`;

        if (uniqueEmails.length > 0) {
          let subject, body;

          if (newStatus === "Approved") {
            subject = `🎉 Congratulations! You're Selected – ${projectName}`;
            body = `Hi,\n\nGreat news! Your Phase 1 submission for '${projectName}' has been APPROVED! 🎉\n\nYou are now eligible to participate in Phase 2.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📎 PHASE 2 SUBMISSION LINK:\n${phase2Link}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nIMPORTANT:\n• This link is unique to your registration. Do NOT share it.\n• Click the link above to access and submit your Phase 2 project.\n• Submit your GitHub repository link, README, and source code.\n\nRemarks from our team: ${newRemarks || "Well done! We look forward to your final submission."}\n\nBest of luck!\nCodekarx Team`;
          } else if (newStatus === "Rejected") {
            subject = `Codekarx – Status Update for ${projectName}`;
            body = `Hi,\n\nThank you for participating in Codekarx Hackathon!\n\nAfter careful review, your Phase 1 submission for '${projectName}' was not selected to proceed to Phase 2.\n\nRemarks: ${newRemarks || "Thank you for your effort. Keep building!"}\n\nWe encourage you to keep innovating and look forward to seeing you in future editions.\n\nBest Regards,\nCodekarx Team`;
          } else {
            subject = `Status Update – ${projectName}`;
            body = `Hi,\n\nYour application for '${projectName}' (ID: ${rowRegId}) has been updated to: ${newStatus}.\n\nRemarks: ${newRemarks || "No remarks provided."}\n\nBest Regards,\nCodekarx Team`;
          }

          uniqueEmails.forEach(email => {
            try { GmailApp.sendEmail(email.toString(), subject, body); } catch (e) {}
          });
        }


        return createResponse({ result: "success", data: { id: targetId, status: newStatus, remarks: newRemarks } });
      }
    }
    return createResponse({ result: "error", error: "Candidate not found with ID: " + targetId });
  }

  // ─── DELETE APPLICATION ──────────────────────────────────────────────────────
  if (action === "delete_application") {
    const targetId = (data.registrationId || "").toString().trim();
    const rawData = appSheet.getDataRange().getValues();
    const headers = rawData[0];
    const idCol = headers.indexOf("registrationId");

    for (let i = 1; i < rawData.length; i++) {
      if (rawData[i][idCol].toString().trim() === targetId) {
        appSheet.deleteRow(i + 1);
        return createResponse({ result: "success", message: "Application deleted." });
      }
    }
    return createResponse({ result: "error", error: "Application not found: " + targetId });
  }

  // ─── UPDATE PHASE ─────────────────────────────────────────────────────────────
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
        const subject = "Phase 2 is now LIVE – Codekarx Hackathon";
        const body = `Hi,\n\nWe are excited to announce that Phase 2 is now OPEN!\n\nLog in to the portal using your email address to upload your final GitHub Link and documentation.\n\nGood luck!\nCodekarx Team`;
        uniqueEmails.forEach(email => {
          try { GmailApp.sendEmail(email, subject, body); } catch (e) {}
        });
      }
    }
    return createResponse({ result: "success", phase: newPhase });
  }

  return createResponse({ result: "error", error: "Invalid action: " + action });
}

function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
