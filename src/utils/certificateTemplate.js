// const generateCertificateHTML = (data) => {
//   return `
//   <!DOCTYPE html>
//   <html>
//   <head>
//     <meta charset="UTF-8" />
//     <script src="https://cdn.tailwindcss.com"></script>

//     <link href="https://fonts.googleapis.com/css2?family=Pacifico&display=swap" rel="stylesheet">

//     <style>
//       @page {
//         size: A4;
//         margin: 20px;
//       }
//     </style>
//   </head>

//   <body class="flex justify-center">

//      <div class="bg-white w-[210mm] h-[290mm] overflow-hidden p-4 ">

//       <!-- HEADER -->
//            <div class="flex justify-between items-center mb-6">

//         <!-- LEFT -->
//         <div class="flex justify-between items-center mb-6">
//           <img src="${data.doctorImage || "https://via.placeholder.com/60"}"
//             class="w-14 h-14 rounded-full object-cover border-2 border-gray-300 shadow-sm" />
//           <div>
//             <p class="font-semibold text-sm text-gray-800">${data.doctor}</p>
//             <p class="text-xs text-gray-500">${data.specialization || ""}</p>
//           </div>
//         </div>

//         <!-- CENTER -->
//         <div class="flex flex-col items-center w-[40%] text-center">
//           <div class="flex items-center gap-2">
//             <h1 class="text-2xl font-bold tracking-wide">
//               <span class="text-blue-500">Yo</span>
//               <span class="text-green-600">Doctor</span>
//             </h1>

//             <!-- Verified Tick -->
//             <div class="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
//               <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                 <path stroke-width="3" d="M5 13l4 4L19 7"/>
//               </svg>
//             </div>
//           </div>

//           <p class="text-xs text-gray-500 mt-1">Verified Clinic</p>
//           <p class="text-sm font-semibold text-[#5d4037]">${data.clinc || ""}</p>
//         </div>

//         <!-- RIGHT -->
//         <div class="flex justify-end items-center w-[30%]">
//           <img src="${data.logo || "https://via.placeholder.com/100"}"
//             class="w-20 object-contain" />
//         </div>
//       </div>

//       <!-- META -->
//       <div class="flex justify-between text-sm font-semibold mb-6 text-gray-700">
//         <p>Certificate No: ${data.certificate_id}</p>
//         <p>Date: ${data.date}</p>
//       </div>

//       <!-- TITLE -->
//       <div class="text-center mb-6">
//         <h2 class="text-2xl font-bold text-gray-800">MEDICAL CERTIFICATE</h2>
//         <div class="w-20 h-1 bg-red-500 mx-auto mt-2"></div>
//       </div>

//       <!-- PHOTO -->
//       <div class="flex justify-end mb-4">
//         <img src="${data.patientPhoto || "https://via.placeholder.com/120"}"
//           class="w-28 h-32 border-2 border-dashed rounded object-cover bg-gray-50" />
//       </div>

//       <!-- BODY -->
//       <p class="text-gray-700 leading-relaxed mb-4">
//         This is to certify that <strong>${data.patient}</strong>,
//           has been examined and treated by me. The details of the patient's medical condition and treatment are provided below.
//       </p>

//       <!-- TABLE -->
//       <table class="w-full mt-4 border border-gray-200 text-sm">
//         <tbody>

//           ${row("Medical Conditions", data.medical_conditions, true)}
//           ${row("Certificate Type", data.certificateType)}
//           ${row("Purpose", data.purpose, true)}
//           ${row("Issue Date", data.issueDate)}
//           ${row("Date Of Birth", data.dob, true)}
//           ${row("Gender", data.gender)}
//           ${row("Doctor's Notes", data.notes, true)}
//           ${row("Treatment", data.treatment)}
//           ${row("Medicines", data.medicines, true)}

//         </tbody>
//       </table>

//       <!-- RECOMMENDATION -->
//       <div class="mt-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded text-sm text-gray-700">
//         The patient is advised rest from 
//         <strong>${data.issueDate}</strong> to 
//         <strong>${data.expiryDate}</strong>
//         (Total <strong>${data.days} days</strong>).
//       </div>

//       <!-- FOOTER -->
//       <div class="mt-10 flex justify-between items-end">

//         <p class="text-xs text-red-500 italic">
//           * Valid for ${data.days}  only
//         </p>

//         <!-- QR -->
//         <div class="text-center">
//           <p class="text-xs text-gray-500">Scan to verify</p>
//           <img src="${data.qr}" class="w-20 h-20 mx-auto" />
//         </div>

//         <!-- SIGN -->
//         <div class="text-right">
//           <p style="font-family: Pacifico" class="text-lg">${data.doctor}</p>
//           <p class="text-sm">${data.degree || ""}</p>
//         </div>

//       </div>

//     </div>

//   </body>
//   </html>
//   `;
// };

// // reusable rows
// const row = (title, value, gray = false) => `
// <tr class="${gray ? "bg-gray-50" : ""}">
//   <td class="p-3 font-semibold w-1/3">${title}</td>
//   <td class="p-3">${value || "-"}</td>
// </tr>
// `;

// module.exports = generateCertificateHTML;


const escapeHtml = (value = "") => {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const row = (title, value, gray = false) => `
  <tr class="${gray ? "gray-row" : ""}">
    <td class="label-cell">${escapeHtml(title)}</td>
    <td class="value-cell">${escapeHtml(value || "-")}</td>
  </tr>
`;

const generateCertificateHTML = (data) => {
  const doctorImage = data.doctorImage
    ? `
      <img
        src="${data.doctorImage}"
        alt="Doctor"
        class="doctor-image"
      />
    `
    : `
      <div class="doctor-placeholder">
        DR
      </div>
    `;

  const patientPhoto = data.patientPhoto
    ? `
      <img
        src="${data.patientPhoto}"
        alt="Patient"
        class="patient-image"
      />
    `
    : `
      <div class="patient-placeholder">
        Photo
      </div>
    `;

  const logo = data.logo
    ? `
      <img
        src="${data.logo}"
        alt="YoDoctor Logo"
        class="logo-image"
      />
    `
    : "";

  const qrCode = data.qr
    ? `
      <img
        src="${data.qr}"
        alt="Verification QR Code"
        class="qr-image"
      />
    `
    : "";

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />

        <title>Medical Certificate</title>

        <style>
          @page {
            size: A4;
            margin: 10mm;
          }

          * {
            box-sizing: border-box;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-family: Arial, Helvetica, sans-serif;
            color: #374151;
          }

          body {
            width: 100%;
          }

          .certificate {
            width: 100%;
            min-height: 277mm;
            padding: 12mm;
            background: #ffffff;
            border: 1px solid #e5e7eb;
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 16px;
            margin-bottom: 22px;
          }

          .doctor-section {
            width: 30%;
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .doctor-image,
          .doctor-placeholder {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            border: 2px solid #d1d5db;
            object-fit: cover;
            flex-shrink: 0;
          }

          .doctor-placeholder {
            display: flex;
            justify-content: center;
            align-items: center;
            background: #f3f4f6;
            color: #6b7280;
            font-size: 15px;
            font-weight: 700;
          }

          .doctor-name {
            margin: 0;
            color: #1f2937;
            font-size: 14px;
            font-weight: 700;
          }

          .doctor-specialization {
            margin: 4px 0 0;
            color: #6b7280;
            font-size: 11px;
          }

          .brand-section {
            width: 40%;
            text-align: center;
          }

          .brand-row {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 7px;
          }

          .brand-name {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: 0.5px;
          }

          .brand-yo {
            color: #3b82f6;
          }

          .brand-doctor {
            color: #16a34a;
          }

          .verified-tick {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #3b82f6;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 700;
          }

          .verified-label {
            margin: 5px 0 0;
            color: #6b7280;
            font-size: 11px;
          }

          .clinic-name {
            margin: 3px 0 0;
            color: #5d4037;
            font-size: 13px;
            font-weight: 700;
          }

          .logo-section {
            width: 30%;
            display: flex;
            justify-content: flex-end;
            align-items: center;
          }

          .logo-image {
            width: 82px;
            max-height: 60px;
            object-fit: contain;
          }

          .meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 22px;
            color: #374151;
            font-size: 13px;
            font-weight: 700;
          }

          .meta p {
            margin: 0;
          }

          .title-section {
            margin-bottom: 22px;
            text-align: center;
          }

          .title-section h1 {
            margin: 0;
            color: #1f2937;
            font-size: 24px;
            font-weight: 700;
          }

          .title-line {
            width: 80px;
            height: 4px;
            margin: 8px auto 0;
            background: #ef4444;
          }

          .patient-photo-wrapper {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 15px;
          }

          .patient-image,
          .patient-placeholder {
            width: 112px;
            height: 128px;
            border: 2px dashed #9ca3af;
            border-radius: 5px;
            object-fit: cover;
            background: #f9fafb;
          }

          .patient-placeholder {
            display: flex;
            justify-content: center;
            align-items: center;
            color: #9ca3af;
            font-size: 13px;
          }

          .intro-text {
            margin: 0 0 16px;
            color: #374151;
            font-size: 14px;
            line-height: 1.7;
          }

          .details-table {
            width: 100%;
            margin-top: 14px;
            border-collapse: collapse;
            border: 1px solid #d1d5db;
            font-size: 13px;
          }

          .details-table td {
            border: 1px solid #e5e7eb;
            vertical-align: top;
          }

          .label-cell {
            width: 34%;
            padding: 10px 12px;
            color: #1f2937;
            font-weight: 700;
          }

          .value-cell {
            padding: 10px 12px;
            color: #374151;
          }

          .gray-row {
            background: #f9fafb;
          }

          .recommendation {
            margin-top: 22px;
            padding: 14px 16px;
            border-left: 4px solid #3b82f6;
            border-radius: 4px;
            background: #eff6ff;
            color: #374151;
            font-size: 13px;
            line-height: 1.6;
          }

          .footer {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 34px;
            gap: 20px;
          }

          .validity {
            width: 30%;
            margin: 0;
            color: #ef4444;
            font-size: 11px;
            font-style: italic;
          }

          .qr-section {
            width: 30%;
            text-align: center;
          }

          .qr-label {
            margin: 0 0 5px;
            color: #6b7280;
            font-size: 11px;
          }

          .qr-image {
            width: 82px;
            height: 82px;
            object-fit: contain;
          }

          .signature-section {
            width: 30%;
            text-align: right;
          }

          .signature-name {
            margin: 0;
            color: #1f2937;
            font-family: cursive;
            font-size: 19px;
            font-style: italic;
          }

          .signature-degree {
            margin: 4px 0 0;
            color: #374151;
            font-size: 12px;
          }

          .signature-label {
            margin: 7px 0 0;
            color: #6b7280;
            font-size: 10px;
          }
        </style>
      </head>

      <body>
        <main class="certificate">
          <header class="header">
            <section class="doctor-section">
              ${doctorImage}

              <div>
                <p class="doctor-name">
                  ${escapeHtml(data.doctor || "Doctor")}
                </p>

                <p class="doctor-specialization">
                  ${escapeHtml(data.specialization || "")}
                </p>
              </div>
            </section>

            <section class="brand-section">
              <div class="brand-row">
                <h2 class="brand-name">
                  <span class="brand-yo">Yo</span><span class="brand-doctor">Doctor</span>
                </h2>

                <div class="verified-tick">✓</div>
              </div>

              <p class="verified-label">Verified Clinic</p>

              <p class="clinic-name">
                ${escapeHtml(data.clinic || data.clinc || "")}
              </p>
            </section>

            <section class="logo-section">
              ${logo}
            </section>
          </header>

          <section class="meta">
            <p>
              Certificate No:
              ${escapeHtml(data.certificate_id || "-")}
            </p>

            <p>
              Date:
              ${escapeHtml(data.date || "-")}
            </p>
          </section>

          <section class="title-section">
            <h1>MEDICAL CERTIFICATE</h1>
            <div class="title-line"></div>
          </section>

          <section class="patient-photo-wrapper">
            ${patientPhoto}
          </section>

          <p class="intro-text">
            This is to certify that
            <strong>${escapeHtml(data.patient || "Patient")}</strong>
            has been examined and treated by me. The details of the
            patient's medical condition and treatment are provided below.
          </p>

          <table class="details-table">
            <tbody>
              ${row(
                "Medical Conditions",
                data.medical_conditions,
                true
              )}

              ${row(
                "Certificate Type",
                data.certificateType
              )}

              ${row(
                "Purpose",
                data.purpose,
                true
              )}

              ${row(
                "Issue Date",
                data.issueDate
              )}

              ${row(
                "Date of Birth",
                data.dob,
                true
              )}

              ${row(
                "Gender",
                data.gender
              )}

              ${row(
                "Doctor's Notes",
                data.notes,
                true
              )}

              ${row(
                "Fitness Status",
                data.treatment
              )}

              ${row(
                "Medicines",
                data.medicines,
                true
              )}
            </tbody>
          </table>

          <section class="recommendation">
            The certificate is valid from
            <strong>${escapeHtml(data.issueDate || "-")}</strong>
            to
            <strong>${escapeHtml(data.expiryDate || "-")}</strong>.

            Validity:
            <strong>
              ${escapeHtml(data.validity || data.days || "N/A")}
            </strong>.
          </section>

          <footer class="footer">
            <p class="validity">
              * Valid for
              ${escapeHtml(data.validity || data.days || "N/A")}
              only
            </p>

            <section class="qr-section">
              <p class="qr-label">Scan to verify</p>
              ${qrCode}
            </section>

            <section class="signature-section">
              <p class="signature-name">
                ${escapeHtml(data.doctor || "Doctor")}
              </p>

              <p class="signature-degree">
                ${escapeHtml(data.degree || "")}
              </p>

              <p class="signature-label">
                Authorized Medical Practitioner
              </p>
            </section>
          </footer>
        </main>
      </body>
    </html>
  `;
};

module.exports = generateCertificateHTML; 