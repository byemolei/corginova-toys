const fallbackStore = {
  products: [
    {
      id: "aqua-grip-chew-bar",
      name: "Aqua Grip Chew Bar",
      category: "chew",
      tag: "Daily chew system",
      description: "Raised texture, easy-grip shape, and a satisfying chew feel for corgis that need a job.",
      price: 16,
      image_url: "assets/chew-toy.png",
      image_alt: "Teal textured corgi chew toy",
      badge: "Chew",
      is_featured: false,
      is_active: true,
      sort_order: 10,
    },
    {
      id: "nebula-tug-rope",
      name: "Nebula Tug Rope",
      category: "tug",
      tag: "Interactive play",
      description: "Bright braided cotton rope for hallway tug sessions, fetch games, and training rewards.",
      price: 12,
      image_url: "assets/rope-toy.png",
      image_alt: "Colorful braided rope toy for corgis",
      badge: "Tug",
      is_featured: false,
      is_active: true,
      sort_order: 20,
    },
    {
      id: "solar-snack-sphere",
      name: "Solar Snack Sphere",
      category: "puzzle",
      tag: "Mental enrichment",
      description: "Load treats, roll, sniff, repeat. A smart boredom breaker for food-motivated corgis.",
      price: 18,
      image_url: "assets/puzzle-ball.png",
      image_alt: "Yellow treat puzzle ball for corgis",
      badge: "Puzzle",
      is_featured: false,
      is_active: true,
      sort_order: 30,
    },
    {
      id: "corginova-starter-pack",
      name: "CorgiNova Starter Pack",
      category: "bundle",
      tag: "Launch kit",
      description: "Four toy styles in one shelf-ready kit: chew, tug, puzzle, and plush comfort play.",
      price: 49,
      image_url: "assets/corgi-toy-bundle.png",
      image_alt: "Premium bundle of corgi-sized dog toys",
      badge: "Bundle",
      is_featured: true,
      is_active: true,
      sort_order: 40,
    },
  ],
  settings: {
    contact_heading: "Start with email orders. Upgrade to checkout later.",
    contact_body: "Replace the contact details below with your real email, business name, and preferred US fulfillment details.",
    order_email: "hello@example.com",
    business_name: "CorgiNova Toys",
    ships_from: "United States",
    payment_methods: "Email order request, PayPal invoice, or manual payment instructions.",
  },
};

const productGrid = document.querySelector("[data-product-grid]");
const filterGroup = document.querySelector("[data-filter-group]");
const contactSection = document.querySelector("[data-contact-content]");
const contactBox = document.querySelector("[data-contact-box]");
const cartDrawer = document.querySelector(".cart-drawer");
const cartItemsEl = document.querySelector("[data-cart-items]");
const cartTotalEl = document.querySelector("[data-cart-total]");
const cartCountEls = document.querySelectorAll("[data-cart-count]");
const toastEl = document.querySelector("[data-toast]");
const cart = new Map();
let observer;

init();

async function init() {
  const store = await loadStoreData();
  const products = store.products
    .filter((product) => product.is_active !== false)
    .sort((a, b) => Number(a.sort_order || 100) - Number(b.sort_order || 100));

  renderProducts(products);
  renderFilters(products);
  renderContact(store.settings);
  initReveal();
  initCart();
  initFilters();
  initCounters();
  initCursorGlow();
}

async function loadStoreData() {
  try {
    const response = await fetch(`data/site-data.json?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Store data unavailable");
    const data = await response.json();
    return {
      products: Array.isArray(data.products) && data.products.length ? data.products : fallbackStore.products,
      settings: { ...fallbackStore.settings, ...(data.settings || {}) },
    };
  } catch (error) {
    console.warn("Using fallback store data:", error.message);
    return fallbackStore;
  }
}

function renderProducts(products) {
  if (!productGrid) return;

  productGrid.innerHTML = products
    .map((product) => {
      const price = formatPrice(product.price);
      const cardClass = product.is_featured ? "product-card product-card-wide reveal" : "product-card reveal";
      const badge = product.sale_label || product.badge || product.category || "New";

      return `
        <article class="${cardClass}" data-category="${escapeAttr(product.category || "all")}">
          <div class="product-image">
            <img src="${escapeAttr(product.image_url || "assets/chew-toy.png")}" alt="${escapeAttr(
              product.image_alt || product.name
            )}">
            <span class="badge">${escapeHtml(badge)}</span>
          </div>
          <div class="product-info">
            <p class="tag">${escapeHtml(product.tag || "Featured product")}</p>
            <h3>${escapeHtml(product.name)}</h3>
            <p>${escapeHtml(product.description || "")}</p>
            <div class="price-row">
              <span class="price">${price}</span>
              <button type="button" data-add-cart data-name="${escapeAttr(product.name)}" data-price="${Number(
                product.price || 0
              )}">Add</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderFilters(products) {
  if (!filterGroup) return;

  const labels = new Map([["all", "All"]]);
  products.forEach((product) => {
    if (product.category && !labels.has(product.category)) {
      labels.set(product.category, titleCase(product.category));
    }
  });

  filterGroup.innerHTML = [...labels]
    .map(
      ([value, label], index) =>
        `<button class="filter-btn ${index === 0 ? "active" : ""}" type="button" data-filter="${escapeAttr(
          value
        )}">${escapeHtml(label)}</button>`
    )
    .join("");
}

function renderContact(settings) {
  const merged = { ...fallbackStore.settings, ...settings };
  const subject = encodeURIComponent(`${merged.business_name || "CorgiNova Toys"} Order`);

  if (contactSection) {
    contactSection.innerHTML = `
      <p class="eyebrow">Launch mode</p>
      <h2>${escapeHtml(merged.contact_heading)}</h2>
      <p>${escapeHtml(merged.contact_body)}</p>
    `;
  }

  if (contactBox) {
    contactBox.innerHTML = `
      <a class="button primary full" href="mailto:${escapeAttr(merged.order_email)}?subject=${subject}">Email to order</a>
      <p>Email: ${escapeHtml(merged.order_email)}</p>
      <p>Ships from: ${escapeHtml(merged.ships_from)}</p>
      <p>Payment: ${escapeHtml(merged.payment_methods)}</p>
    `;
  }
}

function initReveal() {
  if (observer) observer.disconnect();
  const revealItems = document.querySelectorAll(".reveal");
  const counters = document.querySelectorAll("[data-count-up]");

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in-view");

        if (entry.target.matches(".hero-stats")) {
          counters.forEach((counter) => animateCounter(counter));
        }
      });
    },
    { threshold: 0.18 }
  );

  revealItems.forEach((item) => observer.observe(item));
}

function initCounters() {
  const stats = document.querySelector(".hero-stats");
  if (stats) observer.observe(stats);
}

function animateCounter(counter) {
  if (counter.dataset.done) return;
  counter.dataset.done = "true";

  const target = Number(counter.dataset.countUp);
  const duration = 900;
  const start = performance.now();

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    counter.textContent = Math.round(target * eased);

    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
}

function initFilters() {
  document.querySelectorAll(".filter-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;
      document.querySelectorAll(".filter-btn").forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      document.querySelectorAll(".product-card").forEach((card) => {
        const isVisible = filter === "all" || card.dataset.category === filter;
        card.classList.toggle("hidden", !isVisible);
      });
    });
  });
}

function initCart() {
  document.querySelectorAll("[data-add-cart]").forEach((button) => {
    button.addEventListener("click", () => {
      const name = button.dataset.name;
      const price = Number(button.dataset.price);
      const current = cart.get(name) || { name, price, qty: 0 };
      current.qty += 1;
      cart.set(name, current);
      renderCart();
      showToast(`${name} added to cart`);
    });
  });

  document.querySelectorAll("[data-cart-open]").forEach((button) => {
    button.addEventListener("click", openCart);
  });

  document.querySelectorAll("[data-cart-close]").forEach((button) => {
    button.addEventListener("click", closeCart);
  });

  if (cartDrawer) {
    cartDrawer.addEventListener("click", (event) => {
      if (event.target === cartDrawer) {
        closeCart();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCart();
    }
  });
}

function openCart() {
  cartDrawer.classList.add("open");
  cartDrawer.setAttribute("aria-hidden", "false");
  document.body.classList.add("cart-open");
}

function closeCart() {
  cartDrawer.classList.remove("open");
  cartDrawer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("cart-open");
}

function renderCart() {
  const items = [...cart.values()];
  const count = items.reduce((sum, item) => sum + item.qty, 0);
  const total = items.reduce((sum, item) => sum + item.qty * item.price, 0);

  cartCountEls.forEach((el) => {
    el.textContent = count;
  });
  cartTotalEl.textContent = formatPrice(total);

  if (items.length === 0) {
    cartItemsEl.innerHTML = '<p class="empty-cart">Your cart is waiting for a corgi-sized upgrade.</p>';
    return;
  }

  cartItemsEl.innerHTML = items
    .map(
      (item) => `
        <div class="cart-line">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <span>Qty ${item.qty}</span>
          </div>
          <strong>${formatPrice(item.price * item.qty)}</strong>
        </div>
      `
    )
    .join("");
}

let toastTimer;
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove("show");
  }, 1900);
}

function initCursorGlow() {
  const glow = document.querySelector(".cursor-glow");
  window.addEventListener("pointermove", (event) => {
    if (!glow) return;
    glow.style.left = `${event.clientX}px`;
    glow.style.top = `${event.clientY}px`;
  });
}

function formatPrice(value) {
  return `$${Number(value || 0).toFixed(0)}`;
}

function titleCase(value) {
  return String(value)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
