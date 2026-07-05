const adminConfig = {
  username: "admin",
  password: "laobinzi123",
  owner: "byemolei",
  repo: "corginova-toys",
  branch: "main",
  dataPath: "data/site-data.json",
  uploadDir: "assets/uploads",
  ...(window.CORGINOVA_ADMIN || {}),
};
const loginPanel = document.querySelector("[data-login-panel]");
const adminShell = document.querySelector("[data-admin-shell]");
const loginForm = document.querySelector("[data-login-form]");
const signOutButton = document.querySelector("[data-sign-out]");
const tokenInput = document.querySelector("[data-token-input]");
const saveTokenButton = document.querySelector("[data-save-token]");
const productList = document.querySelector("[data-product-list]");
const productForm = document.querySelector("[data-product-form]");
const settingsForm = document.querySelector("[data-settings-form]");
const newProductButton = document.querySelector("[data-new-product]");
const deleteProductButton = document.querySelector("[data-delete-product]");
const toastEl = document.querySelector("[data-toast]");

const tokenKey = "corginova_github_token";
const loginKey = "corginova_admin_signed_in";
let store = { products: [], settings: {} };
let selectedProductId = null;
let dataFileSha = null;

init();

async function init() {
  bindEvents();
  tokenInput.value = localStorage.getItem(tokenKey) || "";

  if (sessionStorage.getItem(loginKey) === "true") {
    setSignedIn(true);
    await loadAdminData();
  }
}

function bindEvents() {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(loginForm);
    const isValid =
      form.get("username") === adminConfig.username &&
      form.get("password") === adminConfig.password;

    if (!isValid) {
      showToast("用户名或密码不正确。");
      return;
    }

    sessionStorage.setItem(loginKey, "true");
    setSignedIn(true);
    await loadAdminData();
  });

  signOutButton.addEventListener("click", () => {
    sessionStorage.removeItem(loginKey);
    setSignedIn(false);
  });

  saveTokenButton.addEventListener("click", async () => {
    localStorage.setItem(tokenKey, tokenInput.value.trim());
    showToast("GitHub token 已保存在当前浏览器。");
    await loadAdminData();
  });

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-tab]").forEach((tab) => tab.classList.remove("active"));
      document.querySelectorAll("[data-panel]").forEach((panel) => panel.classList.remove("active"));
      button.classList.add("active");
      document.querySelector(`[data-panel="${button.dataset.tab}"]`).classList.add("active");
    });
  });

  newProductButton.addEventListener("click", () => selectProduct(null));
  productForm.addEventListener("submit", saveProduct);
  settingsForm.addEventListener("submit", saveSettings);
  deleteProductButton.addEventListener("click", deleteProduct);
}

function setSignedIn(isSignedIn) {
  loginPanel.hidden = isSignedIn;
  adminShell.hidden = !isSignedIn;
  signOutButton.hidden = !isSignedIn;
}

async function loadAdminData() {
  try {
    store = await readStoreData();
    store.products = Array.isArray(store.products) ? store.products : [];
    store.settings = store.settings || {};
    renderProductList();
    fillForm(settingsForm, store.settings);
    selectProduct(store.products[0]?.id || null);
  } catch (error) {
    showToast(error.message);
  }
}

async function readStoreData() {
  const token = getToken();
  if (token) {
    const file = await githubRequest(`/repos/${adminConfig.owner}/${adminConfig.repo}/contents/${adminConfig.dataPath}?ref=${adminConfig.branch}`);
    dataFileSha = file.sha;
    return JSON.parse(decodeBase64(file.content));
  }

  const response = await fetch(`../${adminConfig.dataPath}?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Add a GitHub token to load and publish store data.");
  }
  dataFileSha = null;
  return response.json();
}

function renderProductList() {
  const sorted = [...store.products].sort((a, b) => Number(a.sort_order || 100) - Number(b.sort_order || 100));
  productList.innerHTML = sorted
    .map(
      (product) => `
        <button class="product-item ${product.id === selectedProductId ? "active" : ""}" type="button" data-id="${escapeAttr(product.id)}">
          <img src="${escapeAttr(relativeImage(product.image_url || "../assets/chew-toy.png"))}" alt="">
          <span>
            <strong>${escapeHtml(product.name)}</strong>
            <span>${escapeHtml(categoryLabel(product.category))} · $${Number(product.price || 0).toFixed(2)}</span>
          </span>
          <span>${product.is_active === false ? "隐藏" : "显示中"}</span>
        </button>
      `
    )
    .join("");

  productList.querySelectorAll("[data-id]").forEach((button) => {
    button.addEventListener("click", () => selectProduct(button.dataset.id));
  });
}

function selectProduct(id) {
  selectedProductId = id;
  const product = store.products.find((item) => item.id === id) || {
    id: "",
    name: "",
    category: "chew",
    price: 0,
    sort_order: nextSortOrder(),
    is_active: true,
    is_featured: false,
  };

  fillForm(productForm, product);
  deleteProductButton.disabled = !id;
  renderProductList();
}

async function saveProduct(event) {
  event.preventDefault();
  try {
    requireToken();

    const values = Object.fromEntries(new FormData(productForm));
    const file = productForm.elements.image_file.files[0];
    const id = values.id || slugify(values.name);
    let imageUrl = values.image_url || "";

    if (!values.name || !values.price) {
      showToast("请至少填写商品名称和价格。");
      return;
    }

    if (file) {
      imageUrl = await uploadImage(file);
    }

    const product = {
      id,
      name: values.name,
      category: values.category,
      tag: values.tag || "",
      description: values.description || "",
      price: Number(values.price || 0),
      image_url: imageUrl,
      image_alt: values.image_alt || values.name,
      badge: values.badge || "",
      sale_label: values.sale_label || "",
      is_featured: Boolean(values.is_featured),
      is_active: Boolean(values.is_active),
      sort_order: Number(values.sort_order || 100),
    };

    const index = store.products.findIndex((item) => item.id === values.id);
    if (index >= 0) {
      store.products[index] = product;
    } else {
      store.products.push(product);
    }

    await publishStoreData(`更新商品：${product.name}`);
    showToast("商品已保存并发布，网站稍等会自动更新。");
    await loadAdminData();
    selectProduct(id);
  } catch (error) {
    showToast(error.message);
  }
}

async function uploadImage(file) {
  const safeName = `${Date.now()}-${file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-")}`;
  const path = `${adminConfig.uploadDir}/${safeName}`;
  const base64 = await fileToBase64(file);

  await githubRequest(`/repos/${adminConfig.owner}/${adminConfig.repo}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `上传商品图片：${safeName}`,
      content: base64,
      branch: adminConfig.branch,
    }),
  });

  return path;
}

async function deleteProduct() {
  try {
    requireToken();
    if (!selectedProductId) return;
    const product = store.products.find((item) => item.id === selectedProductId);
    const confirmed = window.confirm(`确定删除「${product?.name || "这个商品"}」吗？`);
    if (!confirmed) return;

    store.products = store.products.filter((item) => item.id !== selectedProductId);
    await publishStoreData(`删除商品：${product?.name || selectedProductId}`);
    selectedProductId = null;
    showToast("商品已删除并发布。");
    await loadAdminData();
  } catch (error) {
    showToast(error.message);
  }
}

async function saveSettings(event) {
  event.preventDefault();
  try {
    requireToken();
    const values = Object.fromEntries(new FormData(settingsForm));

    store.settings = {
      business_name: values.business_name,
      order_email: values.order_email,
      contact_heading: values.contact_heading,
      contact_body: values.contact_body,
      ships_from: values.ships_from,
      payment_methods: values.payment_methods,
    };

    await publishStoreData("更新联系方式和付款方式");
    showToast("设置已保存并发布。");
  } catch (error) {
    showToast(error.message);
  }
}

async function publishStoreData(message) {
  const latest = await githubRequest(`/repos/${adminConfig.owner}/${adminConfig.repo}/contents/${adminConfig.dataPath}?ref=${adminConfig.branch}`);
  dataFileSha = latest.sha;

  const content = encodeBase64(JSON.stringify(store, null, 2) + "\n");
  await githubRequest(`/repos/${adminConfig.owner}/${adminConfig.repo}/contents/${adminConfig.dataPath}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content,
      sha: dataFileSha,
      branch: adminConfig.branch,
    }),
  });
}

async function githubRequest(path, options = {}) {
  const token = getToken();
  if (!token) {
    throw new Error("请先粘贴并保存 GitHub token。");
  }

  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.message || `GitHub 请求失败：${response.status}`);
  }

  return response.json();
}

function getToken() {
  return tokenInput.value.trim() || localStorage.getItem(tokenKey) || "";
}

function requireToken() {
  if (!getToken()) {
    throw new Error("请先粘贴并保存 GitHub token。");
  }
}

function fillForm(form, values) {
  [...form.elements].forEach((field) => {
    if (!field.name || field.type === "file") return;
    if (field.type === "checkbox") {
      field.checked = Boolean(values[field.name]);
      return;
    }
    field.value = values[field.name] ?? "";
  });
}

function nextSortOrder() {
  const max = store.products.reduce((highest, product) => Math.max(highest, Number(product.sort_order || 0)), 0);
  return max + 10;
}

function relativeImage(value) {
  if (!value) return "../assets/chew-toy.png";
  if (/^https?:\/\//.test(value) || value.startsWith("../")) return value;
  return `../${value}`;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function decodeBase64(value) {
  const clean = String(value || "").replace(/\s/g, "");
  return decodeURIComponent(
    atob(clean)
      .split("")
      .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
      .join("")
  );
}

function encodeBase64(value) {
  return btoa(unescape(encodeURIComponent(value)));
}

function slugify(value) {
  const slug = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `product-${Date.now()}`;
}

function categoryLabel(value) {
  const labels = {
    chew: "咀嚼玩具",
    tug: "拔河玩具",
    puzzle: "益智玩具",
    bundle: "套装",
    plush: "毛绒玩具",
    sale: "促销",
  };
  return labels[value] || value || "未分类";
}

let toastTimer;
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2800);
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
