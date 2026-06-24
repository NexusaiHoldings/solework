import type { JSX } from "react";
import {
  fetchShoeSkus,
  groupSkusByColorway,
  groupStockStatus,
  getStockLabel,
  getStockStatus,
  areAllSoldOut,
  formatPrice,
  type SkuGroup,
  type StockStatus,
} from "@/lib/shoes/sku-inventory";

export const revalidate = 60;

function pillStyle(status: StockStatus): Record<string, string> {
  if (status === "sold_out")
    return { backgroundColor: "#fef2f2", color: "#dc2626" };
  if (status === "low_stock")
    return { backgroundColor: "#fffbeb", color: "#d97706" };
  return { backgroundColor: "#f0fdf4", color: "#16a34a" };
}

function SkuCard({ group }: { group: SkuGroup }): JSX.Element {
  const status = groupStockStatus(group);
  const totalStock = group.sizes.reduce((acc, s) => acc + s.stockQuantity, 0);
  const isSoldOut = status === "sold_out";

  return (
    <div
      className="card sku-card"
      data-group-id={group.groupId}
      style={{
        position: "relative",
        overflow: "hidden",
        cursor: isSoldOut ? "default" : "pointer",
        padding: "1rem",
      }}
    >
      <div
        style={{
          aspectRatio: "4/3",
          backgroundColor: "#f3f4f6",
          overflow: "hidden",
          borderRadius: "6px",
          marginBottom: "0.875rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {group.imageUrl ? (
          <img
            src={group.imageUrl}
            alt={`${group.name} in ${group.colorway}`}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <svg
            width="56"
            height="56"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9ca3af"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M20.5 10.19a1.5 1.5 0 0 0-1.5-1.5H14l-2-4H8.5a1.5 1.5 0 0 0-1.5 1.5v8l-3 1v1.31A1.19 1.19 0 0 0 5.19 17.5h13.62A1.19 1.19 0 0 0 20 16.31V15l-3-1V10.19z" />
          </svg>
        )}
      </div>

      <h3 style={{ margin: "0 0 0.2rem", fontSize: "1rem", fontWeight: 600 }}>
        {group.name}
      </h3>
      <p className="muted" style={{ margin: "0 0 0.6rem", fontSize: "0.875rem" }}>
        {group.colorway}
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.4rem",
          marginBottom: "0.6rem",
        }}
      >
        <span
          style={{
            ...pillStyle(status),
            padding: "2px 8px",
            borderRadius: "9999px",
            fontSize: "0.75rem",
            fontWeight: 500,
          }}
        >
          {getStockLabel(totalStock)}
        </span>
        <span
          style={{
            backgroundColor: "#eff6ff",
            color: "#2563eb",
            padding: "2px 8px",
            borderRadius: "9999px",
            fontSize: "0.75rem",
          }}
        >
          2–3 day shipping
        </span>
      </div>

      <p style={{ margin: "0 0 0.75rem", fontWeight: 700, fontSize: "1.125rem" }}>
        {formatPrice(group.price)}
      </p>

      {!isSoldOut && (
        <button
          className="btn quick-add-btn"
          data-target={`drawer-${group.groupId}`}
          aria-label={`Quick add ${group.name} ${group.colorway}`}
          style={{
            width: "100%",
            position: "absolute",
            bottom: 0,
            left: 0,
            transform: "translateY(100%)",
            borderRadius: 0,
          }}
        >
          Quick add
        </button>
      )}
    </div>
  );
}

function SizeDrawer({ group }: { group: SkuGroup }): JSX.Element {
  return (
    <dialog
      id={`drawer-${group.groupId}`}
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        top: "auto",
        width: "100%",
        maxWidth: "100%",
        margin: 0,
        padding: 0,
        border: "none",
        borderRadius: "1rem 1rem 0 0",
        boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
        maxHeight: "90vh",
        overflowY: "auto",
      }}
    >
      <div style={{ padding: "1.5rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "1.25rem",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1.25rem" }}>{group.name}</h2>
            <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.875rem" }}>
              {group.colorway} · {formatPrice(group.price)}
            </p>
          </div>
          <button
            className="btn secondary"
            data-close={`drawer-${group.groupId}`}
            aria-label="Close size drawer"
            style={{ lineHeight: 1, padding: "0.375rem 0.625rem" }}
          >
            ✕
          </button>
        </div>

        <p style={{ margin: "0 0 0.75rem", fontWeight: 500 }}>Select your size</p>
        <div
          data-size-grid={group.groupId}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(68px, 1fr))",
            gap: "0.5rem",
            marginBottom: "1.5rem",
          }}
        >
          {group.sizes.map((s) => {
            const st = getStockStatus(s.stockQuantity);
            const soldOut = st === "sold_out";
            return (
              <button
                key={s.id}
                className={soldOut ? "btn secondary" : "btn"}
                data-sku-id={s.id}
                data-size={s.size}
                data-group={group.groupId}
                disabled={soldOut}
                aria-label={`Size ${s.size}${soldOut ? " – Sold out" : ""}`}
                style={{
                  opacity: soldOut ? 0.4 : 1,
                  fontSize: "0.875rem",
                  padding: "0.5rem 0.25rem",
                }}
              >
                {s.size}
              </button>
            );
          })}
        </div>

        <form
          action="/api/billing/checkout"
          method="POST"
          id={`checkout-form-${group.groupId}`}
        >
          <input type="hidden" name="product_type" value="shoe_sku" />
          <input
            type="hidden"
            name="sku_id"
            id={`selected-sku-${group.groupId}`}
          />
          <input type="hidden" name="success_url" value="/shop/confirmation" />
          <input type="hidden" name="cancel_url" value="/shop" />
          <button
            type="submit"
            className="btn"
            id={`add-to-cart-${group.groupId}`}
            disabled={true}
            style={{ width: "100%" }}
          >
            Add to cart
          </button>
        </form>
      </div>
    </dialog>
  );
}

function BackSoonState(): JSX.Element {
  return (
    <main>
      <h1>Best Sellers</h1>
      <p>Our most popular styles, ready to ship in 2–3 days.</p>
      <div
        className="empty"
        style={{ textAlign: "center", padding: "3rem 1.5rem" }}
      >
        <div
          style={{ fontSize: "3.5rem", marginBottom: "1rem" }}
          aria-hidden="true"
        >
          👟
        </div>
        <h2 style={{ marginBottom: "0.5rem" }}>Back soon</h2>
        <p className="muted" style={{ marginBottom: "1.75rem", maxWidth: "380px", margin: "0 auto 1.75rem" }}>
          All our pre-printed styles have sold out. We&apos;re printing more —
          join the waitlist to be first.
        </p>
        <form
          action="/api/notifications/subscribe"
          method="POST"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            maxWidth: "360px",
            margin: "0 auto",
          }}
        >
          <input type="hidden" name="list" value="shoe-waitlist" />
          <label htmlFor="waitlist-email" className="muted" style={{ textAlign: "left", fontSize: "0.875rem" }}>
            Email address
          </label>
          <input
            id="waitlist-email"
            type="email"
            name="email"
            placeholder="you@example.com"
            required
            style={{
              padding: "0.625rem 0.875rem",
              borderRadius: "0.5rem",
              border: "1px solid #d1d5db",
              fontSize: "1rem",
              width: "100%",
              boxSizing: "border-box",
            }}
          />
          <button type="submit" className="btn">
            Notify me when back in stock
          </button>
        </form>
      </div>
    </main>
  );
}

const drawerScript = `
(function () {
  // Hover: slide Quick add button up into view
  document.querySelectorAll('.sku-card').forEach(function (card) {
    var btn = card.querySelector('.quick-add-btn');
    if (!btn) return;
    card.addEventListener('mouseenter', function () {
      btn.style.transform = 'translateY(0)';
    });
    card.addEventListener('mouseleave', function () {
      btn.style.transform = 'translateY(100%)';
    });
  });

  // Open drawer via Quick add button
  document.querySelectorAll('[data-target]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var dialog = document.getElementById(btn.dataset.target);
      if (dialog) dialog.showModal();
    });
  });

  // Close drawer via ✕ button
  document.querySelectorAll('[data-close]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var dialog = document.getElementById(btn.dataset.close);
      if (dialog) dialog.close();
    });
  });

  // Size selection: highlight and enable Add to cart
  document.querySelectorAll('[data-sku-id]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var groupId = btn.dataset.group;
      var input = document.getElementById('selected-sku-' + groupId);
      var addBtn = document.getElementById('add-to-cart-' + groupId);
      if (input) input.value = btn.dataset.skuId;
      if (addBtn) {
        addBtn.disabled = false;
        addBtn.textContent = 'Add to cart — Size ' + btn.dataset.size;
      }
      var grid = document.querySelector('[data-size-grid="' + groupId + '"]');
      if (grid) {
        grid.querySelectorAll('[data-sku-id]').forEach(function (b) {
          b.style.outline = '';
        });
      }
      btn.style.outline = '2px solid #2563eb';
      btn.style.outlineOffset = '2px';
    });
  });

  // Close dialog when clicking the backdrop
  document.querySelectorAll('dialog').forEach(function (dialog) {
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) dialog.close();
    });
  });
})();
`;

export default async function ShopPage(): Promise<JSX.Element> {
  const skus = await fetchShoeSkus();
  const groups = groupSkusByColorway(skus);
  const allSoldOut = areAllSoldOut(groups);

  if (allSoldOut) {
    return <BackSoonState />;
  }

  return (
    <main>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .sku-card {
              transition: box-shadow 0.2s ease, transform 0.2s ease;
            }
            .sku-card:hover {
              box-shadow: 0 8px 28px rgba(0, 0, 0, 0.13);
              transform: translateY(-3px);
            }
            .quick-add-btn {
              transition: transform 0.22s ease;
            }
            dialog::backdrop {
              background: rgba(0, 0, 0, 0.45);
            }
          `,
        }}
      />

      <h1>Best Sellers</h1>
      <p>Our most popular styles, handcrafted and ready to ship in 2–3 days.</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "1.5rem",
          marginTop: "2rem",
        }}
      >
        {groups.map((group) => (
          <SkuCard key={group.groupId} group={group} />
        ))}
      </div>

      {groups.map((group) => (
        <SizeDrawer key={`drawer-${group.groupId}`} group={group} />
      ))}

      <script dangerouslySetInnerHTML={{ __html: drawerScript }} />
    </main>
  );
}
