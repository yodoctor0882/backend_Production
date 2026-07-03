const generateQRHTML = ({
  doctorName,
  specialization,
  qr,
  doctorImage,
  logo,
  clinic,
}) => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <script src="https://cdn.tailwindcss.com"></script>

    <!-- FONT -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

    <style>
      body {
        font-family: 'Inter', sans-serif;
        background-color: #f3f4f6;
      }

      @page {
        size: A4;
        margin: 10px;
      }

      .brown-accent { background:#5d4037; }
      .brown-border { border-color:#5d4037; }
      .brown-text { color:#5d4037; }
    </style>
  </head>

  <body class="flex justify-center ">

    <div class="bg-white w-[210mm] h-[290mm] overflow-hidden p-4 ">

      <!-- HEADER -->
      <div class="flex justify-between items-center mb-6">

        <div class="flex items-center gap-3 w-[30%]">
          <img src="${doctorImage}" class="w-14 h-14 rounded-full object-cover border"/>
          <div>
            <p class="font-semibold text-sm text-gray-800">${doctorName}</p>
            <p class="text-xs text-gray-500">${specialization || ""}</p>
          </div>
        </div>

        <div class="flex flex-col items-center w-[40%] text-center">
          <div class="flex items-center gap-2">
            <h1 class="text-2xl font-bold">
              <span class="text-blue-500">Yo</span>
              <span class="text-green-600">Doctor</span>
            </h1>

            <div class="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
              <svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-width="3" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
          </div>

          <p class="text-xs text-gray-500 mt-1">Verified Clinic</p>
          <p class="text-sm font-semibold text-[#5d4037]">${clinic || ""}</p>
        </div>

       <div class="w-[35%] flex justify-end">
    <img src="${logo}" class="w-20 object-contain"/>
  </div>


      </div>

      <hr class="border-gray-300 my-2"/>

      <!-- GREETING -->
      <div class="mb-5">
        <h2 class="text-2xl font-bold text-gray-800">Hey User,</h2>
        <p class="text-gray-600 mt-2">
          Thank you for choosing 
          <span class="font-semibold text-[#5d4037]">YoDoctor Healthcare System</span>.
          Please follow the steps below to book your appointment and generate your token.
        </p>
      </div>

      <!-- STEPS -->
      <div class="border brown-border rounded-xl overflow-hidden mb-5">

        <div class="brown-accent px-4 py-2 text-white font-semibold text-sm">
          How to Book Your Appointment
        </div>

        <div class="p-5 space-y-4 text-sm text-gray-700">

          <div class="flex gap-3"><span>📱</span><p>Open the YoDoctor App or website.</p></div>

          <div class="flex gap-3"><span>📷</span><p>Go to the Scanner and scan the QR code.</p></div>

          <div class="flex gap-3"><span>🌐</span><p>You will be redirected to the booking page.</p></div>

          <div class="flex gap-3"><span>👤</span><p>If not logged in, please login or create an account.</p></div>

          <div class="flex gap-3"><span>👨‍👩‍👧</span><p>Select Self or Family Member.</p></div>

          <div class="flex gap-3 items-center">
            <span>✔️</span>
            <p>
              Click 
              <span class="bg-green-600 text-white px-3 py-1 rounded-md font-semibold shadow-sm">
                Confirm Booking
              </span>
            </p>
          </div>

          <div class="flex gap-3"><span>🎫</span><p>You will receive your appointment token.</p></div>

        </div>

      </div>

      <!-- QR -->
      <div class="flex flex-col items-center ">

        <p class="text-base font-semibold text-gray-600 uppercase tracking-wider mb-2">
          SCAN TO BOOK APPOINTMENT
        </p>

        <div class="p-2 border-2 brown-border rounded-2xl shadow-md">
          <img src="${qr}" style="width:280px; height:280px;" />
        </div>

        <p class="text-xs text-gray-500 my-3 text-center">
          Use YoDoctor App to scan and continue booking
        </p>
      </div>

      <!-- SUPPORT -->
      <div class="max-w-sm mx-auto border brown-border rounded-lg overflow-hidden mb-10">

        <div class="brown-accent px-3 py-1 text-white text-xs text-center font-semibold uppercase">
          Support
        </div>

        <div class="p-3 bg-orange-50/20">
          <div class="flex justify-between text-xs text-gray-600">

            <div class="flex flex-col items-center gap-1">
              <span>🎧</span>
              <span>24x7</span>
            </div>

            <div class="flex flex-col items-center gap-1">
              <span>⚡</span>
              <span>Fast</span>
            </div>

            <div class="flex flex-col items-center gap-1">
              <span>🌐</span>
              <span>Multi</span>
            </div>

          </div>
        </div>

      </div>

      <!-- FOOTER -->
      <div class="absolute bottom-4 left-8 right-8 flex justify-between items-end">

        <div>
           <a 
    href="https://www.yodoctor.in/" 
    target="_blank"
    style="color:#2563EB; text-decoration:none; font-size:14px;"
  >
    https://www.yodoctor.in/
  </a>

        </div>

        <div class="text-center w-48">
          <div class="border-t-2 border-gray-800 mb-1"></div>
          <p class="text-xs font-bold uppercase">
            Signature of Authority
          </p>
        </div>

      </div>

    </div>

  </body>
  </html>
  `;
};

module.exports = generateQRHTML;
