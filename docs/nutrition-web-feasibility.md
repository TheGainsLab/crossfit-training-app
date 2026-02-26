# Nutrition Features — Web Feasibility Analysis

## Overview

Assessment of whether the three mobile nutrition features (food search, barcode scanning, AI image recognition) can be used in a web application.

**Verdict: All three features are feasible for web with no backend changes required.**

---

## 1. Food Search — Fully Feasible

**Current mobile implementation:**
- `FoodSearchView.tsx` — TextInput + search button
- Calls `supabase.functions.invoke('nutrition-search', ...)` with query string
- Edge Function (`nutrition-search/index.ts`) calls FatSecret API via proxy, returns food results

**Web feasibility: No changes needed on the backend.**
- The Supabase JS client works identically in browsers
- Replace React Native `TextInput`/`TouchableOpacity` with standard HTML `<input>`/`<button>` or React equivalents
- All search logic, filtering (generic/brand), and pagination is reusable as-is

**Frontend effort: Low**

---

## 2. Barcode Scanning — Feasible with Library Swap

**Current mobile implementation:**
- Uses `expo-camera` `CameraView` with `barcodeScannerSettings` for native scanning
- Supports: UPC-A, UPC-E, EAN-13, EAN-8, Code128
- On scan, calls `supabase.functions.invoke('nutrition-barcode', ...)` with barcode string
- Edge Function (`nutrition-barcode/index.ts`) normalizes barcode to GTIN-13, looks up via FatSecret `food.find_id_for_barcode`, returns nutrition data

**Web feasibility: Backend is 100% compatible — just needs a web barcode scanner.**
- Web barcode scanning libraries (use browser `getUserMedia` API):
  - `html5-qrcode` — lightweight, supports all needed barcode types
  - `@nicholasgasior/zxing-js` — port of ZXing, comprehensive format support
  - `quagga2` — optimized for real-time scanning
- All support UPC-A, UPC-E, EAN-13, EAN-8, Code128
- Requires HTTPS in production (standard for any web app)
- The `handleBarcodeScanned` callback logic is identical — pass barcode string to same Edge Function

**Frontend effort: Medium** — replace `<CameraView>` with a JS barcode scanner component; callback logic stays the same.

---

## 3. AI Image Recognition — Fully Feasible

**Current mobile implementation:**
- `expo-image-picker` captures photo (camera or library), returns base64
- Sends base64 to `supabase.functions.invoke('nutrition-image-complete', ...)`
- Edge Function (`nutrition-image-complete/index.ts`):
  1. Sends image to Claude Vision API (claude-3-haiku) for food identification
  2. Searches FatSecret for each identified food
  3. Matches AI-estimated serving sizes to FatSecret servings
  4. Returns structured nutrition data with confidence scores
- Results displayed in `PhotoResultSlider.tsx` for portion adjustment

**Web feasibility: Backend needs zero changes.**
- The code already handles web: `if (Platform.OS === 'web') { pickImage('library') }` (NutritionPage.tsx:445)
- For a non-Expo web app: `<input type="file" accept="image/*" capture="camera">` with `FileReader` for base64 conversion
- Mobile device browsers will offer camera or photo library when `capture="camera"` is set
- Desktop browsers will show file picker
- `PhotoResultSlider.tsx` uses only standard UI patterns (sliders, lists, buttons) — trivial to port

**Frontend effort: Low** — file input replaces ImagePicker; display components are standard UI.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────┐
│                    Frontend                          │
│                                                     │
│  Mobile (current)          Web (new)                │
│  ├─ expo-image-picker  →   <input type="file">      │
│  ├─ expo-camera        →   html5-qrcode / zxing-js  │
│  └─ React Native UI    →   HTML/React components    │
└──────────────┬──────────────────┬────────────────────┘
               │                  │
               │  Same API calls  │
               ▼                  ▼
┌─────────────────────────────────────────────────────┐
│            Supabase Edge Functions                   │
│            (NO CHANGES NEEDED)                       │
│                                                     │
│  ├─ nutrition-search          → FatSecret foods.search
│  ├─ nutrition-barcode         → FatSecret barcode lookup
│  ├─ nutrition-image-complete  → Claude Vision + FatSecret
│  └─ nutrition-food            → FatSecret food.get
└─────────────────────────────────────────────────────┘
```

## Feature Comparison

| Feature             | Web Feasible? | Backend Changes | Frontend Effort |
|---------------------|:------------:|:---------------:|:---------------:|
| Food Search         | Yes          | None            | Low             |
| Barcode Scan        | Yes          | None            | Medium          |
| AI Image Recognition| Yes          | None            | Low             |

## Key Takeaways

1. **Backend is platform-agnostic** — All Supabase Edge Functions accept JSON over HTTP. They don't know or care whether the caller is mobile or web.

2. **Mobile-specific code is limited to input capture** — Camera access (expo-camera) and image picking (expo-image-picker) are the only parts that need web equivalents.

3. **Mature web alternatives exist** for every mobile-specific library used:
   - Barcode scanning: `html5-qrcode`, `zxing-js`, `quagga2`
   - Image capture: HTML `<input type="file" accept="image/*">`
   - Camera access: `navigator.mediaDevices.getUserMedia()`

4. **Business logic is fully reusable** — Food matching, serving size calculations, nutrition lookups, and the AI recognition pipeline require zero changes.
