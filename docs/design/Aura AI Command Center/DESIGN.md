# Design System Documentation: The Fluid Ledger

## 1. Overview & Creative North Star

### Creative North Star: "The Hydro-Kinetic Command"
In this design system, we move beyond static financial grids to embrace the metaphor of **Capital as Water**. The interface is not a spreadsheet; it is a high-pressure cockpit managing a global reservoir of liquidity. 

To achieve a "High-End Editorial" feel in a high-density data environment, we reject the clutter of traditional "boxed" UIs. We break the template look through **Intentional Asymmetry** and **Tonal Depth**. The layout should feel like a series of illuminated glass panes submerged in a deep, dark ocean. We use breathing room (negative space) not just for aesthetics, but to focus the eye on critical "flow" shifts.

---

## 2. Colors

The palette is rooted in deep oceanic shadows, punctuated by high-luminance kinetic accents.

### The "No-Line" Rule
**Explicit Instruction:** Traditional 1px solid borders are strictly prohibited for sectioning. Boundaries must be defined solely through background color shifts. 
- Use `surface_container_low` for secondary modules sitting on a `surface` background. 
- Use `surface_container_highest` for active or "hovered" interactive zones. 

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of semi-transparent materials.
- **Deep Background:** `surface_container_lowest` (#0B0E14) acts as the "sea floor."
- **Primary Modules:** `surface` (#10131A) or `surface_container` (#1D2026).
- **Nested Contexts:** To separate a chart from its controls, place a `surface_container_high` pane inside a `surface` section.

### The "Glass & Gradient" Rule
To evoke the fluidity of capital:
- **Glassmorphism:** Use `surface_variant` (#32353C) at 40-60% opacity with a `20px` backdrop-blur for floating overlays or modal cockpits.
- **Signature Glows:** Primary CTAs should utilize a linear gradient from `primary_container` (#00F2FF) to `surface_tint` (#00DBE7). This creates a "self-illuminated" effect that flat colors lack.

---

## 3. Typography

The typographic system creates a tension between high-fashion editorial (Space Grotesk) and clinical precision (JetBrains Mono).

| Level | Token | Font | Purpose |
| :--- | :--- | :--- | :--- |
| **Display** | `display-lg` | Space Grotesk | Total Portfolio Value / Hero Metrics. |
| **Headline** | `headline-md` | Space Grotesk | Sector Titles (e.g., "Liquidity Pools"). |
| **Title** | `title-md` | Inter | Widget headers and navigation. |
| **Body** | `body-md` | Inter | Descriptive text and metadata. |
| **Data/Label** | `label-md` | **JetBrains Mono** | Ticker symbols, prices, and timestamps. |

**Editorial Note:** Use `display-lg` with tight letter-spacing (-0.02em) to create an authoritative, "brutalist" look for major financial figures. Combine this with `label-sm` for tiny, monospaced metadata to create a sophisticated scale contrast.

---

## 4. Elevation & Depth

### The Layering Principle
Depth is achieved through **Tonal Layering** rather than structural lines.
- Place a `surface_container_lowest` card on a `surface_container_low` section to create a "recessed" or "carved" feel.
- Place a `surface_bright` pane on a `surface` background to create "lift."

### Ambient Shadows
For floating elements (modals, dropdowns), use "Atmospheric Shadows":
- **Blur:** 40px - 60px.
- **Opacity:** 8% - 12%.
- **Color:** Use a tinted version of `primary` (#E1FDFF) rather than black. This simulates the light of the screen refracting through the "water."

### The "Ghost Border" Fallback
If contrast is legally required for accessibility, use the `outline_variant` (#3A494B) at **15% opacity**. It should be felt, not seen.

---

## 5. Components

### Buttons
- **Primary:** Gradient fill (`primary_container` to `surface_tint`). No border. `on_primary` (#00363A) text.
- **Secondary (The Flow Button):** `outline` (#849495) at 20% opacity. Upon hover, the background transitions to a 10% `primary` glow.
- **Tertiary:** Purely text-based using `primary_fixed` (#74F5FF) with an underscore that expands on hover.

### Input Fields
Inputs are "Subsurface." Use `surface_container_lowest` for the field background with a `sm` (0.125rem) corner radius. The focus state is signaled by a `primary` outer glow, not a border change.

### Cards & Lists
**Strict Rule:** No horizontal dividers. 
- Separate list items using `spacing.2` (0.4rem) of vertical whitespace.
- Use alternating subtle backgrounds (`surface_container_low` vs `surface_container`) only for extremely high-density data tables.

### The "Golden Pit" Alert (Tertiary Accent)
Warnings use `tertiary_container` (#FFD81D). These components should feature a "pulsing" animation—a soft `2px` blur expansion—to simulate an alarm under the surface of the water.

---

## 6. Do's and Don'ts

### Do
- **DO** use `JetBrains Mono` for any changing numerical value to prevent "jumping" text layouts.
- **DO** leverage `spacing.16` and `spacing.20` to create "Editorial Silences" between major data clusters.
- **DO** use `secondary_container` (#DE0541) exclusively for negative divergence/market drops to maintain semantic urgency.

### Don't
- **DON'T** use `9999px` (full) pill shapes for everything. Reserve `full` for status indicators; use `DEFAULT` (0.25rem) for primary structural elements to maintain a professional, architectural feel.
- **DON'T** use 100% white (#FFFFFF). Always use `on_surface` (#E1E2EB) or `primary` (#E1FDFF) to reduce eye strain in dark mode.
- **DON'T** use standard "Drop Shadows." If an element needs to stand out, use a "Backdrop Blur" or a "Tonal Lift."