import { saveAs } from "file-saver";
import { getBlobData } from "../backend/api";

// Shown only after the PDF has actually been received and handed to the
// browser's download — never on a failed request.
export const CERTIFICATE_DOWNLOADED_MESSAGE = "Certificate Downloaded Successfully";

const FAILURE_MESSAGE = "Could not download the certificate. Please try again.";

// Fetches the certificate PDF from the API and starts the browser download.
// `params` is `{ ref }` (public Result page, from the result lookup), `{ id }`
// (admin, exam score id) or empty (signed-in student: their own result).
// Resolves { ok: true } once the file has been passed to the browser, or
// { ok: false, message } if the server refused or did not return a real PDF.
export const downloadCertificatePdf = async (params, fileName = "QSC-Certificate.pdf") => {
  const response = await getBlobData(params, "exam-registration/download-state-certificate");

  if (response?.status !== 200 || !response.data || response.data.size === 0) {
    return { ok: false, message: response?.message || FAILURE_MESSAGE };
  }

  // Guard against saving an HTML/JSON error page as "certificate.pdf".
  const signature = await response.data.slice(0, 5).text();
  if (!signature.startsWith("%PDF")) {
    return { ok: false, message: FAILURE_MESSAGE };
  }

  saveAs(response.data, fileName);
  return { ok: true };
};
