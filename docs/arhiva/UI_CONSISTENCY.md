# UI Konzistentnost — Vodič

Ovaj dokument opisuje zajedničke UI komponente i stilove za konzistentnost kroz ceo projekat.

## Zajednički CSS Stilovi

Svi zajednički stilovi su u `src/lib/ui/common-styles.css` i automatski se učitavaju kroz `layout.js`.

### Page Layout

```tsx
<div className="pageWrap">
  <div className="topBlock">
    <div className="topInner">
      <div className="topRow">
        {/* Brand i akcije */}
      </div>
      <div className="divider" />
    </div>
  </div>
  <div className="bodyWrap">
    {/* Sadržaj stranice */}
  </div>
</div>
```

### Brand/Logo

```tsx
<div className="brandWrap">
  <img src="/fluxa/logo-light.png" alt="FLUXA" className="brandLogo" />
  <div>
    <div className="brandTitle">Naslov stranice</div>
    <div className="brandSub">Podnaslov</div>
  </div>
</div>
```

### Buttons

```tsx
<Link href="/dashboard" className="btn">Dashboard</Link>
<button className="btn" onClick={handleClick}>Akcija</button>
<button className="btn" aria-disabled="true">Onemogućeno</button>
```

### Cards

```tsx
<div className="card">
  {/* Sadržaj kartice */}
</div>

<div className="tableCard">
  <table>
    {/* Tabela */}
  </table>
</div>
```

### Form Elements

```tsx
<div className="field">
  <div className="label">Label</div>
  <input className="input" type="text" />
</div>

<input className="input small" type="date" />
```

### Modal

Koristi zajedničku `Modal` komponentu:

```tsx
import Modal from "@/components/Modal";

<Modal
  open={isOpen}
  onClose={() => setIsOpen(false)}
  title="Naslov modala"
  subtitle="Opis ili podnaslov"
  width={980}
  footer={
    <>
      <button className="btn" onClick={handleCancel}>Otkaži</button>
      <button className="btn" onClick={handleSave}>Sačuvaj</button>
    </>
  }
>
  {/* Sadržaj modala */}
</Modal>
```

## Konzistentne Vrednosti

- **TopBlock z-index**: 30 (standardno)
- **BrandTitle font-size**: 22px
- **BrandTitle font-weight**: 800
- **BrandLogo height**: 30px
- **Button padding**: 10px 12px
- **Button border-radius**: 14px
- **Card border-radius**: 18px
- **Modal z-index**: 9999

## Migracija Postojećih Stranica

1. Zameni inline stilove sa CSS klasama iz `common-styles.css`
2. Koristi `Modal` komponentu umesto custom modal implementacija
3. Ujednači z-index vrednosti
4. Koristi konzistentne font-size i font-weight vrednosti

## Primer Migracije

**Pre:**
```tsx
<div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
  <div style={{ position: "sticky", top: 0, padding: "14px 0 12px" }}>
    {/* ... */}
  </div>
</div>
```

**Posle:**
```tsx
<div className="pageWrap">
  <div className="topBlock">
    {/* ... */}
  </div>
</div>
```
