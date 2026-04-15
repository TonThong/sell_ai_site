const productGrid = document.getElementById("product-grid");
const historyList = document.getElementById("history-list");
const cartContent = document.getElementById("cart-content");
const cartPanel = document.getElementById("cart-panel");
const paymentModal = document.getElementById("payment-modal");
const paymentBackdrop = document.getElementById("payment-backdrop");
const closePaymentModalButton = document.getElementById("close-payment-modal");
const copyAddressButton = document.getElementById("copy-address-button");
const paymentAddress = document.getElementById("payment-address");
const copyStatus = document.getElementById("copy-status");
const binanceModal = document.getElementById("binance-modal");
const binanceBackdrop = document.getElementById("binance-backdrop");
const closeBinanceModalButton = document.getElementById("close-binance-modal");
const binanceOrderIdInput = document.getElementById("binance-order-id");
const binanceDoneButton = document.getElementById("binance-done-button");
const binanceStatus = document.getElementById("binance-status");

const fallbackData = {
  products: [
    {
      id: "claude-pro",
      name: "Claude PRO",
      subtitle: "Professional tier subscription",
      price: "$10",
      minPieces: 15,
      stock: 78,
      buttonLabel: "Out of Stock",
      tag: "Best for daily AI work"
    },
    {
      id: "claude-max5",
      name: "Claude MAX X5",
      subtitle: "Maximum tier with 5 seats",
      price: "$32",
      minPieces: 15,
      stock: 134,
      buttonLabel: "Out of Stock",
      tag: "Team access package"
    },
    {
      id: "claude-max20",
      name: "Claude X20",
      subtitle: "Maximum tier with 20 seats",
      price: "$62",
      minPieces: 15,
      stock: 42,
      buttonLabel: "Add to Cart",
      tag: "Most popular option"
    }
  ],
  history: [
    {
      name: "Claude PRO",
      date: "2026/04/13 02:09:40",
      qty: 15,
      amount: "$300.00",
      fileType: ".txt"
    },
    {
      name: "Claude MAX20",
      date: "2026/04/12 18:22:15",
      qty: 2,
      amount: "$520.00",
      fileType: ".csv"
    }
  ]
};

const cartIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3.5 5.5h2l2.2 9.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.74l1.36-5.01H8.1"></path>
    <circle cx="10" cy="19" r="1.25"></circle>
    <circle cx="18" cy="19" r="1.25"></circle>
  </svg>
`;

const downloadIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 4.75v9.5"></path>
    <path d="m7.75 10.75 4.25 4.25 4.25-4.25"></path>
    <path d="M5 18.25h14"></path>
  </svg>
`;

let sourceStoreData = fallbackData;
let storeData = fallbackData;
let selectedCartProduct = null;
let selectedQuantity = 1;
let activeCheckoutType = null;
let hourlyStockRefreshTimer = null;
const dailyAvailabilityCache = new Map();
const bep20Address = "0x8a67ffaCe14E1c8646c6061ee0dF9F38Cc13a8F8";
const checkoutDelayRange = {
  min: 2000,
  max: 5000
};

function parsePrice(price) {
  return Number(String(price || "").replace(/[^0-9.]/g, "")) || 0;
}

function formatCurrency(value) {
  return `$${value.toFixed(2)}`;
}

function getMinimumQuantity(product) {
  return Math.max(Number(product.minPieces) || 1, 1);
}

function canAddToCart(product) {
  return (product.stock || 0) >= getMinimumQuantity(product);
}

function hashString(value) {
  let hash = 0;

  for (const char of String(value)) {
    hash = ((hash << 5) - hash) + char.charCodeAt(0);
    hash |= 0;
  }

  return Math.abs(hash);
}

function getHourSeed(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0")
  ].join("-");
}

function getDaySeed(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function createSeededRandom(seed) {
  let state = hashString(seed) || 1;

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function getInStockHoursForDay(product, date = new Date()) {
  const daySeed = getDaySeed(date);
  const cacheKey = `${product.id}-${daySeed}`;

  if (dailyAvailabilityCache.has(cacheKey)) {
    return dailyAvailabilityCache.get(cacheKey);
  }

  const random = createSeededRandom(cacheKey);
  const hours = Array.from({ length: 24 }, (_, hour) => hour);

  for (let index = hours.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [hours[index], hours[swapIndex]] = [hours[swapIndex], hours[index]];
  }

  const inStockHours = new Set(hours.slice(0, 8));
  dailyAvailabilityCache.set(cacheKey, inStockHours);
  return inStockHours;
}

function isProductInStockThisHour(product, date = new Date()) {
  return getInStockHoursForDay(product, date).has(date.getHours());
}

function getHourlyStock(product, date = new Date()) {
  if (!isProductInStockThisHour(product, date)) {
    return 0;
  }

  const baseStock = Math.max(Number(product.stock) || getMinimumQuantity(product), getMinimumQuantity(product));
  const minStock = Math.max(getMinimumQuantity(product), Math.floor(baseStock * 0.4));
  const maxStock = Math.max(minStock, Math.ceil(baseStock * 1.25));
  const range = maxStock - minStock + 1;
  const seed = `${product.id}-${getHourSeed(date)}`;

  return minStock + (hashString(seed) % range);
}

function buildStoreDataWithHourlyStock(data) {
  return {
    ...data,
    products: (data.products || []).map((product) => ({
      ...product,
      stock: getHourlyStock(product)
    })),
    history: [...(data.history || [])]
  };
}

function syncSelectedProduct() {
  if (!selectedCartProduct) {
    return;
  }

  const nextSelectedProduct = (storeData.products || []).find((item) => item.id === selectedCartProduct.id);

  if (!nextSelectedProduct || !canAddToCart(nextSelectedProduct)) {
    selectedCartProduct = null;
    selectedQuantity = 1;
    return;
  }

  selectedCartProduct = nextSelectedProduct;
  selectedQuantity = Math.min(selectedQuantity, nextSelectedProduct.stock);
}

function refreshHourlyStock() {
  storeData = buildStoreDataWithHourlyStock(sourceStoreData);
  syncSelectedProduct();
  renderProducts(storeData.products || []);
  renderHistory(storeData.history || []);
  renderCart();
}

function scheduleHourlyStockRefresh() {
  if (hourlyStockRefreshTimer) {
    window.clearTimeout(hourlyStockRefreshTimer);
  }

  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setMinutes(60, 0, 0);
  const delay = nextHour.getTime() - now.getTime();

  hourlyStockRefreshTimer = window.setTimeout(() => {
    refreshHourlyStock();
    scheduleHourlyStockRefresh();
  }, delay);
}

function getCheckoutButtonMarkup(checkoutType, label, secondary = false) {
  const isLoading = activeCheckoutType === checkoutType;
  const isDisabled = Boolean(activeCheckoutType);
  const buttonClassName = secondary
    ? "cart-action cart-action-secondary"
    : "cart-action";

  return `
    <button
      class="${buttonClassName}${isLoading ? " is-loading" : ""}"
      type="button"
      data-checkout="${checkoutType}"
      ${isDisabled ? "disabled" : ""}
    >
      <span class="cart-action-content">
        ${isLoading ? '<span class="button-spinner" aria-hidden="true"></span>' : ""}
        <span>${isLoading ? "Loading..." : label}</span>
      </span>
    </button>
  `;
}

function getButtonLabel(product, canPurchase) {
  if (!canPurchase) {
    return "Out of Stock";
  }

  return "Add to Cart";
}

function renderProducts(products) {
  productGrid.innerHTML = products.map((product) => {
    const canPurchase = canAddToCart(product);
    const stockClass = canPurchase ? "in-stock" : "out-stock";
    const buttonLabel = getButtonLabel(product, canPurchase);

    return `
      <article class="product-card">
        <h3 class="card-title">${product.name}</h3>
        <p class="card-subtitle">${product.subtitle}</p>
        <div class="product-preview">
          <div class="preview-content">
            <span class="preview-price">${product.price || ""}</span>
            <span class="preview-min">Min ${product.minPieces || 15} pieces</span>
          </div>
        </div>
        <div class="stock-row">
          <span>Stock</span>
          <span class="stock-value ${stockClass}">${product.stock} available</span>
        </div>
        <button class="buy-button" type="button" data-product-id="${product.id}" ${canPurchase ? "" : "disabled"}>
          <span class="button-content">${cartIcon}<span>${buttonLabel}</span></span>
        </button>
        <span class="pill">${product.tag}</span>
      </article>
    `;
  }).join("");
}

function renderCart() {
  if (!selectedCartProduct) {
    cartContent.innerHTML = `
      <div class="cart-empty">
        <strong>Your cart is empty</strong>
      </div>
    `;
    return;
  }

  const minPieces = getMinimumQuantity(selectedCartProduct);
  const stock = selectedCartProduct.stock || 0;
  const unitPrice = parsePrice(selectedCartProduct.price);
  const totalPrice = unitPrice * selectedQuantity;

  cartContent.innerHTML = `
    <div class="cart-box">
      <div class="cart-product">
        <div>
          <div class="cart-product-name">${selectedCartProduct.name}</div>
          <p class="cart-product-note">Stock ${stock} available</p>
        </div>
        <div class="cart-product-price">${selectedCartProduct.price}</div>
      </div>

      <div class="quantity-block">
        <label class="cart-label" for="quantity-input">Choose quantity</label>
        <div class="quantity-controls">
          <button class="qty-button" type="button" data-action="decrease">-</button>
          <input
            id="quantity-input"
            class="qty-input"
            type="number"
            inputmode="numeric"
            min="${minPieces}"
            max="${Math.max(stock, minPieces)}"
            value="${selectedQuantity}"
          >
          <button class="qty-button" type="button" data-action="increase">+</button>
        </div>
        <p class="qty-helper">
          Minimum ${minPieces} pieces, current stock ${stock}.
        </p>
      </div>

      <div class="cart-summary">
        <div class="summary-row">
          <span>Unit price</span>
          <span>${selectedCartProduct.price}</span>
        </div>
        <div class="summary-row">
          <span>Total</span>
          <strong>${formatCurrency(totalPrice)}</strong>
        </div>
        <div class="checkout-actions">
          ${getCheckoutButtonMarkup("usdt-bep20", "Check Out (USDT BEP20)")}
          ${getCheckoutButtonMarkup("binance", "Check Out (Binance)", true)}
        </div>
      </div>
    </div>
  `;
}

function openPaymentModal() {
  paymentModal.hidden = false;
  copyStatus.textContent = "";
}

function closePaymentModal() {
  paymentModal.hidden = true;
}

function openBinanceModal() {
  binanceModal.hidden = false;
  binanceOrderIdInput.value = "";
  binanceStatus.textContent = "";
  window.setTimeout(() => {
    binanceOrderIdInput.focus();
  }, 0);
}

function closeBinanceModal() {
  binanceModal.hidden = true;
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getCheckoutDelay() {
  const { min, max } = checkoutDelayRange;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function startCheckout(checkoutType) {
  if (activeCheckoutType || !selectedCartProduct) {
    return;
  }

  activeCheckoutType = checkoutType;
  renderCart();

  await wait(getCheckoutDelay());

  activeCheckoutType = null;
  renderCart();

  if (checkoutType === "usdt-bep20") {
    openPaymentModal();
    return;
  }

  if (checkoutType === "binance") {
    openBinanceModal();
  }
}

function fallbackCopyText(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();

  const copied = document.execCommand("copy");
  document.body.removeChild(textArea);
  return copied;
}

async function copyPaymentAddress() {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(bep20Address);
    } else {
      const copied = fallbackCopyText(bep20Address);

      if (!copied) {
        throw new Error("Fallback copy failed");
      }
    }

    copyStatus.textContent = "Address copied to clipboard.";
  } catch (error) {
    const copied = fallbackCopyText(bep20Address);
    copyStatus.textContent = copied
      ? "Address copied to clipboard."
      : "Copy failed. Please copy the address manually.";
    console.error(error);
  }
}

function completeBinanceCheckout() {
  const orderId = binanceOrderIdInput.value.trim();

  if (!orderId) {
    binanceStatus.textContent = "Please enter your order ID before completing the payment.";
    binanceOrderIdInput.focus();
    return;
  }

  binanceStatus.textContent = "Payment reference submitted. We will use it for verification.";
  window.setTimeout(() => {
    closeBinanceModal();
  }, 1200);
}

function syncQuantity(nextValue) {
  if (!selectedCartProduct) {
    return;
  }

  const minPieces = getMinimumQuantity(selectedCartProduct);
  const stock = Math.max(selectedCartProduct.stock || minPieces, minPieces);
  const parsed = Number(nextValue);

  if (Number.isNaN(parsed)) {
    return;
  }

  selectedQuantity = Math.min(Math.max(Math.floor(parsed), minPieces), stock);
  renderCart();
}

function activateCart(productId) {
  const product = (storeData.products || []).find((item) => item.id === productId);

  if (!product || !canAddToCart(product)) {
    return;
  }

  selectedCartProduct = product;
  selectedQuantity = getMinimumQuantity(product);
  renderCart();
  cartPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderHistory(history) {
  historyList.innerHTML = history.map((item) => `
    <article class="history-card">
      <div>
        <h3 class="card-title">${item.name}</h3>
        <p class="history-meta">${item.date} · Qty: ${item.qty}</p>
      </div>
      <div class="history-amount">${item.amount}</div>
      <button class="download-badge" type="button">
        ${downloadIcon}
        <span>${item.fileType}</span>
      </button>
    </article>
  `).join("");
}

async function initStore() {
  try {
    const response = await fetch("assets/data/store.json");

    if (!response.ok) {
      throw new Error("Store data request failed");
    }

    sourceStoreData = await response.json();
  } catch (error) {
    sourceStoreData = fallbackData;
    console.error(error);
  }

  refreshHourlyStock();
  scheduleHourlyStockRefresh();
}

productGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".buy-button");

  if (!button) {
    return;
  }

  activateCart(button.dataset.productId);
});

cartContent.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action]");
  const checkoutButton = event.target.closest("[data-checkout]");

  if (checkoutButton?.dataset.checkout === "usdt-bep20") {
    startCheckout("usdt-bep20");
    return;
  }

  if (checkoutButton?.dataset.checkout === "binance") {
    startCheckout("binance");
    return;
  }

  if (!actionButton) {
    return;
  }

  if (actionButton.dataset.action === "decrease") {
    syncQuantity(selectedQuantity - 1);
  }

  if (actionButton.dataset.action === "increase") {
    syncQuantity(selectedQuantity + 1);
  }
});

cartContent.addEventListener("input", (event) => {
  if (event.target.id !== "quantity-input") {
    return;
  }

  syncQuantity(event.target.value);
});

paymentBackdrop.addEventListener("click", closePaymentModal);
closePaymentModalButton.addEventListener("click", closePaymentModal);
copyAddressButton.addEventListener("click", copyPaymentAddress);
binanceBackdrop.addEventListener("click", closeBinanceModal);
closeBinanceModalButton.addEventListener("click", closeBinanceModal);
binanceDoneButton.addEventListener("click", completeBinanceCheckout);
binanceOrderIdInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    completeBinanceCheckout();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !paymentModal.hidden) {
    closePaymentModal();
  }

  if (event.key === "Escape" && !binanceModal.hidden) {
    closeBinanceModal();
  }
});

initStore();
