"use client";

import { useAuth } from "@/context/AuthProvider";
import { useInventory } from "@/modules/inventory/context/InventoryProvider";
import type {
  Ingredient,
  IngredientUnit,
  Product,
  RecipeIngredient,
} from "@/types/catalog";
import type { WasteReason } from "@/types/inventory";
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Input,
  Select,
  toast,
} from "@/ui";
import { useMemo, useState } from "react";

const UNITS: IngredientUnit[] = ["kg", "g", "L", "ml", "ud", "caja"];

export function AlertsPanel() {
  const { alerts } = useInventory();
  if (!alerts.length) {
    return (
      <EmptyState
        title="Sin alertas de stock"
        description="Ningún ingrediente está en o bajo el mínimo."
      />
    );
  }
  return (
    <div className="space-y-2">
      {alerts.map((a) => (
        <Alert
          key={a.id}
          tone="danger"
          title={`${a.name}: ${a.quantity} ${a.unit}`}
        >
          Stock mínimo {a.minStock} {a.unit}. Reponer cuanto antes.
        </Alert>
      ))}
    </div>
  );
}

export function IngredientsPanel() {
  const { ingredients, levels, saveIngredient, updateMinStock, currency } =
    useInventory();
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<IngredientUnit>("kg");
  const [cost, setCost] = useState("1");
  const [minEdits, setMinEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const levelByIng = useMemo(
    () => new Map(levels.map((l) => [l.ingredientId, l])),
    [levels],
  );

  function resetForm() {
    setEditing(null);
    setName("");
    setUnit("kg");
    setCost("1");
  }

  function startEdit(ing: Ingredient) {
    setEditing(ing);
    setName(ing.name);
    setUnit(ing.unit);
    setCost(String(ing.costPerUnit));
  }

  return (
    <div className="space-y-4">
      <form
        className="grid gap-2 rounded-[var(--radius-lg)] border border-border p-3 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) {
            toast("Nombre obligatorio", "error");
            return;
          }
          setBusy(true);
          void saveIngredient({
            ingredient: editing,
            name: name.trim(),
            unit,
            costPerUnit: Number(cost) || 0,
          })
            .then(() => {
              toast(
                editing ? "Ingrediente actualizado" : "Ingrediente guardado",
                "success",
              );
              resetForm();
            })
            .catch((err) => toast(err.message, "error"))
            .finally(() => setBusy(false));
        }}
      >
        <Input
          label={editing ? "Editar nombre" : "Nombre"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Select
          label="Unidad"
          value={unit}
          onChange={(e) => setUnit(e.target.value as IngredientUnit)}
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </Select>
        <Input
          label={`Coste / ud (${currency})`}
          type="number"
          step="0.01"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
        />
        <div className="flex flex-wrap items-end gap-2">
          <Button type="submit" className="flex-1" disabled={busy}>
            {editing ? "Guardar cambios" : "Añadir"}
          </Button>
          {editing ? (
            <Button type="button" variant="secondary" onClick={resetForm}>
              Cancelar
            </Button>
          ) : null}
        </div>
      </form>

      {editing ? (
        <p className="text-sm text-fg-muted">
          Editando <strong>{editing.name}</strong>. Cambia nombre, unidad o
          coste y pulsa Guardar cambios.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-bg-muted text-fg-muted">
            <tr>
              <th className="px-3 py-2">Ingrediente</th>
              <th className="px-3 py-2">Stock</th>
              <th className="px-3 py-2">Mínimo</th>
              <th className="px-3 py-2">Coste</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ingredients.map((ing) => {
              const level = levelByIng.get(ing.id);
              const low = level && level.quantity <= level.minStock;
              const selected = editing?.id === ing.id;
              return (
                <tr
                  key={ing.id}
                  className={selected ? "bg-accent-soft/30" : undefined}
                >
                  <td className="px-3 py-2 font-medium">
                    {ing.name}{" "}
                    {low ? <Badge tone="danger">Bajo</Badge> : null}
                  </td>
                  <td className="px-3 py-2">
                    {level ? `${level.quantity} ${level.unit}` : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        className="h-8 w-20 rounded border border-border bg-bg-elevated px-2"
                        type="number"
                        step="0.1"
                        value={
                          minEdits[ing.id] ??
                          String(level?.minStock ?? 0)
                        }
                        onChange={(e) =>
                          setMinEdits((m) => ({
                            ...m,
                            [ing.id]: e.target.value,
                          }))
                        }
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          void updateMinStock(
                            ing.id,
                            Number(minEdits[ing.id] ?? level?.minStock ?? 0),
                          )
                            .then(() => toast("Mínimo actualizado", "success"))
                            .catch((err) => toast(err.message, "error"))
                        }
                      >
                        OK
                      </Button>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {ing.costPerUnit} / {ing.unit}
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => startEdit(ing)}
                    >
                      Editar
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ProductsRecipesPanel({
  /** Cocina: añadir/editar, sin quitar ni gestionar categorías. */
  mode = "full",
}: {
  mode?: "full" | "kitchen";
}) {
  const { can } = useAuth();
  const {
    products,
    categories,
    ingredients,
    saveProduct,
    saveCategory,
    removeProduct,
    saveRecipe,
  } = useInventory();

  const canManageProducts = can("catalog.products.manage");
  const canManageCategories = can("catalog.categories.manage");
  const canDelete =
    mode === "full" &&
    canManageCategories &&
    canManageProducts;

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [stockQty, setStockQty] = useState("");
  const [kitchenStation, setKitchenStation] = useState<
    Product["kitchenStation"] | ""
  >("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [recipeLines, setRecipeLines] = useState<RecipeIngredient[]>([]);
  const [busy, setBusy] = useState(false);

  const editing = products.find((p) => p.id === editId) ?? null;

  function resetForm() {
    setName("");
    setBrand("");
    setPrice("");
    setWholesalePrice("");
    setStockQty("");
    setKitchenStation("");
    setEditingProduct(null);
  }

  function loadProductIntoForm(p: Product) {
    setEditingProduct(p);
    setName(p.name);
    setBrand(p.brand ?? "");
    setCategoryId(p.categoryId);
    setPrice(String(p.price ?? ""));
    setWholesalePrice(
      p.wholesalePrice != null ? String(p.wholesalePrice) : "",
    );
    setStockQty(p.stockQty != null ? String(p.stockQty) : "");
    setKitchenStation(p.kitchenStation ?? "");
  }

  if (!canManageProducts && !can("catalog.read")) {
    return (
      <Alert tone="warning" title="Sin acceso al catálogo">
        Necesitas permiso de productos o lectura de catálogo.
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {mode === "full" && canManageCategories ? (
        <form
          className="flex flex-wrap items-end gap-2 rounded-[var(--radius-lg)] border border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newCategory.trim()) return;
            setBusy(true);
            void saveCategory({ name: newCategory.trim() })
              .then(() => {
                toast("Categoría creada", "success");
                setNewCategory("");
              })
              .catch((err) => toast(err.message, "error"))
              .finally(() => setBusy(false));
          }}
        >
          <Input
            label="Nueva categoría"
            className="min-w-[180px] flex-1"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Ej. Platos, Bebidas, Café"
          />
          <Button type="submit" disabled={busy || !newCategory.trim()}>
            Crear categoría
          </Button>
        </form>
      ) : null}

      {canManageProducts ? (
        <form
          className="grid gap-2 rounded-[var(--radius-lg)] border border-border p-3 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            const cat = categoryId || categories[0]?.id;
            if (!cat) {
              toast("Crea una categoría primero", "error");
              return;
            }
            if (!name.trim()) {
              toast("Nombre obligatorio", "error");
              return;
            }
            setBusy(true);
            void saveProduct({
              product: editingProduct,
              name: name.trim(),
              categoryId: cat,
              brand: brand.trim() || undefined,
              price: Number(price) || 0,
              wholesalePrice:
                wholesalePrice === ""
                  ? undefined
                  : Number(wholesalePrice) || 0,
              stockQty:
                stockQty === "" ? undefined : Number(stockQty) || 0,
              kitchenStation: kitchenStation || undefined,
            })
              .then(() => {
                toast(
                  editingProduct ? "Producto actualizado" : "Producto creado",
                  "success",
                );
                resetForm();
              })
              .catch((err) => toast(err.message, "error"))
              .finally(() => setBusy(false));
          }}
        >
          <Input
            label="Producto"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Ej. Cappuccino"
          />
          <Input
            label="Marca"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Opcional"
          />
          <Select
            label="Categoría"
            value={categoryId || categories[0]?.id || ""}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {!categories.length ? (
              <option value="">Sin categorías</option>
            ) : null}
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Input
            label="Precio unitario"
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
          <Input
            label="Precio por mayor"
            type="number"
            step="0.01"
            min="0"
            value={wholesalePrice}
            onChange={(e) => setWholesalePrice(e.target.value)}
            placeholder="Opcional"
          />
          <Input
            label="Cantidad (stock)"
            type="number"
            step="1"
            min="0"
            value={stockQty}
            onChange={(e) => setStockQty(e.target.value)}
            placeholder="Unidades"
          />
          <Select
            label="Estación (cocina / bar)"
            value={kitchenStation}
            onChange={(e) =>
              setKitchenStation(
                e.target.value as Product["kitchenStation"] | "",
              )
            }
          >
            <option value="">Auto (por nombre)</option>
            <option value="cocina">Cocina · comida</option>
            <option value="bar">Barra · bebidas</option>
            <option value="postres">Cocina · postres</option>
          </Select>
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={busy}>
              {editingProduct ? "Guardar cambios" : "Añadir producto"}
            </Button>
            {editingProduct ? (
              <Button
                type="button"
                variant="secondary"
                onClick={resetForm}
              >
                Cancelar edición
              </Button>
            ) : null}
          </div>
        </form>
      ) : (
        <Alert tone="info" title="Solo lectura">
          Puedes ver la carta. Pedir a gerente/supervisor para crear productos.
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ul className="max-h-[420px] space-y-2 overflow-y-auto">
          {products.map((p) => (
            <li
              key={p.id}
              className={`rounded-[var(--radius-md)] border px-3 py-2 text-sm ${
                editId === p.id
                  ? "border-accent bg-accent-soft/40"
                  : "border-border"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setEditId(p.id);
                  setRecipeLines(p.recipe?.length ? [...p.recipe] : []);
                  if (canManageProducts) loadProductIntoForm(p);
                }}
                className="w-full text-left"
              >
                <span className="font-medium">{p.name}</span>
                {p.brand ? (
                  <span className="text-fg-muted"> · {p.brand}</span>
                ) : null}
                <span className="mt-0.5 block text-caption">
                  Unit. {p.price.toFixed(2)}
                  {p.wholesalePrice != null
                    ? ` · Mayor ${p.wholesalePrice.toFixed(2)}`
                    : ""}
                  {p.stockQty != null ? ` · Stock ${p.stockQty}` : ""}
                  {mode === "full"
                    ? ` · Receta: ${p.recipe?.length ?? 0}`
                    : ""}
                </span>
              </button>
              {canDelete ? (
                <div className="mt-2">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (
                        !window.confirm(
                          `¿Quitar «${p.name}» de la carta?`,
                        )
                      ) {
                        return;
                      }
                      void removeProduct(p.id)
                        .then(() => {
                          toast("Producto quitado", "success");
                          if (editingProduct?.id === p.id) resetForm();
                        })
                        .catch((err) => toast(err.message, "error"));
                    }}
                  >
                    Quitar
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
          {!products.length ? (
            <li className="py-6 text-center text-sm text-fg-muted">
              Aún no hay productos en la carta.
            </li>
          ) : null}
        </ul>

        {mode === "full" ? (
          <div className="rounded-[var(--radius-lg)] border border-border p-3">
            {!editing ? (
              <p className="text-sm text-fg-muted">
                Selecciona un producto para editar su receta (BOM). Cada venta
                descontará estos ingredientes.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="font-medium">Receta · {editing.name}</p>
                {recipeLines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-3 gap-2">
                    <Select
                      value={line.ingredientId}
                      onChange={(e) => {
                        const ing = ingredients.find(
                          (i) => i.id === e.target.value,
                        );
                        setRecipeLines((rows) =>
                          rows.map((r, i) =>
                            i === idx
                              ? {
                                  ingredientId: e.target.value,
                                  quantity: r.quantity,
                                  unit: ing?.unit ?? r.unit,
                                }
                              : r,
                          ),
                        );
                      }}
                    >
                      {ingredients.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="number"
                      step="0.001"
                      value={String(line.quantity)}
                      onChange={(e) =>
                        setRecipeLines((rows) =>
                          rows.map((r, i) =>
                            i === idx
                              ? { ...r, quantity: Number(e.target.value) || 0 }
                              : r,
                          ),
                        )
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setRecipeLines((rows) =>
                          rows.filter((_, i) => i !== idx),
                        )
                      }
                    >
                      Quitar
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const first = ingredients[0];
                    if (!first) {
                      toast("Añade ingredientes antes", "error");
                      return;
                    }
                    setRecipeLines((rows) => [
                      ...rows,
                      {
                        ingredientId: first.id,
                        quantity: 0.01,
                        unit: first.unit,
                      },
                    ]);
                  }}
                >
                  + Línea
                </Button>
                <Button
                  onClick={() =>
                    void saveRecipe(editing, recipeLines)
                      .then(() => toast("Receta guardada", "success"))
                      .catch((err) => toast(err.message, "error"))
                  }
                >
                  Guardar receta
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-fg-muted">
            Cocina puede añadir o editar productos. Solo gerente/supervisor
            puede quitarlos o crear categorías.
          </p>
        )}
      </div>
    </div>
  );
}

export function SuppliersPanel() {
  const { suppliers, saveSupplier } = useInventory();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  return (
    <div className="space-y-4">
      <form
        className="grid gap-2 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          void saveSupplier({ name, email, phone })
            .then(() => {
              toast("Proveedor guardado", "success");
              setName("");
              setEmail("");
              setPhone("");
            })
            .catch((err) => toast(err.message, "error"));
        }}
      >
        <Input
          label="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Teléfono"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <div className="flex items-end">
          <Button type="submit" className="w-full">
            Añadir
          </Button>
        </div>
      </form>
      <ul className="space-y-2">
        {suppliers.map((s) => (
          <li
            key={s.id}
            className="rounded-[var(--radius-md)] border border-border px-3 py-2 text-sm"
          >
            <p className="font-medium">{s.name}</p>
            <p className="text-caption">
              {[s.email, s.phone].filter(Boolean).join(" · ") || "Sin contacto"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PurchasesPanel() {
  const {
    suppliers,
    ingredients,
    purchases,
    addPurchase,
    markPurchaseReceived,
  } = useInventory();
  const [supplierId, setSupplierId] = useState("");
  const [ingredientId, setIngredientId] = useState("");
  const [qty, setQty] = useState("1");
  const [unitCost, setUnitCost] = useState("1");

  return (
    <div className="space-y-4">
      <form
        className="grid gap-2 sm:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          const ing = ingredients.find(
            (i) => i.id === (ingredientId || ingredients[0]?.id),
          );
          const sup = supplierId || suppliers[0]?.id;
          if (!ing || !sup) {
            toast("Necesitas proveedor e ingrediente", "error");
            return;
          }
          void addPurchase({
            supplierId: sup,
            items: [
              {
                ingredientId: ing.id,
                name: ing.name,
                quantity: Number(qty) || 0,
                unit: ing.unit,
                unitCost: Number(unitCost) || 0,
              },
            ],
          })
            .then(() => toast("Compra creada", "success"))
            .catch((err) => toast(err.message, "error"));
        }}
      >
        <Select
          label="Proveedor"
          value={supplierId || suppliers[0]?.id || ""}
          onChange={(e) => setSupplierId(e.target.value)}
        >
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select
          label="Ingrediente"
          value={ingredientId || ingredients[0]?.id || ""}
          onChange={(e) => setIngredientId(e.target.value)}
        >
          {ingredients.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </Select>
        <Input
          label="Cantidad"
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
        <Input
          label="Coste ud"
          type="number"
          value={unitCost}
          onChange={(e) => setUnitCost(e.target.value)}
        />
        <div className="flex items-end">
          <Button type="submit" className="w-full">
            Pedir
          </Button>
        </div>
      </form>

      <ul className="space-y-2">
        {purchases.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border px-3 py-2 text-sm"
          >
            <div>
              <p className="font-medium">
                {p.items.map((i) => `${i.quantity} ${i.unit} ${i.name}`).join(", ")}
              </p>
              <p className="text-caption">
                {p.status} · total {p.total}
              </p>
            </div>
            {p.status !== "received" ? (
              <Button
                size="sm"
                onClick={() =>
                  void markPurchaseReceived(p)
                    .then(() => toast("Stock actualizado", "success"))
                    .catch((err) => toast(err.message, "error"))
                }
              >
                Recibir
              </Button>
            ) : (
              <Badge tone="success">Recibida</Badge>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WastePanel() {
  const { ingredients, waste, addWaste } = useInventory();
  const [ingredientId, setIngredientId] = useState("");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState<WasteReason>("spoiled");

  return (
    <div className="space-y-4">
      <form
        className="grid gap-2 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          void addWaste({
            ingredientId: ingredientId || ingredients[0]?.id || "",
            quantity: Number(qty) || 0,
            reason,
          })
            .then(() => toast("Merma registrada", "success"))
            .catch((err) => toast(err.message, "error"));
        }}
      >
        <Select
          label="Ingrediente"
          value={ingredientId || ingredients[0]?.id || ""}
          onChange={(e) => setIngredientId(e.target.value)}
        >
          {ingredients.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </Select>
        <Input
          label="Cantidad"
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
        <Select
          label="Motivo"
          value={reason}
          onChange={(e) => setReason(e.target.value as WasteReason)}
        >
          <option value="expired">Caducado</option>
          <option value="spoiled">Estropeado</option>
          <option value="prep_error">Error prep</option>
          <option value="customer_return">Devolución</option>
          <option value="other">Otro</option>
        </Select>
        <div className="flex items-end">
          <Button type="submit" className="w-full" variant="danger">
            Registrar merma
          </Button>
        </div>
      </form>
      <ul className="space-y-2">
        {waste.map((w) => (
          <li
            key={w.id}
            className="rounded-[var(--radius-md)] border border-border px-3 py-2 text-sm"
          >
            {w.quantity} {w.unit} {w.ingredientName} · {w.reason} · impacto{" "}
            {w.costImpact}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TransfersPanel() {
  const {
    branches,
    branchId,
    ingredients,
    transfers,
    addTransfer,
    markTransferReceived,
  } = useInventory();
  const [toBranchId, setToBranchId] = useState("");
  const [ingredientId, setIngredientId] = useState("");
  const [qty, setQty] = useState("1");

  const others = branches.filter((b) => b.id !== branchId);

  return (
    <div className="space-y-4">
      <form
        className="grid gap-2 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          const ing = ingredients.find(
            (i) => i.id === (ingredientId || ingredients[0]?.id),
          );
          const to = toBranchId || others[0]?.id;
          if (!ing || !to) {
            toast("Elige destino e ingrediente", "error");
            return;
          }
          void addTransfer({
            toBranchId: to,
            items: [
              {
                ingredientId: ing.id,
                name: ing.name,
                quantity: Number(qty) || 0,
                unit: ing.unit,
              },
            ],
          })
            .then(() => toast("Transferencia enviada", "success"))
            .catch((err) => toast(err.message, "error"));
        }}
      >
        <Select
          label="Destino"
          value={toBranchId || others[0]?.id || ""}
          onChange={(e) => setToBranchId(e.target.value)}
        >
          {others.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        <Select
          label="Ingrediente"
          value={ingredientId || ingredients[0]?.id || ""}
          onChange={(e) => setIngredientId(e.target.value)}
        >
          {ingredients.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </Select>
        <Input
          label="Cantidad"
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
        <div className="flex items-end">
          <Button type="submit" className="w-full">
            Transferir
          </Button>
        </div>
      </form>

      {!others.length ? (
        <p className="text-sm text-fg-muted">
          Necesitas al menos 2 sucursales para transferir.
        </p>
      ) : null}

      <ul className="space-y-2">
        {transfers.map((t) => (
          <li
            key={t.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border px-3 py-2 text-sm"
          >
            <div>
              <p className="font-medium">
                {t.fromBranchId.slice(0, 6)} → {t.toBranchId.slice(0, 6)}
              </p>
              <p className="text-caption">
                {t.status} ·{" "}
                {t.items.map((i) => `${i.quantity} ${i.name}`).join(", ")}
              </p>
            </div>
            {t.status === "in_transit" && t.toBranchId === branchId ? (
              <Button
                size="sm"
                onClick={() =>
                  void markTransferReceived(t)
                    .then(() => toast("Transferencia recibida", "success"))
                    .catch((err) => toast(err.message, "error"))
                }
              >
                Recibir aquí
              </Button>
            ) : (
              <Badge tone="neutral">{t.status}</Badge>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AiForecastPanel() {
  const { predictions, runAiForecast, alerts } = useInventory();
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-fg-muted">
          Predicción de inventario (burn-rate + confianza). Genera también
          insights `stock_prediction` en el módulo IA cuando el quiebre es
          &lt; 3 días.
        </p>
        <Button
          disabled={busy}
          onClick={() => {
            void (async () => {
              try {
                setBusy(true);
                const n = await runAiForecast();
                toast(`${n} predicciones actualizadas`, "success");
              } catch (e) {
                toast(e instanceof Error ? e.message : "Error", "error");
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          Ejecutar predicción IA
        </Button>
      </div>

      {alerts.length ? (
        <Alert tone="warning" title={`${alerts.length} alertas de mínimo`}>
          Revisa la pestaña Alertas o ajusta stock mínimo / compras.
        </Alert>
      ) : null}

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-bg-muted text-fg-muted">
            <tr>
              <th className="px-3 py-2">Ingrediente</th>
              <th className="px-3 py-2">Días cobertura</th>
              <th className="px-3 py-2">Uso/día</th>
              <th className="px-3 py-2">Pedido sugerido</th>
              <th className="px-3 py-2">Confianza</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {predictions.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2 font-medium">{p.ingredientName}</td>
                <td className="px-3 py-2">
                  {p.daysOfCover >= 999 ? "∞" : p.daysOfCover}
                  {p.daysOfCover < 3 ? (
                    <Badge tone="danger" className="ml-2">
                      Riesgo
                    </Badge>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  {p.avgDailyUsage} {p.unit}
                </td>
                <td className="px-3 py-2">
                  {p.suggestedReorderQty} {p.unit}
                </td>
                <td className="px-3 py-2">
                  {(p.confidence * 100).toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!predictions.length ? (
          <p className="p-4 text-sm text-fg-muted">
            Aún no hay predicciones. Ejecuta el modelo IA.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function MovementsPanel() {
  const { movements, ingredients } = useInventory();
  const names = useMemo(
    () => new Map(ingredients.map((i) => [i.id, i.name])),
    [ingredients],
  );

  return (
    <ul className="max-h-[520px] space-y-2 overflow-y-auto">
      {movements.map((m) => (
        <li
          key={m.id}
          className="rounded-[var(--radius-md)] border border-border px-3 py-2 text-sm"
        >
          <div className="flex justify-between gap-2">
            <span className="font-medium">
              {names.get(m.ingredientId) ?? m.ingredientId}
            </span>
            <Badge tone={m.delta < 0 ? "warning" : "success"}>
              {m.delta > 0 ? "+" : ""}
              {m.delta} {m.unit}
            </Badge>
          </div>
          <p className="text-caption">
            {m.type}
            {m.note ? ` · ${m.note}` : ""} ·{" "}
            {new Date(m.createdAt).toLocaleString("es-ES")}
          </p>
        </li>
      ))}
      {!movements.length ? (
        <EmptyState
          title="Sin movimientos"
          description="Las ventas, compras, mermas y transferencias aparecerán aquí."
        />
      ) : null}
    </ul>
  );
}
