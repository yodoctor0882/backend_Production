const escapeHtml = (value) => {
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const formatDate = (date) => {
  if (!date) return "--";

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) return "--";

  return d.toLocaleDateString("en-GB");
};

const generatePrescriptionHTML = (prescription) => {
  const patient = prescription.patient || {};

  const doctor = {
    name: prescription.doctor_name || "Doctor",
    specialization: prescription.doctor_specialization || "",
    registration: prescription.doctor_registration || "",
    degree: prescription.doctor_degree || "",
    qualification: prescription.doctor_qualification || "",
  };

  const clinic = {
    name: prescription.clinic_name || "Clinic",
    tagline: "Your Health. Our Priority",
    address: prescription.clinic_address || "",
    city: prescription.clinic_city || "",
    state: prescription.clinic_state || "",
    pincode: prescription.clinic_pincode || "",
  };

  const medicines = Array.isArray(prescription.medicines)
    ? prescription.medicines
    : [];

  const tests = Array.isArray(prescription.tests) ? prescription.tests : [];

  const advice = Array.isArray(prescription.advice) ? prescription.advice : [];

  return `
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />

  <script src="https://cdn.tailwindcss.com"></script>

  <style>

    @page {
      size: A4;
      margin: 10mm;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #f1f5f9;
      font-family: Arial, Helvetica, sans-serif;
      color: #334155;
    }

    * {
      box-sizing: border-box;
    }

    body {
      display: flex;
      justify-content: center;
    }

    .prescription-paper {
      width: 210mm;
      min-height: 277mm;
      background: white;
      padding: 8mm;
      margin: 0 auto;
    }

    .clinic-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
    }

    .clinic-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .medical-symbol {
      width: 56px;
      height: 64px;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 42px;
      font-weight: 700;
      color: #1d4ed8;
    }

    .clinic-name {
      margin: 0;
      font-size: 24px;
      line-height: 1.2;
      font-weight: 700;
      color: #1d4ed8;
    }

    .clinic-tagline {
      margin-top: 5px;
      font-size: 12px;
      color: #64748b;
    }

    .clinic-address {
      text-align: right;
      font-size: 11px;
      line-height: 1.6;
      color: #475569;
    }

    .divider-dark {
      border-top: 1px solid #64748b;
      margin: 16px 0;
    }

    .divider-light {
      border-top: 1px solid #94a3b8;
      margin: 16px 0;
    }

    .doctor-section {
      display: flex;
      justify-content: space-between;
      gap: 20px;
    }

    .doctor-name {
      font-size: 16px;
      font-weight: 700;
      color: #1e293b;
      margin: 0;
    }

    .doctor-info {
      margin-top: 5px;
      font-size: 11px;
      color: #475569;
      line-height: 1.5;
    }

    .appointment-info {
      text-align: right;
      font-size: 12px;
      color: #1e293b;
      line-height: 1.8;
    }

    .appointment-info strong {
      font-weight: 700;
    }

    .patient-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      font-size: 12px;
    }

    .patient-row {
      display: grid;
      grid-template-columns: 110px 15px 1fr;
      margin-bottom: 8px;
    }

    .patient-label {
      font-weight: 700;
      color: #1e293b;
    }

    .rx-title {
      font-size: 24px;
      line-height: 1;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 10px;
    }

    .medicine-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 8px;
    }

    .medicine-table th,
    .medicine-table td {
      border: 1px solid #cbd5e1;
      padding: 7px 5px;
      text-align: left;
      vertical-align: top;
      word-break: break-word;
    }

    .medicine-table th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
    }

    .medicine-table td {
      color: #334155;
    }

    .medicine-table th:nth-child(1) {
      width: 4%;
    }

    .medicine-table th:nth-child(2) {
      width: 19%;
    }

    .medicine-table th:nth-child(3) {
      width: 10%;
    }

    .medicine-table th:nth-child(4) {
      width: 9%;
    }

    .medicine-table th:nth-child(5) {
      width: 13%;
    }

    .medicine-table th:nth-child(6) {
      width: 11%;
    }

    .medicine-table th:nth-child(7) {
      width: 12%;
    }

    .medicine-table th:nth-child(8) {
      width: 22%;
    }

    .section {
      margin-top: 20px;
    }

    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 8px;
    }

    .section-list {
      margin: 0;
      padding-left: 20px;
      font-size: 10px;
      line-height: 1.7;
      color: #334155;
    }

    .follow-up {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 20px;
      font-size: 12px;
      color: #334155;
    }

    .follow-up strong {
      color: #1e293b;
    }

    .signature-section {
      margin-top: 45px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .signature {
      width: 208px;
      text-align: center;
      font-size: 11px;
      color: #334155;
    }

    .signature-name {
      font-weight: 700;
      color: #1e293b;
    }

    .signature-qualification {
      margin-top: 5px;
    }

    .footer {
      margin-top: 30px;
      display: flex;
      align-items: center;
      gap: 20px;
      font-size: 11px;
      color: #1e293b;
    }

    .footer-line {
      flex: 1;
      border-top: 1px solid #64748b;
    }

    .footer-text {
      font-weight: 700;
      white-space: nowrap;
    }

    .empty-message {
      font-size: 11px;
      color: #64748b;
      padding: 8px 0;
    }

    @media print {

      html,
      body {
        background: white !important;
      }

      .prescription-paper {
        margin: 0;
        padding: 0;
        width: 100%;
        min-height: auto;
      }
    }

  </style>
</head>

<body>

  <div class="prescription-paper">

    <!-- ================================= -->
    <!-- CLINIC HEADER -->
    <!-- ================================= -->

    <div class="clinic-header">

      <div class="clinic-left">

        <div class="medical-symbol">
          🩺
        </div>

        <div>

          <h1 class="clinic-name">
            ${escapeHtml(clinic.name)}
          </h1>

          <p class="clinic-tagline">
            ${escapeHtml(clinic.tagline)}
          </p>

        </div>

      </div>

      <div class="clinic-address">

        ${clinic.address ? `<div>${escapeHtml(clinic.address)}</div>` : ""}

        ${clinic.city ? `<div>${escapeHtml(clinic.city)}</div>` : ""}

        ${clinic.state ? `<div>${escapeHtml(clinic.state)}</div>` : ""}

        ${clinic.pincode ? `<div>${escapeHtml(clinic.pincode)}</div>` : ""}

      </div>

    </div>


    <div class="divider-dark"></div>


    <!-- ================================= -->
    <!-- DOCTOR -->
    <!-- ================================= -->

    <div class="doctor-section">

      <div>

        <h2 class="doctor-name">
          ${escapeHtml(doctor.name)}
        </h2>

        ${
          doctor.specialization
            ? `
              <p class="doctor-info">
                ${escapeHtml(doctor.specialization)}
              </p>
            `
            : ""
        }

        ${
          doctor.degree
            ? `
              <p class="doctor-info">
                ${escapeHtml(doctor.degree)}
              </p>
            `
            : ""
        }

        ${
          doctor.registration
            ? `
              <p class="doctor-info">
                ${escapeHtml(doctor.registration)}
              </p>
            `
            : ""
        }

      </div>


      <div class="appointment-info">

        <div>
          <strong>Date:</strong>
          ${escapeHtml(formatDate(prescription.appointment_date))}
        </div>

        <div>
          <strong>Slot:</strong>
          ${escapeHtml(prescription.appointment_slot || "--")}
        </div>

      </div>

    </div>


    <div class="divider-light"></div>


    <!-- ================================= -->
    <!-- PATIENT DETAILS -->
    <!-- ================================= -->

    <div class="patient-grid">

      <div>

        <div class="patient-row">
          <span class="patient-label">Patient Name</span>
          <span>:</span>
          <span>${escapeHtml(patient.name || "--")}</span>
        </div>

        <div class="patient-row">
          <span class="patient-label">Patient ID</span>
          <span>:</span>
          <span>${escapeHtml(patient.id || "--")}</span>
        </div>

      </div>


      <div>

        <div class="patient-row">
          <span class="patient-label">Age / Gender</span>
          <span>:</span>

          <span>
            ${escapeHtml(patient.age || "--")}
            /
            ${escapeHtml(patient.gender || "--")}
          </span>

        </div>

        <div class="patient-row">
          <span class="patient-label">Phone No.</span>
          <span>:</span>
          <span>${escapeHtml(patient.phone || "--")}</span>
        </div>

      </div>

    </div>


    <div class="divider-dark"></div>


    <!-- ================================= -->
    <!-- RX -->
    <!-- ================================= -->

    <div class="rx-title">
      Rₓ
    </div>


    <!-- ================================= -->
    <!-- MEDICINES -->
    <!-- ================================= -->

    ${
      medicines.length > 0
        ? `
          <table class="medicine-table">

            <thead>

              <tr>

                <th>#</th>

                <th>
                  Medicine Name
                </th>

                <th>
                  Strength
                </th>

                <th>
                  Dose
                </th>

                <th>
                  Frequency
                </th>

                <th>
                  Timing
                </th>

                <th>
                  Duration
                </th>

                <th>
                  Instruction
                </th>

              </tr>

            </thead>


            <tbody>

              ${medicines
                .map(
                  (medicine, index) => `
                    <tr>

                      <td>
                        ${index + 1}
                      </td>

                      <td>
                        <strong>
                          ${escapeHtml(
                            medicine.medicine_name || medicine.name || "--",
                          )}
                        </strong>
                      </td>

                      <td>
                        ${escapeHtml(medicine.strength || "--")}
                      </td>

                      <td>
                        ${escapeHtml(medicine.dose || "--")}
                      </td>

                      <td>
                        ${escapeHtml(medicine.frequency || "--")}
                      </td>

                      <td>
                        ${escapeHtml(medicine.timing || "--")}
                      </td>

                      <td>
                        ${escapeHtml(medicine.duration || "--")}
                      </td>

                      <td>
                        ${escapeHtml(medicine.instruction || "--")}
                      </td>

                    </tr>
                  `,
                )
                .join("")}

            </tbody>

          </table>
        `
        : `
          <div class="empty-message">
            No medicines prescribed.
          </div>
        `
    }


    <!-- ================================= -->
    <!-- INVESTIGATIONS -->
    <!-- ================================= -->

    ${
      tests.length > 0
        ? `
          <div class="section">

            <div class="section-title">
              Investigations:
            </div>

            <ol class="section-list">

              ${tests
                .map((test) => {
                  const text =
                    typeof test === "string"
                      ? test
                      : test.test_name || test.name || "--";

                  const remarks =
                    typeof test === "object" && test.remarks
                      ? ` — ${test.remarks}`
                      : "";

                  return `
                    <li>
                      ${escapeHtml(text)}
                      ${escapeHtml(remarks)}
                    </li>
                  `;
                })
                .join("")}

            </ol>

          </div>
        `
        : ""
    }


    <!-- ================================= -->
    <!-- ADVICE -->
    <!-- ================================= -->

    ${
      advice.length > 0
        ? `
          <div class="section">

            <div class="section-title">
              Advice:
            </div>

            <ul class="section-list">

              ${advice
                .map((item) => {
                  const text =
                    typeof item === "string"
                      ? item
                      : item.text || item.advice || "--";

                  return `
                    <li>
                      ${escapeHtml(text)}
                    </li>
                  `;
                })
                .join("")}

            </ul>

          </div>
        `
        : ""
    }


    <!-- ================================= -->
    <!-- FOLLOW UP -->
    <!-- ================================= -->

    ${
      prescription.follow_up_after ||
      prescription.follow_up_date ||
      prescription.follow_up_notes
        ? `
          <div class="follow-up">

            <strong>
              Follow-up:
            </strong>

            ${
              prescription.follow_up_after
                ? `
                  <span>
                    After ${escapeHtml(prescription.follow_up_after)}
                  </span>
                `
                : ""
            }

            ${
              prescription.follow_up_date
                ? `
                  <span>
                    Date:
                    ${escapeHtml(formatDate(prescription.follow_up_date))}
                  </span>
                `
                : ""
            }

            ${
              prescription.follow_up_notes
                ? `
                  <span>
                    Note:
                    ${escapeHtml(prescription.follow_up_notes)}
                  </span>
                `
                : ""
            }

          </div>
        `
        : ""
    }


    <!-- ================================= -->
    <!-- SIGNATURE -->
    <!-- ================================= -->

    <div class="signature-section">

      <div></div>

      <div class="signature">

        <div class="signature-name">
          ${escapeHtml(doctor.name)}
        </div>

        ${
          doctor.specialization || doctor.degree
            ? `
              <div class="signature-qualification">
                ${escapeHtml(doctor.specialization || doctor.degree)}
              </div>
            `
            : ""
        }

      </div>

    </div>


    <!-- ================================= -->
    <!-- FOOTER -->
    <!-- ================================= -->

    <div class="footer">

      <div class="footer-line"></div>

      <div class="footer-text">
        Get Well Soon!
      </div>

      <div class="footer-line"></div>

    </div>

  </div>

</body>

</html>
`;
};

module.exports = generatePrescriptionHTML;