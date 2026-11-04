
const express = require("express");
const path = require("path");
const products = require("./data/products");
const promoCodes = require("./data/promos");
const deliveryFees = require("./data/delivery");

// Crée une nouvelle application avec un panier vide.
// Chaque test part d'un état propre.
function createApp() {
  const app = express();
  const cart = new Map(); // productId -> quantity
  const appliedCodes = []; // Codes promo appliqués

  app.use(express.json());
  app.use(express.static(path.join(__dirname, "..", "public")));

  // Vérification de santé
  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Catalogue avec filtre optionnel par catégorie
  app.get("/api/products", (req, res) => {
    const { category } = req.query;
    const result = category
      ? products.filter(
          (p) =>
            p.category.toLowerCase() ===
            String(category).toLowerCase()
        )
      : products;

    res.json(result);
  });
  // Calculer les frais de livraison
app.get("/api/delivery/:city", (req, res) => {
  const city = Object.keys(deliveryFees).find(
    (name) =>
      name.toLowerCase() ===
      req.params.city.toLowerCase()
  );

  if (!city) {
    return res.status(404).json({
      error: "Ville non disponible"
    });
  }

  res.json({
    city,
    deliveryFee: deliveryFees[city]
  });
});

  // Fiche produit
  app.get("/api/products/:id", (req, res) => {
    const product = products.find(
      (p) => p.id === Number(req.params.id)
    );

    if (!product) {
      return res.status(404).json({
        error: "Produit introuvable"
      });
    }

    res.json(product);
  });

  // Contenu du panier avec calcul des remises
  function cartSummary() {
    const items = [...cart.entries()].map(
      ([productId, quantity]) => {
        const product = products.find(
          (p) => p.id === productId
        );

        return {
          productId,
          name: product.name,
          unitPrice: product.price,
          quantity,
          subtotal: product.price * quantity
        };
      }
    );

    // Total avant réduction
    const subtotal = items.reduce(
      (sum, item) => sum + item.subtotal,
      0
    );

    // Application successive des codes promo
    let total = subtotal;

    for (const code of appliedCodes) {
      total = total * (1 - promoCodes[code]);
    }

    return {
      items,
      subtotal,
      codes: [...appliedCodes],
      total: Math.round(total * 100) / 100
    };
  }

  // Consulter le panier
  app.get("/api/cart", (req, res) => {
    res.json(cartSummary());
  });

  // Ajouter un produit au panier
  app.post("/api/cart", (req, res) => {
    const productId = Number(req.body.productId);
    const quantity =
      req.body.quantity === undefined
        ? 1
        : Number(req.body.quantity);

    const product = products.find(
      (p) => p.id === productId
    );

    if (!product) {
      return res.status(404).json({
        error: "Produit introuvable"
      });
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({
        error: "La quantité doit être un entier positif"
      });
    }

    const newQuantity =
      (cart.get(productId) || 0) + quantity;

    if (newQuantity > product.stock) {
      return res.status(400).json({
        error: "Stock insuffisant"
      });
    }

    cart.set(productId, newQuantity);

    res.status(201).json(cartSummary());
  });

  // Retirer un produit du panier
  app.delete("/api/cart/:productId", (req, res) => {
    const productId = Number(req.params.productId);

    if (!cart.has(productId)) {
      return res.status(404).json({
        error: "Ce produit n'est pas dans le panier"
      });
    }

    cart.delete(productId);

    res.json(cartSummary());
  });

  // Appliquer un code promo au panier
  app.post("/api/cart/promo", (req, res) => {
    const code = String(req.body?.code || "")
      .trim()
      .toUpperCase();

    // Vérifier si le code existe
    if (!Object.prototype.hasOwnProperty.call(promoCodes, code)) {
      return res.status(400).json({
        error: "Code promo invalide"
      });
    }

    // Ajouter le code promo
    appliedCodes.push(code);

    // Retourner le panier avec la réduction
    res.json(cartSummary());
  });

  return app;
}

module.exports = createApp;
