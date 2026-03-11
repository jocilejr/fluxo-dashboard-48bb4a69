

## Fix: Admin Area Colors and Layout for Dark Theme

### Root Cause
The entire app uses a dark color scheme (CSS variables: `--background: 220 20% 4%`, `--foreground: 0 0% 98%`), but the admin member area components use hardcoded light-mode Tailwind colors like `text-gray-900`, `bg-white`, `bg-gray-50`, `bg-emerald-50`, `bg-amber-50`, `bg-gray-100/80`. This creates unreadable text and broken contrast.

### Fix Strategy
Replace all hardcoded gray/white/colored backgrounds and text colors with theme-aware CSS variable classes (`text-foreground`, `bg-card`, `bg-muted`, `border-border`, `text-muted-foreground`, etc.) across all admin member area files.

### Files to Edit

**1. `src/pages/AreaMembros.tsx`**
- Header: `text-gray-900` → `text-foreground`, `text-gray-500` → `text-muted-foreground`
- Stats cards: `bg-emerald-50`, `bg-amber-50`, `bg-primary/5` → use `bg-card` or `bg-muted` with accent borders
- TabsList: `bg-gray-100/80` → `bg-muted`, `data-[state=active]:bg-white` → `data-[state=active]:bg-card`
- Labels: all `text-gray-500`, `text-gray-400` → `text-muted-foreground`

**2. `src/components/membros/MemberClientCard.tsx`**
- URL bar: `bg-gray-50` → `bg-muted`
- Text: `text-gray-900`, `text-gray-700`, `text-gray-500`, `text-gray-400` → theme tokens
- Transaction rows: `bg-gray-50/80` → `bg-muted/50`
- Borders: `border-gray-100` → `border-border`

**3. `src/components/membros/ContentManagement.tsx`**
- Same pattern: replace all hardcoded light colors with theme-aware equivalents

No database changes needed. Pure CSS/class fixes.

