const generateCertificateHTML = (data) => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <script src="https://cdn.tailwindcss.com"></script>

    <link href="https://fonts.googleapis.com/css2?family=Pacifico&display=swap" rel="stylesheet">

    <style>
      @page {
        size: A4;
        margin: 20px;
      }
    </style>
  </head>

  <body class="flex justify-center">

     <div class="bg-white w-[210mm] h-[290mm] overflow-hidden p-4 ">

      <!-- HEADER -->
           <div class="flex justify-between items-center mb-6">

        <!-- LEFT -->
        <div class="flex justify-between items-center mb-6">
          <img src="${data.doctorImage || "https://via.placeholder.com/60"}"
            class="w-14 h-14 rounded-full object-cover border-2 border-gray-300 shadow-sm" />
          <div>
            <p class="font-semibold text-sm text-gray-800">${data.doctor}</p>
            <p class="text-xs text-gray-500">${data.specialization || ""}</p>
          </div>
        </div>

        <!-- CENTER -->
        <div class="flex flex-col items-center w-[40%] text-center">
          <div class="flex items-center gap-2">
            <h1 class="text-2xl font-bold tracking-wide">
              <span class="text-blue-500">Yo</span>
              <span class="text-green-600">Doctor</span>
            </h1>

            <!-- Verified Tick -->
            <div class="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
              <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-width="3" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
          </div>

          <p class="text-xs text-gray-500 mt-1">Verified Clinic</p>
          <p class="text-sm font-semibold text-[#5d4037]">${data.clinc || ""}</p>
        </div>

        <!-- RIGHT -->
        <div class="flex justify-end items-center w-[30%]">
          <img src="${data.logo || "https://via.placeholder.com/100"}"
            class="w-20 object-contain" />
        </div>
      </div>

      <!-- META -->
      <div class="flex justify-between text-sm font-semibold mb-6 text-gray-700">
        <p>Certificate No: ${data.certificate_id}</p>
        <p>Date: ${data.date}</p>
      </div>

      <!-- TITLE -->
      <div class="text-center mb-6">
        <h2 class="text-2xl font-bold text-gray-800">MEDICAL CERTIFICATE</h2>
        <div class="w-20 h-1 bg-red-500 mx-auto mt-2"></div>
      </div>

      <!-- PHOTO -->
      <div class="flex justify-end mb-4">
        <img src="${data.patientPhoto || "https://via.placeholder.com/120"}"
          class="w-28 h-32 border-2 border-dashed rounded object-cover bg-gray-50" />
      </div>

      <!-- BODY -->
      <p class="text-gray-700 leading-relaxed mb-4">
        This is to certify that <strong>${data.patient}</strong>,
          has been examined and treated by me. The details of the patient's medical condition and treatment are provided below.
      </p>

      <!-- TABLE -->
      <table class="w-full mt-4 border border-gray-200 text-sm">
        <tbody>

          ${row("Medical Conditions", data.medical_conditions, true)}
          ${row("Certificate Type", data.certificateType)}
          ${row("Purpose", data.purpose, true)}
          ${row("Issue Date", data.issueDate)}
          ${row("Date Of Birth", data.dob, true)}
          ${row("Gender", data.gender)}
          ${row("Doctor's Notes", data.notes, true)}
          ${row("Treatment", data.treatment)}
          ${row("Medicines", data.medicines, true)}

        </tbody>
      </table>

      <!-- RECOMMENDATION -->
      <div class="mt-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded text-sm text-gray-700">
        The patient is advised rest from 
        <strong>${data.issueDate}</strong> to 
        <strong>${data.expiryDate}</strong>
        (Total <strong>${data.days} days</strong>).
      </div>

      <!-- FOOTER -->
      <div class="mt-10 flex justify-between items-end">

        <p class="text-xs text-red-500 italic">
          * Valid for ${data.days}  only
        </p>

        <!-- QR -->
        <div class="text-center">
          <p class="text-xs text-gray-500">Scan to verify</p>
          <img src="${data.qr}" class="w-20 h-20 mx-auto" />
        </div>

        <!-- SIGN -->
        <div class="text-right">
          <p style="font-family: Pacifico" class="text-lg">${data.doctor}</p>
          <p class="text-sm">${data.degree || ""}</p>
        </div>

      </div>

    </div>

  </body>
  </html>
  `;
};

// reusable rows
const row = (title, value, gray = false) => `
<tr class="${gray ? "bg-gray-50" : ""}">
  <td class="p-3 font-semibold w-1/3">${title}</td>
  <td class="p-3">${value || "-"}</td>
</tr>
`;

module.exports = generateCertificateHTML;