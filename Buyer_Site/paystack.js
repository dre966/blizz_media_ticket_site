// paystack.js
import PaystackPop from '@paystack/inline-js'

// ─── Element refs ─────────────────────────────────────────────────────
const radioButtons = document.getElementsByName('package');
const amountInput  = document.getElementById('amount');
const Vip          = document.getElementById('vip');
const regular      = document.getElementById('reg');
const form         = document.getElementById('paymentForm');
const guestType    = document.getElementById('guesttype');
const dynamicGroup = document.getElementById('form-group');
const stack = new PaystackPop();
const key = import.meta.env.VITE_API_KEY;

// assign default package values
regular.value = '100';
Vip.value     = '200';


// ─── Recalculate amount & inject name fields ─────────────────────────
function updateAmountAndFields() {
  // 1. Base price from checked radio (100 or 200)
  const base  = parseInt(
    document.querySelector('input[name="package"]:checked').value,
    10
  );
  // 2. Add ₵80 if “couple”, else add 0
  if(guestType.value === 'couple'){
    amountInput.value = (base*2)-20
  }else{
    amountInput.value = base
  }

  // 3. Inject the correct set of name fields
  if (guestType.value === 'couple') {
    dynamicGroup.innerHTML = `
      <label for="first-name">Your First Name*</label>
      <input type="text" id="first-name" required />

      <label for="last-name">Your Last Name*</label>
      <input type="text" id="last-name" required />

      <label for="p-first-name">Partner’s First Name*</label>
      <input type="text" id="p-first-name" required />

      <label for="p-last-name">Partner’s Last Name*</label>
      <input type="text" id="p-last-name" required />
    `;
  } else {
    dynamicGroup.innerHTML = `
      <label for="first-name">First Name*</label>
      <input type="text" id="first-name" required />

      <label for="last-name">Last Name*</label>
      <input type="text" id="last-name" required />
    `;
  }
}

// seed on load & wire listeners
window.addEventListener('DOMContentLoaded', () => {
  // default to Regular if nothing’s checked
  const checked =
    document.querySelector('input[name="package"]:checked') ||
    regular;
  checked.checked = true;
  updateAmountAndFields();
});

radioButtons.forEach(r => r.addEventListener('change', updateAmountAndFields));
guestType.addEventListener('change', updateAmountAndFields);

// ─── Disable right-click ─────────────────────────────────────────────
// Place this at the top of your main JS file

window.addEventListener('keydown', function (event) {
  // Normalize key and modifier flags
  const key = event.key.toLowerCase();
  const ctrl = event.ctrlKey;
  const shift = event.shiftKey;
  const alt = event.altKey;
  const meta = event.metaKey; // for Mac ⌘

  // Conditions for blocking
  const isF12      = key === 'f12';
  const isCtrlU    = ctrl && key === 'u';
  const isCtrlShiftI = ctrl && shift && key === 'i';
  const isCtrlShiftJ = ctrl && shift && key === 'j';
  const isCtrlShiftC = ctrl && shift && key === 'c';
  const isCmdOptI  = meta && alt && key === 'i';  // Mac: ⌘+⌥+I

  if (
    isF12 ||
    isCtrlU ||
    isCtrlShiftI ||
    isCtrlShiftJ ||
    isCtrlShiftC ||
    isCmdOptI
  ) {
    event.preventDefault();
    event.stopPropagation();
    return false;
  }
});

// Optional: disable right-click context menu
window.addEventListener('contextmenu', function (event) {
  event.preventDefault();
});


// ─── Phone validation ───────────────────────────────────────────────
function validatePhoneNumber() {
  const val = document.getElementById('numberBox').value;
  const pattern = /^(\+233|233|0)?\d{9}$/;
  if (!pattern.test(val)) {
    alert('Invalid phone number format');
    return false;
  }
  return true;
}


// ─── Modal logic unchanged ───────────────────────────────────────────

function showModal(title, message, reference = null, redirectURL = null) {
  const modal = document.getElementById('success-modal');
  const modalTitle = modal.querySelector('h2');
  const modalText = modal.querySelector('#custom-text');
  const refInput = modal.querySelector('#transaction-ref');
  const copyBtn = modal.querySelector('#copy-ref');
  const link = modal.querySelector('.link');
  const closeBtn = modal.querySelector('.close-btn');

  // 🔧 keep this one
  modal.style.display = 'flex';  // centers content

  modalTitle.textContent = title || "Notification";
  modalText.innerHTML = message;

  if (reference) {
    refInput.value = reference;
    copyBtn.style.display = 'inline-block';
  } else {
    refInput.value = '';
    copyBtn.style.display = 'none';
  }

  if (redirectURL) {
    link.href = redirectURL;
    link.style.display = 'inline-block';
  } else {
    link.style.display = 'none';
  }

  // 🗑 remove this line (it ruins centering)
  // modal.style.display = 'block';
  
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(refInput.value);
    alert("Reference copied!");
  };

  closeBtn.onclick = () => {
    modal.style.display = 'none';
  };

  window.onclick = (event) => {
    if (event.target === modal) modal.style.display = 'none';
  };
}


// ─── Paystack integration ────────────────────────────────────────────
async function payWithPaystack() {
  if (!validatePhoneNumber()) return;

  // Collect common fields
  const email     = document.getElementById('email-address').value.trim();
  const firstName = document.getElementById('first-name').value.trim();
  const lastName  = document.getElementById('last-name').value.trim();
  const phone     = document.getElementById('numberBox').value.trim();
  const amount    = parseInt(amountInput.value, 10) * 100;
  const reference = 'BLIZZ-' + Date.now();

  // Safely collect partner names
  const isCouple = guestType.value === 'couple';
  let pFirst = '', pLast = '';
  if (isCouple) {
    pFirst = document.getElementById('p-first-name').value.trim();
    pLast  = document.getElementById('p-last-name').value.trim();
  }

  // Build your custom_fields array
const customFields = [
  { display_name: 'Ticket Type', variable_name: 'package_type', value: guestType.value }, // single/couple
  { display_name: 'Tier', variable_name: 'tier', value: Vip.checked ? 'vip' : 'regular' },
  { display_name: 'First Name', variable_name: 'first_name', value: firstName },
  { display_name: 'Last Name', variable_name: 'last_name', value: lastName },
  { display_name: 'Phone Number', variable_name: 'phone_number', value: phone }
];

  if (isCouple) {
    customFields.push(
      { display_name: 'Partner’s First Name', variable_name: 'partner_first_name', value: pFirst },
      { display_name: 'Partner’s Last Name',  variable_name: 'partner_last_name',  value: pLast }
    );
  }
  customFields.push(
    { display_name: 'Phone Number', variable_name: 'phone_number', value: phone }
  );

  // Initialize Paystack
  const handler = stack.newTransaction({
    key: key,
    email,
    subaccountCode:'ACCT_a1s5cclfw41xh5e',
    amount,
    currency: 'GHS',
    ref: reference,
    metadata: { custom_fields: customFields },
    callback(response){
      const ref = response.reference;
      const ticketURL = `https://blizzticky-getyours.netlify.app?ref=${response.reference}`;

      // Build message dynamically
      const msg = `
      Payment successful!<br><br>
      We'll now take you to your ticket page .<br>
      If you’d rather go manually, copy your reference below.
      `;

      // Show modal
      showModal("Payment Successful!", msg, ref, ticketURL);

      // Auto-redirect after short delay (if user doesn’t cancel)
      setTimeout(() => {
        window.location.href = ticketURL;
      }, 5000); // 5 seconds delay for them to read/copy
      },
    onClose(){ alert('Payment cancelled.'); }
  });
}



document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('paymentForm');

  form.addEventListener('submit', function (e) {
    e.preventDefault(); // 💥 Stops page reload
    payWithPaystack();  // Your custom function
  });
});
