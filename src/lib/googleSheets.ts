export interface CandidateData {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    email: string;
    phone?: string;
    department?: string;
    address?: string;
    candidateType?: string;
    [key: string]: any;
}

// User provided URL
export const GOOGLE_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbwD0ayuEEHESnQ4JsPV4fJ1jxHqNm4lbCoWpA1AtRt_ss9M-rACvUpQHWK1y14BGW69/exec";

export const googleSheets = {


    /**
     * Submits application data to the 'Applications' sheet
     */
    async submitApplication(data: CandidateData, files: Record<string, { name: string, type: string, base64: string }>) {
        return this.sendRequest({
            action: "submit_application",
            data: data,
            files: files
        }, true); // Use no-cors for robustness
    },

    /**
     * Fetches all applications for HR view
     */
    async getApplications() {
        return this.sendRequest({
            action: "get_applications"
        }, false, true); // Use GET for retrieval
    },

    /**
     * Verifies a candidate by email
     */
    async verifyCandidate(email: string) {
        return this.sendRequest({
            action: "verify_candidate",
            data: { email }
        }, false); // Allow reading response to see script errors
    },

    /**
     * Fetches all departments
     */
    async getDepartments() {
        return this.sendRequest({
            action: "get_departments"
        }, false, true); // Use GET for retrieval
    },

    /**
     * Adds a new department
     */
    async addDepartment(name: string) {
        return this.sendRequest({
            action: "add_department",
            data: { name }
        }, false);
    },

    /**
     * Sends remarks/feedback for a candidate and triggers email notification
     */
    async addRemarks(email: string, remarks: string) {
        return this.sendRequest({
            action: "add_remarks",
            data: { email, remarks }
        }, false); // Allow reading response to see script errors
    },

    /**
     * Tests the email notification system
     */
    async testEmail() {
        return this.sendRequest({
            action: "test_email"
        }, false);
    },

    /**
     * Deletes a candidate by email
     */
    async deleteCandidate(email: string) {
        return this.sendRequest({
            action: "delete_candidate",
            data: { email }
        });
    },

    /**
     * Helper to send requests
     */
    async sendRequest(payload: any, noReply: boolean = false, useGet: boolean = false) {
        if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("YOUR_GOOGLE_SCRIPT_URL_HERE")) {
            console.warn("Google Script URL is not configured.");
            throw new Error("Google Script URL is not configured in source code.");
        }

        try {
            let url = GOOGLE_SCRIPT_URL;
            const options: RequestInit = {
                method: useGet ? "GET" : "POST",
            };

            if (useGet) {
                const params = new URLSearchParams(payload);
                url += (url.includes('?') ? '&' : '?') + params.toString();
            } else {
                options.headers = {
                    "Content-Type": "text/plain;charset=utf-8",
                };
                options.body = JSON.stringify(payload);
                if (noReply) {
                    options.mode = 'no-cors';
                }
            }

            console.log(`[GoogleSheets] Sending ${payload.action} request:`, payload);

            // The noReply mode setting for POST requests is now handled within the 'else' block above.
            // This block is no longer needed here.
            // if (noReply) {
            //     options.mode = 'no-cors';
            // }

            const response = await fetch(url, options); // Use the potentially modified 'url'

            if (noReply) {
                // In no-cors mode, we can't read the response, so we assume success.
                // This prevents CORS errors from blocking the UI flow.
                console.log(`[GoogleSheets] Request sent in no-cors mode. Please check the sheet for data updates.`);
                return { result: "success", message: "Request sent (no-cors)" };
            }

            const text = await response.text();
            console.log(`[GoogleSheets] Received response status: ${response.status}`);
            try {
                const result = JSON.parse(text);
                if (result.result === "error") {
                    throw new Error(result.error || "Unknown backend error");
                }
                return result;
            } catch (e: any) {
                if (e.message && e.message.includes("Server returned invalid response")) throw e;
                console.error("[GoogleSheets] Raw response from script:", text);
                throw new Error(`The script returned an invalid format. Raw message: ${text.substring(0, 100)}...`);
            }
        } catch (error) {
            console.error("Error communicating with Google Sheets:", error);
            throw error;
        }
    }
};
