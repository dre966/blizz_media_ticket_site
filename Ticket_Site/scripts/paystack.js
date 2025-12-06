// ── GLOBAL VARS ─────────────────────────────────────────────
let lastEncryptedCode = '';            // store QR payload for primary
let lastEncryptedCodePartner = '';     // store QR payload for partner
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import { getDatabase, ref, push, set, get} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js';

// ── POPUP SETUP ─────────────────────────────────────────────
const popup        = document.getElementById('popup');
const popupIcon    = document.getElementById('popup-icon');
const popupMessage = document.getElementById('popup-message');

const firebaseConfig = {
  apiKey: "AIzaSyAhYSwtW8SqluMpje6Xrua1P6x1KOWvhKU",
  authDomain: "blizzticky-buy.firebaseapp.com",
  projectId: "blizzticky-buy",
  storageBucket: "blizzticky-buy.firebasestorage.app",
  messagingSenderId: "252455914592",
  appId: "1:252455914592:web:241e407c5070b30cedc705",
  measurementId: "G-MCX7MF7RJC"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const PRICE_MAP = {
  single: { regular: 100, vip: 200 },
  couple: { regular: 180, vip: 380 }
};
                     

function showPopup(state, message, time) {
  popupIcon.className       = `popup-icon ${state}`;
  popupMessage.textContent  = message;
  popup.style.display       = 'flex';
  popup.style.flexDirection = 'column';
  if(time == null){time = 2000}
  if (state !== 'load') {
    setTimeout(() => { popup.style.display = 'none'; }, time);
  }
}

// ── ELEMENT REFERENCES ──────────────────────────────────────
const nameOnTicket    = document.getElementById('name');
const buyerEmail      = document.getElementById('email');
const buyerNumber     = document.getElementById('number');
const codePara        = document.getElementById('code');
const ticketBox       = document.getElementById('ticketBox');
const purchaseInfo    = document.getElementById('purch');
const paymentInfoEl   = document.getElementById('payment-info');
const qrContainer     = document.createElement('div');
qrContainer.className = 'qr';
document.getElementById('qrcode').appendChild(qrContainer);

const generateBtn     = document.getElementById('generate-ticket');
const downloadPngBtn  = document.getElementById('download-ticket');
const downloadPdfBtn  = document.getElementById('download-pdf');

const input = document.querySelector('#ref')


// ── VERIFY PAYMENT & RENDER ─────────────────────────────────
async function verifyPayment(reference) {
  showPopup('load', 'Verifying payment…');

  try {
    // Call your Netlify Function
    const res = await fetch('/.netlify/functions/verifyPayment', {
      method: 'POST',
      body: JSON.stringify({ reference })
    });
    const json = await res.json();

    if (!json.status) {
      showPopup('error', json.message,3000);
      setTimeout(()=>showPopup('info', " Contact 0502385737 if you need help", 6000),3200)
      return;
    }

    showPopup('success', 'Payment verified');

    // remove old clones
    document.querySelectorAll('.clone').forEach(el => el.remove());

    // extract data
    const data = json.data;
    const paidAt = new Date(data.paidAt);

    // --- PATCH MISSING METADATA ---
    const cf = data.metadata?.custom_fields || [];

    // Look for tier and package_type fields
    let tierField = cf.find(f => f.variable_name === 'tier');
    let packageField = cf.find(f => f.variable_name === 'package_type');

    // Retroactively assign if missing
    if (!tierField || !packageField) {
      const amount = data.amount / 100; // convert kobo → cedis
      let tier = '', ticketType = '';

      switch (amount) {
        case 100:
          ticketType = 'single';
          tier = 'regular';
          break;
        case 180:
          ticketType = 'couple';
          tier = 'regular';
          break;
        case 200:
          ticketType = 'single';
          tier = 'vip';
          break;
        case 380:
          ticketType = 'couple';
          tier = 'vip';
          break;
        default:
          ticketType = 'unknown';
          tier = 'unknown';
      }

      if (!tierField) cf.push({ display_name: 'Tier', variable_name: 'tier', value: tier });
      if (!packageField) cf.push({ display_name: 'Package Type', variable_name: 'package_type', value: ticketType });

      console.log(`Patched old transaction ${data.reference} with tier: ${tier}, package: ${ticketType}`);
    }

    // Map cf array into an object for easy access
    const cfMap = cf.reduce((acc, f) => { acc[f.variable_name] = f.value; return acc; }, {});

    // --- PRICE VERIFICATION ---
    const ticketType = cfMap.package_type;
    const tier = cfMap.tier;
    const expectedPrice = PRICE_MAP[ticketType]?.[tier];
    const paidAmount = data.amount / 100;

    if (expectedPrice !== paidAmount) {
      showPopup('error', `Nice Try! Paid ₵${paidAmount}, expected ₵${expectedPrice}`);
      return;
    }

    // --- NAMES & PHONE ---
    const primaryName = `${cfMap.first_name} ${cfMap.last_name}`;
    const partnerName = cfMap.partner_first_name
      ? `${cfMap.partner_first_name} ${cfMap.partner_last_name}`
      : '';
    const phone = cfMap.phone_number || data.customer.phone;

    // --- TICKET ID ---
    const payref = data.reference.toString().slice(6);
    const ticketID = `BM - ${(parseFloat(data.id) + Number(payref)).toString().slice(-6)}`;

    // --- RENDER MAIN TICKET ---
    codePara.textContent = ticketID;
    nameOnTicket.textContent = primaryName;
    buyerEmail.textContent = data.customer.email;
    buyerNumber.textContent = formatGhanaPhone(phone);
    purchaseInfo.textContent = `Purchased at ${paidAt.toLocaleString()}`;
    setTicketTypeStyle(data.amount);

    displayPaymentDetails(data, paidAt, primaryName, partnerName, phone);

    // --- ENCRYPT & STORE PRIMARY ---
    const info = { key: ticketID, name: primaryName, number: phone, email: data.customer.email };
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(info), 'Made_By_BM').toString();
    lastEncryptedCode = encrypted;

    const dbPath = `${primaryName}'s ticket ID ${ticketID.slice(-6)}`;
    await checkAndAddToDatabase(dbPath, { code: info }).catch(() => {});

    // --- GENERATE QR ---
    generateQR(encrypted);

    // --- DOUBLE TICKET FOR COUPLE ---
    if (paidAmount === 180 || paidAmount === 380) {
      const partnerInfo = { key: ticketID, name: partnerName, number: phone, email: data.customer.email };
      const encryptedPartner = CryptoJS.AES.encrypt(JSON.stringify(partnerInfo), 'Made_By_BM').toString();
      lastEncryptedCodePartner = encryptedPartner;

      const partnerDbPath = `${partnerName}'s ticket ID ${ticketID.slice(-6)}`;
      await checkAndAddToDatabase(partnerDbPath, { code: partnerInfo }).catch(() => {});

      const second = ticketBox.cloneNode(true);
      second.classList.add('clone');
      ticketBox.parentNode.appendChild(second);

      second.querySelector('#name').textContent = partnerName;
      const cloneQR = second.querySelector('.qr');
      cloneQR.innerHTML = '';
      new QRCode(cloneQR, {
        width: 170,
        height: 170,
        colorDark: 'black',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      }).makeCode(encryptedPartner);
    }

  } catch (err) {
    console.error(err);
    showPopup('error', 'Network or server error');
  }
}



// ── PAYMENT INFO RENDERER ─────────────────────────────────
function displayPaymentDetails(data, dateObj, primaryName, partnerName, phone) {
  let holders = `<p>Ticket Holder(S): ${primaryName}`;
  if (partnerName) holders += `, ${partnerName}`;
  holders += `</p>`;

  paymentInfoEl.innerHTML = `
    ${holders}
    <p>Customer Email: ${data.customer.email}</p>
    <p>Payment Amount: ₵${(data.amount/100).toFixed(2)}</p>
    <p>Payment Number: ${phone}</p>
    <p>Payment Reference: ${data.reference}</p>
    <p>Payment ID: ${data.id}</p>
    <p>Payment Time: ${dateObj.toString()}</p>
  `;
}


// ── UTILS ──────────────────────────────────────────────────
function formatGhanaPhone(raw) {
  const cleaned = raw.replace(/\D/g, '');
  return `+233 ${cleaned.slice(1,4)} ${cleaned.slice(4,7)} ${cleaned.slice(7,10)}`;
}

function setTicketTypeStyle(amountInKobo) {
  const price = (amountInKobo / 100).toFixed(2);
  const tLabel = document.getElementById('tictype');

  if (+price === 200 || +price === 380) {
    tLabel.textContent = 'V.I.P';
    document.getElementById('style').href = 'style.css';
    ticketBox.style.backgroundImage = 'url("./assets/Layer 2.png")';
  } else {
    tLabel.textContent = 'REGULAR';
    document.getElementById('style').href = 'regular.css';
    ticketBox.style.backgroundImage = 'url("./assets/Prism Overlays 7 copy.png")';
  }
}

function generateQR(payload) {
  qrContainer.innerHTML = '';
  new QRCode(qrContainer, {
    width: 170,
    height: 170,
    colorDark: 'black',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  }).makeCode(payload);
}


// ── DATABASE HELPERS ───────────────────────────────────────
async function checkAndAddToDatabase(key, data) {
  showPopup('load', 'Checking database…');
  const usedRef   = ref(db, `Used/${key}`);
  const unusedRef = ref(db, `Unused/${key}`);

  try {
    const usedSnap   = await get(usedRef);
    if (usedSnap.exists()) {
      showPopup('info', 'Ticket already marked used');
      return usedSnap.val();
    }
    const unusedSnap = await get(unusedRef);
    if (unusedSnap.exists()) {
      showPopup('info', 'Ticket already generated');
      return unusedSnap.val();
    }
    await set(unusedRef, data);
    showPopup('success', 'Ticket saved');
    return data;
  } catch (err) {
    console.error(err);
    showPopup('error', 'DB operation failed');
    throw err;
  }
}


// ── SNAPSHOT WRAPPER ───────────────────────────────────────
function createSnapshotWrapper(element) {
  const wrapper = document.createElement('div');
  const styles  = getComputedStyle(document.body);
  wrapper.style.background     = styles.background;
  wrapper.style.padding        = '30px';
  wrapper.style.display        = 'flex';
  wrapper.style.justifyContent = 'center';
  wrapper.style.alignItems     = 'center';
  wrapper.style.position       = 'absolute';
  wrapper.style.top            = '-9999px';
  wrapper.style.left           = '-9999px';

  const clone = element.cloneNode(true);
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);
  return wrapper;
}


// ── DOWNLOAD HELPERS ───────────────────────────────────────

// Download any single element as PNG
function downloadElementAsPNG(element, encryptedCode, fileName) {
  return new Promise((resolve, reject) => {
    const wrapper = createSnapshotWrapper(element);
    const qrEl    = wrapper.querySelector('.qr');

    if (qrEl && encryptedCode) {
      qrEl.innerHTML = '';
      new QRCode(qrEl, {
        width: 170, height: 170,
        colorDark: 'black', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      }).makeCode(encryptedCode);
    }

    html2canvas(wrapper, { scale: 2 })
      .then(canvas => {
        const link    = document.createElement('a');
        link.href     = canvas.toDataURL('image/png');
        link.download = fileName;
        link.click();
        document.body.removeChild(wrapper);
        resolve();
      })
      .catch(err => {
        document.body.removeChild(wrapper);
        reject(err);
      });
  });
}

// Download any single element as PDF
function downloadElementAsPDF(element, encryptedCode, fileName) {
  return new Promise((resolve, reject) => {
    const wrapper = createSnapshotWrapper(element);
    const qrEl    = wrapper.querySelector('.qr');

    if (qrEl && encryptedCode) {
      qrEl.innerHTML = '';
      new QRCode(qrEl, {
        width: 170, height: 170,
        colorDark: 'black', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      }).makeCode(encryptedCode);
    }

    html2canvas(wrapper, { scale: 2 })
      .then(canvas => {
        const imgData   = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf       = new jsPDF({
          orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [canvas.width, canvas.height]
        });
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(fileName);
        document.body.removeChild(wrapper);
        resolve();
      })
      .catch(err => {
        document.body.removeChild(wrapper);
        reject(err);
      });
  });
}

// Driver: download primary, then partner (if any)
function downloadAsPNG() {
  showPopup('load', 'Preparing download…');

  const tasks = [
    () => downloadElementAsPNG(ticketBox, lastEncryptedCode, 'Your Ticket.png')
  ];

  if (lastEncryptedCodePartner) {
    const partnerEl = document.querySelector('.clone');
    if (partnerEl) {
      tasks.push(() =>
        downloadElementAsPNG(partnerEl, lastEncryptedCodePartner, "Your Partner's Ticket.png")
      );
    }
  }

  tasks
    .reduce((p, fn) => p.then(fn), Promise.resolve())
    .then(() => showPopup('success', 'Downloaded!'))
    .catch(() => showPopup('error', 'Download failed'));
}

function downloadAsPDF() {
  showPopup('load', 'Preparing download…');

  const tasks = [
    () => downloadElementAsPDF(ticketBox, lastEncryptedCode, 'Your Ticket.pdf')
  ];

  if (lastEncryptedCodePartner) {
    const partnerEl = document.querySelector('.clone');
    if (partnerEl) {
      tasks.push(() =>
        downloadElementAsPDF(partnerEl, lastEncryptedCodePartner, "Your Partner's Ticket.pdf")
      );
    }
  }

  tasks
    .reduce((p, fn) => p.then(fn), Promise.resolve())
    .then(() => showPopup('success', 'Downloaded!'))
    .catch(() => showPopup('error', 'Download failed'));
}

// ── AUTO HANDLE URL PARAMETER ──────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');

  if (ref) {
    // Fill the input automatically (so the user sees it)
    const refInput = input;
    if (refInput) refInput.value = ref;

    // Automatically verify
    verifyPayment(ref);
  }
});

// ── EVENT LISTENERS ────────────────────────────────────────
var refVal;
input.addEventListener('keydown',(e)=>{
  refVal = input.value.trim()
  if(e.keyCode == 13){
    verifyPayment(refVal)
  }
})

generateBtn.addEventListener('click', () => {
  refVal = input.value.trim()
  if (!refVal) {
    showPopup('error', 'Please enter reference');
    return;
  }
  verifyPayment(refVal);
});

downloadPngBtn.addEventListener('click', downloadAsPNG);
downloadPdfBtn.addEventListener('click', downloadAsPDF);
