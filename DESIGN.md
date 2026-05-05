# Design Brief

## Theme & Differentiation
Institutional trust meets data clarity. Professional school administration dashboard designed for rapid pattern recognition and confident decision-making. Navy-primary color palette conveys trustworthiness and authority. Zero decoration—every pixel serves absenteeism visibility.

## Color Palette (OKLCH)
| Token               | Light Value      | Dark Value       | Purpose |
|:------------------|:-----------------|:-----------------|:--------|
| Primary            | 0.32 0.15 256    | 0.65 0.15 256    | Deep navy, institutional trust, header/primary CTA |
| Destructive        | 0.55 0.22 22     | 0.65 0.19 22     | Red, critical status (20%+ absence), alert state |
| Warning            | Amber-100/900    | Amber-600/900    | Amber, warning status (10-20% absence) |
| Secondary/Slate    | 0.50 0.08 256    | 0.40 0.08 256    | Supporting UI, disabled states |
| Muted              | 0.92 0.02 256    | 0.25 0.02 260    | Backgrounds, subtle dividers, table hover |
| Background         | 0.98 0.01 269    | 0.15 0.02 260    | Page canvas, light/airy |
| Card/Popover       | 1.0 0 0          | 0.20 0.02 260    | Elevated surfaces, detail panels, modals |

## Typography
| Role      | Font           | Size/Weight | Usage |
|:----------|:---------------|:-----------|:------|
| Display   | Lora (serif)   | 24-32 bold | Dashboard title, section headers |
| Body      | General Sans   | 14-16 regular | Content, table cells, labels |
| Mono      | Geist Mono     | 12-13 regular | Data values, attendance codes |

## Structural Zones
| Zone      | Background | Border      | Elevation | Notes |
|:----------|:-----------|:-----------|:----------|:------|
| Header    | Primary    | None       | Elevated  | Dark navy, white text, shadow-elevated |
| Summary Cards | Card   | Subtle     | Shadow-sm | White surfaces, 3-column grid, hover lift |
| Data Table | Card    | Table rows  | Shadow-sm | Striped row backgrounds, high contrast headers |
| Side Panel | Card    | Subtle     | Overlay   | Slid-in detail view, calendar grid layout |
| Footer    | Muted/40   | Border-t   | Flat      | Administrative metadata (optional) |

## Spacing & Rhythm
- Base grid: 4px increments (4, 8, 12, 16, 24, 32, 48)
- Card padding: 24px (6rem)
- Summary card grid: 3 columns, 16px gap (md), stack on mobile
- Table row height: 56px (visual density for rapid scanning)
- Sidebar/detail panel: 360px width, overlay on mobile

## Component Patterns
- **Summary Card**: Title (label, text-muted), Value (large number, text-foreground), Subtext (small, text-muted-foreground)
- **Status Badge**: Red `badge-critical` (20%+), Amber `badge-warning` (10-20%), Slate `badge-neutral` (healthy)
- **Data Table**: Sortable headers (underline on hover), row hover state (bg-muted/30), alternating row subtle background if density requires
- **Detail Panel**: Mini calendar grid (7 columns, 6 rows), present/absent markers (filled/empty circles or checkmarks), month navigation

## Motion & Interaction
- Transitions: `transition-smooth` (all 0.3s ease-out) for state changes, hover effects
- Summary cards: Subtle scale on hover (1.02x), shadow increase on hover
- Table rows: Hover state applies bg-muted/30, cursor pointer on interactive rows
- Side panel: Slide-in from right (250ms ease-out), overlay backdrop (semi-transparent)
- Badges: No animation, static visual hierarchy

## Constraints & Notes
- Light mode only (requested); dark mode tokens defined for future use
- Accessibility: WCAG AA+ contrast on all text/interactive elements (navy on white, 6.5:1; red on white, 5.2:1; amber on white, 4.8:1)
- Data table: Max visible rows per page ~10-15; pagination or virtualization for scale
- Mobile: Summary cards stack vertically; table horizontal scroll or accordion detail collapse
- Fonts: Served via `@font-face` from `public/assets/fonts/`; Lora for warmth and credibility, General Sans for clarity and modernity

## Signature Detail
Navy primary paired with serif display font creates unexpected sophistication for an institutional dashboard—moves beyond generic gray/blue tech aesthetic. Institutional trust (navy) + editorial craftsmanship (Lora) + clean data (General Sans) = distinctive and memorable.
