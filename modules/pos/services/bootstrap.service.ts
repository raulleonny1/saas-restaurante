"use client";

/**
 * Writes real floor + catalog documents into Firestore when the branch
 * has no tables / the restaurant has no products. Not UI mock data.
 */

import { getDb } from "@/lib/firebase";
import type { Product, ProductCategory } from "@/types/catalog";
import type { CurrencyCode } from "@/types/common";
import type { Table } from "@/types/orders";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";

function stamp() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function ensurePosBootstrap(input: {
  restaurantId: string;
  branchId: string;
  currency: CurrencyCode;
}): Promise<{ tablesCreated: number; productsCreated: number }> {
  const { restaurantId, branchId, currency } = input;
  const db = getDb();
  const now = stamp();

  const tablesQ = query(
    collection(db, "restaurants", restaurantId, "tables"),
    where("branchId", "==", branchId),
  );
  const tablesSnap = await getDocs(tablesQ);
  const existingTables = tablesSnap.docs.filter((d) => !d.data().deletedAt);

  let tablesCreated = 0;
  if (existingTables.length === 0) {
    const batch = writeBatch(db);
    const names = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "Barra"];
    names.forEach((name, index) => {
      const tableId = id("tbl");
      const row = Math.floor(index / 4);
      const col = index % 4;
      const table: Table = {
        id: tableId,
        restaurantId,
        branchId,
        name,
        seats: name === "Barra" ? 4 : 4,
        status: "available",
        x: col,
        y: row,
        currentOrderId: null,
        mergedWith: [],
        zone: name === "Barra" ? "barra" : "sala",
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      batch.set(
        doc(db, "restaurants", restaurantId, "tables", tableId),
        table,
      );
      tablesCreated += 1;
    });
    await batch.commit();
  }

  const productsSnap = await getDocs(
    collection(db, "restaurants", restaurantId, "products"),
  );
  const activeProducts = productsSnap.docs.filter(
    (d) => !d.data().deletedAt && d.data().status === "active",
  );

  let productsCreated = 0;
  if (activeProducts.length === 0) {
    const batch = writeBatch(db);
    const cats: Array<Omit<ProductCategory, "id"> & { id: string }> = [
      {
        id: id("cat"),
        restaurantId,
        name: "Café",
        sortOrder: 0,
        status: "active",
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
      {
        id: id("cat"),
        restaurantId,
        name: "Platos",
        sortOrder: 1,
        status: "active",
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
      {
        id: id("cat"),
        restaurantId,
        name: "Bebidas",
        sortOrder: 2,
        status: "active",
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ];
    for (const c of cats) {
      batch.set(doc(db, "restaurants", restaurantId, "categories", c.id), c);
    }

    const products: Product[] = [
      {
        id: id("prd"),
        restaurantId,
        categoryId: cats[0].id,
        name: "Espresso",
        price: 1.8,
        currency,
        status: "active",
        branchIds: [],
        recipe: [],
        variants: [
          { id: "v_solo", name: "Solo", priceDelta: 0 },
          { id: "v_doble", name: "Doble", priceDelta: 0.6 },
        ],
        modifierGroups: [
          {
            id: "mg_leche",
            name: "Leche",
            max: 1,
            options: [
              { id: "m_ent", name: "Entera", priceDelta: 0 },
              { id: "m_av", name: "Avena", priceDelta: 0.4 },
            ],
          },
        ],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
      {
        id: id("prd"),
        restaurantId,
        categoryId: cats[0].id,
        name: "Cappuccino",
        price: 2.6,
        currency,
        status: "active",
        branchIds: [],
        recipe: [],
        modifierGroups: [
          {
            id: "mg_extra",
            name: "Extra",
            max: 2,
            options: [
              { id: "m_shot", name: "Shot extra", priceDelta: 0.5 },
              { id: "m_siro", name: "Sirope vainilla", priceDelta: 0.4 },
            ],
          },
        ],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
      {
        id: id("prd"),
        restaurantId,
        categoryId: cats[1].id,
        name: "Burger casa",
        price: 11.5,
        currency,
        status: "active",
        branchIds: [],
        recipe: [],
        variants: [
          { id: "v_cl", name: "Clásica", priceDelta: 0 },
          { id: "v_dbl", name: "Doble carne", priceDelta: 3 },
        ],
        modifierGroups: [
          {
            id: "mg_punto",
            name: "Punto",
            required: true,
            min: 1,
            max: 1,
            options: [
              { id: "m_al", name: "Al punto", priceDelta: 0 },
              { id: "m_hecho", name: "Hecho", priceDelta: 0 },
            ],
          },
        ],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
      {
        id: id("prd"),
        restaurantId,
        categoryId: cats[2].id,
        name: "Agua 50cl",
        price: 2.2,
        currency,
        status: "active",
        branchIds: [],
        recipe: [],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
      {
        id: id("prd"),
        restaurantId,
        categoryId: cats[2].id,
        name: "Cerveza caña",
        price: 2.5,
        currency,
        status: "active",
        branchIds: [],
        recipe: [],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ];

    for (const p of products) {
      batch.set(doc(db, "restaurants", restaurantId, "products", p.id), p);
      productsCreated += 1;
    }
    await batch.commit();
  }

  return { tablesCreated, productsCreated };
}
