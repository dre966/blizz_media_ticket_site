export async function loadPaystack() {
  if (window.PaystackPop) return window.PaystackPop;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.onload = () => resolve(window.PaystackPop);
    script.onerror = () => reject('Failed to load Paystack SDK');
    document.head.appendChild(script);
  });
}

document.querySelector("form").addEventListener("submit", function (e) {
  e.preventDefault(); // Stops the page from reloading
console.log('p')
});
